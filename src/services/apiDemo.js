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
  demoGetAchievements,
  demoUnlockAchievement,
} from './demoStorage';
import {
  parseFoodConKey,
  mejorarPreferenciaConKey,
  analyzeFoodImageConKey,
  coachReplyConKey,
} from './gemini';
import { guessMealType } from '../utils/nutricion';
import { readStoredGeminiKey, writeStoredGeminiKey, hasMigratedLegacyGeminiKey, markLegacyGeminiKeyMigrated } from './aiKeyStore';
import { ensureAIDataConsent } from './aiConsent';
import { getEffectiveSteps } from '../utils/stepReconciliation.mjs';
import { createSerializedQueue } from '../utils/serializedQueue.mjs';

const enqueueActivityPatch = createSerializedQueue();

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
  const { gemini_api_key: _legacyKey, ...profile } = user ?? {};
  return {
    ...profile,
    id: DEMO_USER_ID,
    objetivo_kcal: user?.objetivo_kcal ?? 2000,
    meta_peso_kg: user?.meta_peso_kg ?? null,
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
  const { gemini_api_key: _legacyKey, ...profile } = user ?? {};
  const updated = {
    ...profile,
    id: DEMO_USER_ID,
    objetivo_kcal: objetivoKcal,
    meta_peso_kg: metaPesoKg ?? null,
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

export async function getGeminiApiKey() {
  const stored = await readStoredGeminiKey();
  if (await hasMigratedLegacyGeminiKey()) return stored;
  const user = await demoGetUser();
  const legacyKey = String(user?.gemini_api_key || '');
  if (legacyKey && !stored) await writeStoredGeminiKey(legacyKey);
  if (user?.gemini_api_key) {
    const { gemini_api_key: _legacyKey, ...profile } = user;
    await demoSaveUser(profile);
  }
  await markLegacyGeminiKeyMigrated();
  return stored || legacyKey;
}

export async function setGeminiApiKey(value) {
  return writeStoredGeminiKey(value);
}

// ---- Meals ----
export async function createFoodEntry({ texto, items, totalKcal, fecha, mealType, clientRequestId }) {
  const rows = await demoGetFood();
  if (clientRequestId) {
    const prior = rows.find((row) => row.client_request_id === clientRequestId);
    if (prior) return prior;
  }
  const entry = {
    id: nextId('food'),
    user_id: DEMO_USER_ID,
    fecha: fecha.toISOString(),
    meal_type: mealType || guessMealType(fecha),
    texto_original: texto,
    items,
    total_kcal: totalKcal,
    client_request_id: clientRequestId ?? null,
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
  clientRequestId,
}) {
  const rows = await demoGetWorkouts();
  if (clientRequestId) {
    const prior = rows.find((row) => row.client_request_id === clientRequestId);
    if (prior) return prior;
  }
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
    client_request_id: clientRequestId ?? null,
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
    stepsProvider: row?.stepsProvider == null ? null : Number(row.stepsProvider) || 0,
    stepsManual: Number(row?.stepsManual ?? row?.steps) || 0,
    stepsAdjustment: Number(row?.stepsAdjustment) || 0,
    stepsProviderSource: row?.stepsProviderSource || null,
  };
}

export async function saveDailyActivity({ day, steps, water }) {
  const rows = await demoGetActivity();
  const idx = rows.findIndex((r) => String(r.day) === String(day));
  const clean = {
    steps: Math.max(0, Math.round(Number(steps) || 0)),
    water: Math.max(0, Math.round(Number(water) || 0)),
  };
  const provenance = {
    stepsProvider: null,
    stepsManual: clean.steps,
    stepsAdjustment: 0,
    stepsProviderSource: null,
  };
  if (idx === -1) {
    rows.push({
      id: nextId('activity'),
      user_id: DEMO_USER_ID,
      day,
      ...clean,
      ...provenance,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } else {
    rows[idx] = { ...rows[idx], ...clean, ...provenance, updated_at: new Date().toISOString() };
  }
  await demoSaveActivity(rows);
  return { day, ...clean };
}

export async function patchDailyActivity(patch = {}) {
  const { day, steps, water } = patch;
  const applyPatch = async () => {
    const rows = await demoGetActivity();
    const idx = rows.findIndex((row) => String(row.day) === String(day));
    const row = idx >= 0
      ? { ...rows[idx] }
      : { id: nextId('activity'), user_id: DEMO_USER_ID, day, steps: 0, stepsManual: 0, stepsProvider: null, stepsAdjustment: 0, water: 0 };
    if (patch.steps != null) {
      row.steps = Math.max(0, Math.round(Number(patch.steps) || 0));
      row.stepsManual = row.steps;
      row.stepsProvider = null;
      row.stepsAdjustment = 0;
      row.stepsProviderSource = null;
    }
    if (patch.stepsProvider != null) {
      row.stepsProvider = Math.max(0, Math.round(Number(patch.stepsProvider) || 0));
      row.stepsProviderSource = patch.providerSource || null;
    }
    if (patch.stepsManualDelta != null) {
      row.stepsManual = Math.max(0, (Number(row.stepsManual) || 0) + Math.round(Number(patch.stepsManualDelta) || 0));
    }
    if (patch.stepsAdjustmentDelta != null) {
      row.stepsAdjustment = (Number(row.stepsAdjustment) || 0) + Math.round(Number(patch.stepsAdjustmentDelta) || 0);
    }
    row.steps = getEffectiveSteps({
      stepsProvider: row.stepsProvider,
      stepsManual: row.stepsManual,
      stepsAdjustment: row.stepsAdjustment,
    });
    if (patch.water != null) row.water = Math.max(0, Math.round(Number(patch.water) || 0));
    row.updated_at = new Date().toISOString();
    if (idx < 0) rows.push(row);
    else rows[idx] = row;
    await demoSaveActivity(rows);
    return row;
  };
  return enqueueActivityPatch(applyPatch);
}

export async function listDailyActivity({ desde, hasta } = {}) {
  let rows = await demoGetActivity();
  if (desde) rows = rows.filter((row) => row.day >= desde);
  if (hasta) rows = rows.filter((row) => row.day <= hasta);
  return [...rows].sort((a, b) => a.day.localeCompare(b.day));
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
export async function parseFood(texto, signal) {
  await ensureAIDataConsent();
  const apiKey = await getGeminiApiKey();
  const prefs = await listUserPreferences();
  return parseFoodConKey(apiKey, prefs, texto, signal);
}

export async function analyzeFoodImage(base64, mimeType, signal) {
  await ensureAIDataConsent();
  const apiKey = await getGeminiApiKey();
  const prefs = await listUserPreferences();
  return analyzeFoodImageConKey(apiKey, prefs, base64, mimeType, signal);
}

export async function mejorarPreferencia(texto) {
  await ensureAIDataConsent();
  const apiKey = await getGeminiApiKey();
  return mejorarPreferenciaConKey(apiKey, texto);
}

export async function coachReply(context, messages, signal) {
  await ensureAIDataConsent();
  const apiKey = await getGeminiApiKey();
  return coachReplyConKey(apiKey, context, messages, signal);
}

export async function generateDailyCalorieSuggestion() {
  throw new Error('Step-based calorie suggestions require your signed-in online account and the configured server function.');
}

export async function listAchievements() { return demoGetAchievements(); }
export async function unlockAchievement(key, metadata) { return demoUnlockAchievement(key, metadata); }
export async function listCalorieSuggestions() { return []; }
