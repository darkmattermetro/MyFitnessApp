import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: corsHeaders });

function bmr(weightKg: number, heightCm: number, age: number, sex: string) {
  const adjustment = sex === 'female' || sex === 'mujer' ? -161 : 5;
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + adjustment);
}

function readJson(text: string) {
  const clean = text.replace(/\x60\x60\x60(?:json)?/gi, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  return JSON.parse(start >= 0 && end > start ? clean.slice(start, end + 1) : clean);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) return json({ error: 'Sign in again before requesting a suggestion.' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  if (!url || !anonKey || !serviceKey || !geminiKey) return json({ error: 'The calorie suggestion service is not configured.' }, 503);

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  const user = authData?.user;
  if (authError || !user) return json({ error: 'Your session is no longer valid. Sign in again.' }, 401);

  let sourceDay = '';
  try {
    sourceDay = String((await request.json())?.sourceDay || '');
  } catch {
    return json({ error: 'A source date is required.' }, 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sourceDay)) return json({ error: 'Use a local calendar date in YYYY-MM-DD format.' }, 400);
  if (sourceDay > new Date().toISOString().slice(0, 10)) return json({ error: 'A future day cannot be evaluated.' }, 400);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: cached } = await admin.from('calorie_adjustment_suggestions')
    .select('status,suggestion').eq('user_id', user.id).eq('source_day', sourceDay).maybeSingle();
  if (cached?.status === 'completed') return json({ ...cached.suggestion, cached: true });
  if (cached?.status === 'pending') return json({ error: 'A suggestion for this day is already being prepared. Try again shortly.' }, 409);

  const { error: claimError } = await admin.from('calorie_adjustment_suggestions')
    .insert({ user_id: user.id, source_day: sourceDay, status: 'pending' });
  if (claimError?.code === '23505') {
    const { data: claim } = await admin.from('calorie_adjustment_suggestions')
      .update({ status: 'pending', suggestion: null, updated_at: new Date().toISOString() })
      .eq('user_id', user.id).eq('source_day', sourceDay).eq('status', 'failed')
      .select('user_id').maybeSingle();
    if (!claim) return json({ error: 'A suggestion for this day is already being prepared. Try again shortly.' }, 409);
  } else if (claimError) {
    return json({ error: 'Could not start the suggestion request.' }, 500);
  }

  try {
    return await prepareSuggestion({ admin, userClient, userId: user.id, sourceDay, geminiKey });
  } catch (error) {
    await admin.from('calorie_adjustment_suggestions')
      .update({ status: 'failed', suggestion: null, updated_at: new Date().toISOString() })
      .eq('user_id', user.id).eq('source_day', sourceDay);
    console.error('calorie suggestion failed', error instanceof Error ? error.message : 'unknown error');
    return json({ error: error instanceof Error ? error.message : 'Could not prepare a suggestion.' }, 502);
  }
});

