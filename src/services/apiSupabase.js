// Supabase API (production). Screens never import this directly: they use the
// facade in ./api, which picks between this backend and the demo one.

import { supabase } from './supabaseClient';
import { config } from '../config';
import { getCurrentUserId } from './auth';
import { parseFoodConKey, mejorarPreferenciaConKey, analyzeFoodImageConKey, coachReplyConKey } from './gemini';
import { friendlyError } from '../utils/networkErrors.mjs';
import { guessMealType } from '../utils/nutricion';
import { readStoredGeminiKey, writeStoredGeminiKey, hasMigratedLegacyGeminiKey, markLegacyGeminiKeyMigrated } from './aiKeyStore';
import { ensureAIDataConsent } from './aiConsent';

function assertConfigured() {
  if (!config.supabaseUrl || config.supabaseUrl.startsWith('PEGA')) {
    throw new Error('Supabase is not configured. Fill in your .env file.');
  }
}

async function requireUserId() {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('You need to sign in first.');
  return uid;
}

// ---- User / profile ----
export async function getUser() {
  assertConfigured();
  const uid = await requireUserId();
  const { data, error } = await supabase
    .from('users')
    .select('id,objetivo_kcal,meta_peso_kg,altura_cm,sexo,edad,nivel_actividad,step_goal,water_goal,goal_type,created_at')
    .eq('id', uid)
    .maybeSingle();
  if (error) throw error;
  return {
    id: uid,
    objetivo_kcal: 2000,
    meta_peso_kg: null,
    altura_cm: null,
    sexo: '',
    edad: null,
    nivel_actividad: 1.2,
    step_goal: 8000,
    water_goal: 8,
    goal_type: 'maintain',
    ...(data ?? {}),
  };
}

export async function updateUser({
  objetivoKcal,
  metaPesoKg,
  alturaCm,
  sexo,
  edad,
  nivelActividad,
  stepGoal,
  waterGoal,
  goalType,
}) {
  assertConfigured();
  const uid = await requireUserId();
  const { data, error } = await supabase
    .from('users')
    .upsert({
      id: uid,
      objetivo_kcal: objetivoKcal,
      meta_peso_kg: metaPesoKg,
      altura_cm: alturaCm ?? null,
      sexo: sexo ?? '',
      edad: edad ?? null,
      nivel_actividad: nivelActividad ?? 1.2,
      step_goal: stepGoal ?? 8000,
      water_goal: waterGoal ?? 8,
      goal_type: goalType ?? 'maintain',
    })
    .select('id,objetivo_kcal,meta_peso_kg,altura_cm,sexo,edad,nivel_actividad,step_goal,water_goal,goal_type,created_at')
    .single();
  if (error) throw error;
  return data;
}

export async function getGeminiApiKey() {
  assertConfigured();
  const stored = await readStoredGeminiKey();
  if (await hasMigratedLegacyGeminiKey()) return stored;
  const { data: migrated, error: rpcError } = await supabase.rpc('migrate_gemini_api_key', { p_confirm_stored: false });
  if (!rpcError) {
    const key = String(migrated || '');
    if (key) await writeStoredGeminiKey(key);
    const { error: confirmError } = await supabase.rpc('migrate_gemini_api_key', { p_confirm_stored: true });
    if (confirmError) throw confirmError;
    await markLegacyGeminiKeyMigrated();
    return key || stored;
  }
  // Compatibility for accounts before migration 0009 is applied. Copy the
  // legacy BYOK secret locally, then clear the old column on that same row.
  const uid = await requireUserId();
  const { data, error } = await supabase.from('users').select('gemini_api_key').eq('id', uid).maybeSingle();
  if (error) throw error;
  const key = String(data?.gemini_api_key || '');
  if (key && !stored) await writeStoredGeminiKey(key);
  const { error: clearError } = await supabase.from('users').update({ gemini_api_key: '' }).eq('id', uid);
  if (clearError) throw clearError;
  await markLegacyGeminiKeyMigrated();
  return key || stored;
}

