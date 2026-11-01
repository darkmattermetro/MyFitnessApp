// Demo-mode API: same interface as apiSupabase but backed by local data
// (AsyncStorage → localStorage on web). No remote database.
// The AI (Gemini) still works with the user's key stored locally.

import { DEMO_USER_ID, nextId, seedDemoIfNeeded } from './demoStorage';
import {
  demoGetUser,
  demoSaveUser,
  demoGetFood,
  demoSaveFood,
  demoGetWeight,
  demoSaveWeight,
  demoGetPrefs,
  demoSavePrefs,
  demoGetWorkouts,
  demoSaveWorkouts,
  demoGetActivity,
  demoSaveActivity,
} from './demoStorage';
import {
  parseFoodConKey,
  mejorarPreferenciaConKey,
  describirImagenConKey,
  coachReplyConKey,
} from './gemini';
import { guessMealType } from '../utils/nutricion';

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

// ---- User / profile ----
export async function getUser() {
  await seedDemoIfNeeded();
  const user = await demoGetUser();
  return {
    ...(user ?? {}),
    id: DEMO_USER_ID,
    objetivo_kcal: user?.objetivo_kcal ?? 2000,
    meta_peso_kg: user?.meta_peso_kg ?? null,
    gemini_api_key: user?.gemini_api_key ?? '',
    altura_cm: user?.altura_cm ?? null,
    sexo: user?.sexo ?? '',
    edad: user?.edad ?? null,
    nivel_actividad: user?.nivel_actividad ?? 1.2,
    step_goal: user?.step_goal ?? 8000,
    water_goal: user?.water_goal ?? 8,
    goal_type: user?.goal_type ?? 'maintain',
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
  await seedDemoIfNeeded();
  const user = await demoGetUser();
  const updated = {
    ...(user ?? {}),
    id: DEMO_USER_ID,
    objetivo_kcal: objetivoKcal,
    meta_peso_kg: metaPesoKg ?? null,
    gemini_api_key: geminiApiKey ?? '',
    altura_cm: alturaCm ?? null,
    sexo: sexo ?? '',
    edad: edad ?? null,
    nivel_actividad: nivelActividad ?? 1.2,
    step_goal: stepGoal ?? user?.step_goal ?? 8000,
    water_goal: waterGoal ?? user?.water_goal ?? 8,
    goal_type: goalType ?? user?.goal_type ?? 'maintain',
  };
  return demoSaveUser(updated);
}

// ---- Meals ----
export async function createFoodEntry({ texto, items, totalKcal, fecha, mealType }) {
  const rows = await demoGetFood();
  const entry = {
    id: nextId('food'),
    user_id: DEMO_USER_ID,
    fecha: fecha.toISOString(),
    meal_type: mealType || guessMealType(fecha),
    texto_original: texto,
    items,
    total_kcal: totalKcal,
    created_at: new Date().toISOString(),
  };
  await demoSaveFood([entry, ...rows]);
  return entry;
}

export async function listFoodEntries({ desde, hasta, limit, offset } = {}) {
  let rows = await demoGetFood();
  if (desde) rows = rows.filter((r) => r.fecha >= desde);
  if (hasta) rows = rows.filter((r) => r.fecha <= hasta);
  rows = [...rows].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  const mapped = rows.map((row) => ({ ...row, items: parseItems(row.items) }));
  if (limit != null) {
    const start = offset || 0;
    const hasMore = mapped.length > start + limit;
    return { data: mapped.slice(start, start + limit), hasMore };
  }
  return mapped;
}

export async function updateFoodEntry(id, { texto, items, totalKcal, fecha, mealType }) {
  const rows = await demoGetFood();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error('That meal no longer exists.');
  rows[idx] = {
    ...rows[idx],
    fecha: fecha.toISOString(),
    meal_type: mealType || rows[idx].meal_type || guessMealType(fecha),
    texto_original: texto,
    items,
    total_kcal: totalKcal,
  };
  await demoSaveFood(rows);
  return rows[idx];
}

export async function deleteFoodEntry(id) {
  const rows = await demoGetFood();
  await demoSaveFood(rows.filter((r) => r.id !== id));
}

// ---- Weight ----
export async function createWeightEntry({ pesoKg, measuredAt }) {
  const rows = await demoGetWeight();
  const entry = {
    id: nextId('weight'),
    user_id: DEMO_USER_ID,
    peso_kg: pesoKg,
    measured_at: measuredAt.toISOString(),
    created_at: new Date().toISOString(),
  };
  await demoSaveWeight([entry, ...rows]);
  return entry;
}

export async function listWeightEntries({ desde, hasta, limit, offset, asc = true } = {}) {
  let rows = await demoGetWeight();
  if (desde) rows = rows.filter((r) => r.measured_at >= desde);
  if (hasta) rows = rows.filter((r) => r.measured_at <= hasta);
  rows = [...rows].sort((a, b) =>
    asc ? (a.measured_at < b.measured_at ? -1 : 1) : a.measured_at < b.measured_at ? 1 : -1,
  );
  if (limit != null) {
    const start = offset || 0;
    const hasMore = rows.length > start + limit;
    return { data: rows.slice(start, start + limit), hasMore };
  }
  return rows;
}

export async function deleteWeightEntry(id) {
  const rows = await demoGetWeight();
  await demoSaveWeight(rows.filter((r) => r.id !== id));
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
  const rows = await demoGetWorkouts();
  const entry = {
    id: nextId('workout'),
    user_id: DEMO_USER_ID,
    name,
    started_at: startedAt.toISOString(),
    ended_at: endedAt ? endedAt.toISOString() : null,
    duration_min: durationMin ?? null,
    notes: notes ?? '',
    exercises,
    total_volume_kg: totalVolumeKg ?? 0,
    total_sets: totalSets ?? 0,
    created_at: new Date().toISOString(),
  };
  await demoSaveWorkouts([entry, ...rows]);
  return entry;
}

export async function listWorkoutSessions({ desde, hasta, limit, offset } = {}) {
  let rows = await demoGetWorkouts();
  if (desde) rows = rows.filter((r) => r.started_at >= desde);
  if (hasta) rows = rows.filter((r) => r.started_at <= hasta);
  rows = [...rows].sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
  if (limit != null) {
    const start = offset || 0;
    const hasMore = rows.length > start + limit;
    return { data: rows.slice(start, start + limit), hasMore };
  }
  return rows;
}

export async function deleteWorkoutSession(id) {
  const rows = await demoGetWorkouts();
  await demoSaveWorkouts(rows.filter((r) => r.id !== id));
}

// ---- Daily activity (steps + water) ----
export async function getDailyActivity(day) {
  const rows = await demoGetActivity();
  const row = rows.find((r) => String(r.day) === String(day));
  return {
    day,
    steps: Number(row?.steps) || 0,
    water: Number(row?.water) || 0,
  };
}

export async function saveDailyActivity({ day, steps, water }) {
  const rows = await demoGetActivity();
  const idx = rows.findIndex((r) => String(r.day) === String(day));
  const clean = {
    steps: Math.max(0, Math.round(Number(steps) || 0)),
    water: Math.max(0, Math.round(Number(water) || 0)),
  };
  if (idx === -1) {
    rows.push({
      id: nextId('activity'),
      user_id: DEMO_USER_ID,
      day,
      ...clean,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } else {
    rows[idx] = { ...rows[idx], ...clean, updated_at: new Date().toISOString() };
  }
  await demoSaveActivity(rows);
  return { day, ...clean };
}

// ---- User preferences for the AI ----
export async function listUserPreferences() {
  const rows = await demoGetPrefs();
  return [...rows].sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
}

export async function createUserPreference(texto) {
  const rows = await demoGetPrefs();
  const pref = {
    id: nextId('pref'),
    user_id: DEMO_USER_ID,
    texto,
    created_at: new Date().toISOString(),
  };
  await demoSavePrefs([...rows, pref]);
  return pref;
}

export async function deleteUserPreference(id) {
  const rows = await demoGetPrefs();
  await demoSavePrefs(rows.filter((r) => r.id !== id));
}

// ---- AI ----
export async function parseFood(texto) {
  const user = await getUser();
  const prefs = await listUserPreferences();
  return parseFoodConKey(user.gemini_api_key, prefs, texto);
}

export async function describeFoodImage(base64, mimeType) {
  const user = await getUser();
  const prefs = await listUserPreferences();
  return describirImagenConKey(user.gemini_api_key, prefs, base64, mimeType);
}

export async function mejorarPreferencia(texto) {
  const user = await getUser();
  return mejorarPreferenciaConKey(user.gemini_api_key, texto);
}

export async function coachReply(context, messages) {
  const user = await getUser();
  return coachReplyConKey(user.gemini_api_key, context, messages);
}