async function prepareSuggestion({ admin, userClient, userId, sourceDay, geminiKey }: any) {
  const weekStart = new Date(sourceDay + 'T12:00:00Z');
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  const { data: profile, error: profileError } = await userClient.from('users')
    .select('objetivo_kcal,step_goal,goal_type,altura_cm,edad,sexo').eq('id', userId).maybeSingle();
  if (profileError || !profile) throw new Error('Could not load your profile goals.');
  if (profile.goal_type !== 'lose') {
    return saveSuggestion(admin, userId, sourceDay, { suggested: false, sourceDay, reason: 'Step-based calorie adjustments are only offered for a weight-loss goal.' });
  }

  const currentGoal = Math.round(Number(profile.objetivo_kcal) || 0);
  const stepGoal = Math.round(Number(profile.step_goal) || 0);
  if (currentGoal < 800 || stepGoal < 1000) throw new Error('Set a daily calorie goal and step goal in Profile first.');
  const { data: activity, error: activityError } = await userClient.from('daily_activity')
    .select('day,steps,steps_provider_source').eq('user_id', userId)
    .gte('day', weekStart.toISOString().slice(0, 10)).lte('day', sourceDay).order('day', { ascending: true });
  if (activityError) throw new Error('Could not load your step history.');
  const days = (activity || []).map((row: any) => ({ day: row.day, steps: Math.max(0, Number(row.steps) || 0) }));
  const sourceActivity = (activity || []).find((row: any) => row.day === sourceDay);
  if (!sourceActivity || sourceActivity.steps_provider_source !== 'health_connect') {
    return saveSuggestion(admin, userId, sourceDay, {
      suggested: false, sourceDay,
      reason: 'No Health Connect step total is synced for that day, so OpenFit will not adjust your calorie goal.',
    });
  }
  const sourceSteps = Math.max(0, Number(sourceActivity.steps) || 0);
  if (sourceSteps >= stepGoal) {
    return saveSuggestion(admin, userId, sourceDay, { suggested: false, sourceDay, steps: sourceSteps, stepGoal, reason: 'You reached your step goal, so no calorie adjustment is suggested.' });
  }

  const { data: weightRow } = await userClient.from('weight_entries')
    .select('peso_kg').lte('measured_at', sourceDay + 'T23:59:59.999Z')
    .order('measured_at', { ascending: false }).limit(1).maybeSingle();
  const weightKg = Number(weightRow?.peso_kg) || 0;
  const heightCm = Number(profile.altura_cm) || 0;
  const age = Number(profile.edad) || 0;
  if (weightKg < 30 || weightKg > 300 || heightCm < 120 || heightCm > 250 || age < 16 || age > 100) {
    throw new Error('Add a recent weight, height, and age in Profile before requesting a calorie suggestion.');
  }
  const floorKcal = bmr(weightKg, heightCm, age, String(profile.sexo || 'male'));
  const maxReduction = Math.min(100, Math.max(0, currentGoal - floorKcal));
  if (maxReduction < 1) {
    return saveSuggestion(admin, userId, sourceDay, { suggested: false, sourceDay, steps: sourceSteps, stepGoal, reason: 'Your current goal is already at or below your estimated resting-energy floor. OpenFit will not lower it.' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  let aiResponse;
  let aiBody;
  try {
    aiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{
          text: 'Review the last 7 daily step totals and the current weight-loss calorie goal. Return a modest next-day meal-plan calorie suggestion. Never go below the supplied floor or reduce by more than the supplied limit. This estimate does not guarantee weight loss. Return only JSON: {"reason":"one short sentence","suggestedKcal":number}.\n' + JSON.stringify({ days, stepGoal, sourceSteps, currentGoal, floorKcal, maxReduction }),
        }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      }),
    });
    if (!aiResponse.ok) throw new Error('Gemini could not prepare a suggestion. Check the server API configuration.');
    aiBody = await aiResponse.json();
  } catch (error) {
    if (controller.signal.aborted) throw new Error('The calorie suggestion timed out. Try again later.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
  const rawText = aiBody?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const parsed = readJson(rawText);
  const suggestedKcal = Math.round(Number(parsed?.suggestedKcal));
  if (!Number.isFinite(suggestedKcal) || suggestedKcal < currentGoal - maxReduction || suggestedKcal > currentGoal || suggestedKcal < floorKcal) {
    throw new Error('Gemini returned a suggestion outside the safe limits. Please retry later.');
  }
  return saveSuggestion(admin, userId, sourceDay, {
    suggested: true, sourceDay, steps: sourceSteps, stepGoal, currentGoal,
    suggestedKcal, maxReduction,
    reason: String(parsed.reason || 'This small adjustment reflects the step total.').slice(0, 240),
    requiresConfirmation: true,
  });
}

async function saveSuggestion(admin: any, userId: string, sourceDay: string, suggestion: unknown) {
  const { error } = await admin.from('calorie_adjustment_suggestions')
    .update({ status: 'completed', suggestion, updated_at: new Date().toISOString() })
    .eq('user_id', userId).eq('source_day', sourceDay);
  if (error) throw new Error('Could not save the suggestion for review.');
  return json(suggestion);
}