export async function setGeminiApiKey(value) {
  return writeStoredGeminiKey(value);
}

// ---- Meals ----
export async function createFoodEntry({ texto, items, totalKcal, fecha, mealType, clientRequestId }, signal) {
  assertConfigured();
  const uid = await requireUserId();
  if (clientRequestId) {
    const { data: prior, error: lookupError } = await supabase.from('food_entries').select('*')
      .eq('user_id', uid).eq('client_request_id', clientRequestId).maybeSingle();
    if (lookupError) throw lookupError;
    if (prior) return prior;
  }
  const { data, error } = await supabase
    .from('food_entries')
    .insert({
      user_id: uid,
      fecha: fecha.toISOString(),
      meal_type: mealType || guessMealType(fecha),
      texto_original: texto,
      items,
      total_kcal: totalKcal,
      client_request_id: clientRequestId ?? null,
    })
    .abortSignal(signal)
    .select()
    .single();
  if (error?.code === '23505' && clientRequestId) {
    const { data: prior, error: lookupError } = await supabase.from('food_entries').select('*')
      .eq('user_id', uid).eq('client_request_id', clientRequestId).maybeSingle();
    if (lookupError) throw lookupError;
    if (prior) return prior;
  }
  if (error) throw error;
  return data;
}

export async function listFoodEntries({ desde, hasta, limit, offset } = {}) {
  assertConfigured();
  const uid = await requireUserId();
  let query = supabase
    .from('food_entries')
    .select('*')
    .eq('user_id', uid)
    .order('fecha', { ascending: false });
  if (desde) query = query.gte('fecha', desde);
  if (hasta) query = query.lte('fecha', hasta);
  if (limit != null) {
    const start = offset || 0;
    const fetchN = limit + 1;
    query = query.range(start, start + fetchN - 1);
  }
  const { data, error } = await query;
  if (error) throw error;
  let rows = (data || []).map((row) => ({
    ...row,
    items: parseItems(row.items),
  }));
  if (limit != null) {
    const hasMore = rows.length > limit;
    rows = rows.slice(0, limit);
    return { data: rows, hasMore };
  }
  return rows;
}

