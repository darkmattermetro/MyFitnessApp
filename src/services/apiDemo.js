// API en modo demo: misma interfaz que apiSupabase pero con datos locales
// (AsyncStorage → localStorage en web). No hay base de datos remota.
// La IA (Gemini) sigue funcionando con la key del usuario guardada localmente.

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
} from './demoStorage';
import { parseFoodConKey, mejorarPreferenciaConKey } from './gemini';

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

// ---- Usuario / perfil ----
export async function getUser() {
  await seedDemoIfNeeded();
  const user = await demoGetUser();
  return (
    user ?? {
      id: DEMO_USER_ID,
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
  };
  return demoSaveUser(updated);
}

// ---- Comidas ----
export async function createFoodEntry({ texto, items, totalKcal, fecha }) {
  const rows = await demoGetFood();
  const entry = {
    id: nextId('food'),
    user_id: DEMO_USER_ID,
    fecha: fecha.toISOString(),
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

export async function updateFoodEntry(id, { texto, items, totalKcal, fecha }) {
  const rows = await demoGetFood();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error('La comida no existe.');
  rows[idx] = {
    ...rows[idx],
    fecha: fecha.toISOString(),
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

// ---- Pesos ----
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

// ---- Preferencias del usuario para la IA ----
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

// ---- IA ----
export async function parseFood(texto) {
  const user = await getUser();
  const prefs = await listUserPreferences();
  return parseFoodConKey(user.gemini_api_key, prefs, texto);
}

export async function mejorarPreferencia(texto) {
  const user = await getUser();
  return mejorarPreferenciaConKey(user.gemini_api_key, texto);
}