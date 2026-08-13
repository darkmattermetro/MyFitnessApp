// API contra Supabase (producción). Las pantallas no la importan directo:
// usan la fachada en ./api, que elige entre este backend y el demo.

import { supabase } from './supabaseClient';
import { config } from '../config';
import { getCurrentUserId } from './auth';
import { parseFoodConKey, mejorarPreferenciaConKey } from './gemini';

function assertConfigured() {
  if (!config.supabaseUrl || config.supabaseUrl.startsWith('PEGA')) {
    throw new Error('Supabase no configurado. Completa tu .env');
  }
}

async function requireUserId() {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Necesitás iniciar sesión.');
  return uid;
}

// ---- Usuario / perfil ----
export async function getUser() {
  assertConfigured();
  const uid = await requireUserId();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', uid)
    .maybeSingle();
  if (error) throw error;
  return (
    data ?? {
      id: uid,
      objetivo_kcal: 2000,
      meta_peso_kg: null,
      gemini_api_key: '',
      altura_cm: null,
      sexo: '',
      edad: null,
      nivel_actividad: 1.2,
    }
  );
}

export async function updateUser({
  objetivoKcal,
  metaPesoKg,
  geminiApiKey,
  alturaCm,
  sexo,
  edad,
  nivelActividad,
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
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---- Comidas ----
export async function createFoodEntry({ texto, items, totalKcal, fecha }) {
  assertConfigured();
  const uid = await requireUserId();
  const { data, error } = await supabase
    .from('food_entries')
    .insert({
      user_id: uid,
      fecha: fecha.toISOString(),
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

export async function updateFoodEntry(id, { texto, items, totalKcal, fecha }) {
  assertConfigured();
  const { data, error } = await supabase
    .from('food_entries')
    .update({
      fecha: fecha.toISOString(),
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

// ---- Pesos ----
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

// ---- Preferencias del usuario para la IA ----
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

// ---- IA ----
export async function parseFood(texto) {
  assertConfigured();
  const user = await getUser();
  const prefs = await listUserPreferences();
  return parseFoodConKey(user.gemini_api_key, prefs, texto);
}

export async function mejorarPreferencia(texto) {
  assertConfigured();
  const user = await getUser();
  return mejorarPreferenciaConKey(user.gemini_api_key, texto);
}