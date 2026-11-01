// Supabase API (production). Screens never import this directly: they use the
// facade in ./api, which picks between this backend and the demo one.

import { supabase } from './supabaseClient';
import { config } from '../config';
import { getCurrentUserId } from './auth';
import { parseFoodConKey, mejorarPreferenciaConKey, describirImagenConKey, coachReplyConKey } from './gemini';
import { guessMealType } from '../utils/nutricion';

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
    .select('*')
    .eq('id', uid)
    .maybeSingle();
  if (error) throw error;
  return {
    id: uid,
    objetivo_kcal: 2000,
    meta_peso_kg: null,
    gemini_api_key: '',
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
  geminiApiKey,
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
      gemini_api_key: geminiApiKey ?? '',
      altura_cm: alturaCm ?? null,
      sexo: sexo ?? '',
      edad: edad ?? null,
      nivel_actividad: nivelActividad ?? 1.2,
      step_goal: stepGoal ?? 8000,
      water_goal: waterGoal ?? 8,
      goal_type: goalType ?? 'maintain',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---- Meals ----
export async function createFoodEntry({ texto, items, totalKcal, fecha, mealType }) {
  assertConfigured();
  const uid = await requireUserId();
  const { data, error } = await supabase
    .from('food_entries')
    .insert({
      user_id: uid,
      fecha: fecha.toISOString(),
      meal_type: mealType || guessMealType(fecha),
      texto_original: texto,
      items,
      total_kcal: totalKcal,
    })
    .select()
    .single();
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
}) {
  assertConfigured();
  const uid = await requireUserId();
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
    })
    .select()
    .single();
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
  };
}

export async function saveDailyActivity({ day, steps, water }) {
  assertConfigured();
  const uid = await requireUserId();
  const clean = {
    steps: Math.max(0, Math.round(Number(steps) || 0)),
    water: Math.max(0, Math.round(Number(water) || 0)),
  };
  const { data, error } = await supabase
    .from('daily_activity')
    .upsert(
      {
        user_id: uid,
        day,
        ...clean,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,day' },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
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

export async function deleteUserPreference(id) {
  assertConfigured();
  const { error } = await supabase
    .from('user_preferences')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ---- AI ----
export async function parseFood(texto) {
  assertConfigured();
  const user = await getUser();
  const prefs = await listUserPreferences();
  return parseFoodConKey(user.gemini_api_key, prefs, texto);
}

export async function describeFoodImage(base64, mimeType) {
  assertConfigured();
  const user = await getUser();
  const prefs = await listUserPreferences();
  return describirImagenConKey(user.gemini_api_key, prefs, base64, mimeType);
}

export async function mejorarPreferencia(texto) {
  assertConfigured();
  const user = await getUser();
  return mejorarPreferenciaConKey(user.gemini_api_key, texto);
}

export async function coachReply(context, messages) {
  assertConfigured();
  const user = await getUser();
  return coachReplyConKey(user.gemini_api_key, context, messages);
}