function parseItems(items) {
  if (Array.isArray(items)) return items;
  if (typeof items === 'string') {
    try {
      const parsed = JSON.parse(items);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function updateFoodEntry(id, { texto, items, totalKcal, fecha, mealType }) {
  assertConfigured();
  const { data, error } = await supabase
    .from('food_entries')
    .update({
      fecha: fecha.toISOString(),
      meal_type: mealType || guessMealType(fecha),
      texto_original: texto,
      items,
      total_kcal: totalKcal,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFoodEntry(id) {
  assertConfigured();
  const { error } = await supabase
    .from('food_entries')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ---- Weight ----
export async function createWeightEntry({ pesoKg, measuredAt }) {
  assertConfigured();
  const uid = await requireUserId();
  const { data, error } = await supabase
    .from('weight_entries')
    .insert({
      user_id: uid,
      peso_kg: pesoKg,
      measured_at: measuredAt.toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listWeightEntries({ desde, hasta, limit, offset, asc = true } = {}) {
  assertConfigured();
  const uid = await requireUserId();
  let query = supabase
    .from('weight_entries')
    .select('*')
    .eq('user_id', uid)
    .order('measured_at', { ascending: asc });
  if (desde) query = query.gte('measured_at', desde);
  if (hasta) query = query.lte('measured_at', hasta);
  if (limit != null) {
    const start = offset || 0;
    const fetchN = limit + 1;
    query = query.range(start, start + fetchN - 1);
  }
  const { data, error } = await query;
  if (error) throw error;
  let rows = data || [];
  if (limit != null) {
    const hasMore = rows.length > limit;
    rows = rows.slice(0, limit);
    return { data: rows, hasMore };
  }
  return rows;
}

export async function deleteWeightEntry(id) {
  assertConfigured();
  const { error } = await supabase
    .from('weight_entries')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ---- Workouts ----
export async function createWorkoutSession({
  name,
  startedAt,
  endedAt,
  durationMin,
  notes,
  exercises,
  totalVolumeKg,
  totalSets,
  clientRequestId,
}, signal) {
  assertConfigured();
  const uid = await requireUserId();
  if (clientRequestId) {
    const { data: prior, error: lookupError } = await supabase.from('workout_sessions').select('*')
      .eq('user_id', uid).eq('client_request_id', clientRequestId).maybeSingle();
    if (lookupError) throw lookupError;
    if (prior) return prior;
  }
  const { data, error } = await supabase
    .from('workout_sessions')
    .insert({
      user_id: uid,
      name,
      started_at: startedAt.toISOString(),
      ended_at: endedAt ? endedAt.toISOString() : null,
      duration_min: durationMin ?? null,
      notes: notes ?? '',
      exercises,
      total_volume_kg: totalVolumeKg ?? 0,
      total_sets: totalSets ?? 0,
      client_request_id: clientRequestId ?? null,
    })
    .abortSignal(signal)
    .select()
    .single();
  if (error?.code === '23505' && clientRequestId) {
    const { data: prior, error: lookupError } = await supabase.from('workout_sessions').select('*')
      .eq('user_id', uid).eq('client_request_id', clientRequestId).maybeSingle();
    if (lookupError) throw lookupError;
    if (prior) return prior;
  }
  if (error) throw error;
  return data;
}

export async function listWorkoutSessions({ desde, hasta, limit, offset } = {}) {
  assertConfigured();
  const uid = await requireUserId();
  let query = supabase
    .from('workout_sessions')
    .select('*')
    .eq('user_id', uid)
    .order('started_at', { ascending: false });
  if (desde) query = query.gte('started_at', desde);
  if (hasta) query = query.lte('started_at', hasta);
  if (limit != null) {
    const start = offset || 0;
    const fetchN = limit + 1;
    query = query.range(start, start + fetchN - 1);
  }
  const { data, error } = await query;
  if (error) throw error;
  let rows = (data || []).map((row) => ({
    ...row,
    exercises: parseItems(row.exercises),
  }));
  if (limit != null) {
    const hasMore = rows.length > limit;
    rows = rows.slice(0, limit);
    return { data: rows, hasMore };
  }
  return rows;
}

export async function deleteWorkoutSession(id) {
  assertConfigured();
  const { error } = await supabase
    .from('workout_sessions')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ---- Daily activity (steps + water) ----
export async function getDailyActivity(day) {
  assertConfigured();
  const uid = await requireUserId();
  const { data, error } = await supabase
    .from('daily_activity')
    .select('*')
    .eq('user_id', uid)
    .eq('day', day)
    .maybeSingle();
  if (error) throw error;
  return {
    day,
    steps: Number(data?.steps) || 0,
    water: Number(data?.water) || 0,
    stepsProvider: data?.steps_provider == null ? null : Number(data.steps_provider) || 0,
    stepsManual: Number(data?.steps_manual) || 0,
    stepsAdjustment: Number(data?.steps_adjustment) || 0,
    stepsProviderSource: data?.steps_provider_source || null,
  };
}

export async function saveDailyActivity({ day, steps, water }) {
  return patchDailyActivity({ day, steps, water });
}

export async function patchDailyActivity({
  day,
  steps,
  water,
  stepsProvider,
  providerSource,
  stepsManualDelta,
  stepsAdjustmentDelta,
}) {
  assertConfigured();
  const { data, error } = await supabase.rpc('patch_daily_activity', {
    p_day: day,
    p_steps: steps == null ? null : Math.max(0, Math.round(Number(steps) || 0)),
    p_water: water == null ? null : Math.max(0, Math.round(Number(water) || 0)),
    p_steps_provider: stepsProvider == null ? null : Math.max(0, Math.round(Number(stepsProvider) || 0)),
    p_provider_source: providerSource ?? null,
    p_steps_manual_delta: stepsManualDelta == null ? null : Math.max(0, Math.round(Number(stepsManualDelta) || 0)),
    p_steps_adjustment_delta: stepsAdjustmentDelta == null ? null : Math.round(Number(stepsAdjustmentDelta) || 0),
  });
  if (error) throw error;
  return data;
}

export async function listDailyActivity({ desde, hasta } = {}) {
  assertConfigured();
  const uid = await requireUserId();
  let query = supabase.from('daily_activity').select('*').eq('user_id', uid).order('day', { ascending: true });
  if (desde) query = query.gte('day', desde);
  if (hasta) query = query.lte('day', hasta);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ---- User preferences for the AI ----
export async function listUserPreferences() {
  assertConfigured();
  const uid = await requireUserId();
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createUserPreference(texto) {
  assertConfigured();
  const uid = await requireUserId();
  const { data, error } = await supabase
    .from('user_preferences')
    .insert({ user_id: uid, texto })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateUserPreference(id, texto) {
  assertConfigured();
  const uid = await requireUserId();
  const { data, error } = await supabase
    .from('user_preferences')
    .update({ texto })
    .eq('id', id)
    .eq('user_id', uid)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteUserPreference(id) {
  assertConfigured();
  const uid = await requireUserId();
  const { error } = await supabase
    .from('user_preferences')
    .delete()
    .eq('id', id)
    .eq('user_id', uid);
  if (error) throw error;
}

// ---- AI ----
export async function parseFood(texto, signal) {
  assertConfigured();
  await ensureAIDataConsent();
  const apiKey = await getGeminiApiKey();
  const prefs = await listUserPreferences();
  return parseFoodConKey(apiKey, prefs, texto, signal);
}

export async function analyzeFoodImage(base64, mimeType, signal) {
  assertConfigured();
  await ensureAIDataConsent();
  const apiKey = await getGeminiApiKey();
  const prefs = await listUserPreferences();
  return analyzeFoodImageConKey(apiKey, prefs, base64, mimeType, signal);
}

export async function mejorarPreferencia(texto) {
  assertConfigured();
  await ensureAIDataConsent();
  const apiKey = await getGeminiApiKey();
  return mejorarPreferenciaConKey(apiKey, texto);
}

export async function coachReply(context, messages, signal) {
  assertConfigured();
  await ensureAIDataConsent();
  const apiKey = await getGeminiApiKey();
  return coachReplyConKey(apiKey, context, messages, signal);
}

export async function generateDailyCalorieSuggestion(sourceDay) {
  assertConfigured();
  await ensureAIDataConsent();
  await requireUserId();
  const { data, error } = await supabase.functions.invoke('suggest-next-day-calories', {
    body: { sourceDay },
  });
  if (error) throw new Error(friendlyError(error, 'Could not prepare a calorie suggestion.'));
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function listAchievements() {
  const uid = await requireUserId();
  const { data, error } = await supabase.from('user_achievements').select('*').eq('user_id', uid).order('unlocked_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function unlockAchievement(key, metadata = {}) {
  const uid = await requireUserId();
  const { error } = await supabase.from('user_achievements').upsert({ user_id: uid, achievement_key: key, metadata }, { onConflict: 'user_id,achievement_key', ignoreDuplicates: true });
  if (error) throw error;
  return listAchievements();
}

export async function listCalorieSuggestions() {
  const uid = await requireUserId();
  const { data, error } = await supabase.from('calorie_adjustment_suggestions')
    .select('source_day,status,suggestion,created_at,updated_at')
    .eq('user_id', uid).order('source_day', { ascending: false });
  if (error) throw error;
  return data || [];
}
