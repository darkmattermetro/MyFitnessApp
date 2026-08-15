// Almacenamiento local del modo demo.
// Replica el esquema de Supabase (users, food_entries, weight_entries,
// user_preferences) usando AsyncStorage (localStorage en web).
// El perfil del usuario (que contiene la API key de Gemini) va en
// SecureStore; el resto de datos demo en AsyncStorage.
// No hay persistencia remota: todo vive en el dispositivo/navegador.

import { storage, secureStorage } from './storage';

const KEYS = {
  user: 'demo:user',
  food: 'demo:food_entries',
  weight: 'demo:weight_entries',
  prefs: 'demo:user_preferences',
  seeded: 'demo:seeded',
};

export const DEMO_USER_ID = 'demo-user';

async function read(store, key, fallback) {
  try {
    const raw = await store.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function write(store, key, value) {
  await store.setItem(key, JSON.stringify(value));
}

function isoOffset(dias, horas = 0) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  d.setHours(d.getHours() - horas);
  return d.toISOString();
}

function foodSeed() {
  const hoy = new Date();
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  const antes = new Date();
  antes.setDate(antes.getDate() - 2);

  return [
    {
      id: 'seed-food-1',
      user_id: DEMO_USER_ID,
      fecha: hoy.toISOString(),
      texto_original: 'desayuné dos huevos revueltos y café con leche',
      items: [
        { nombre: 'huevo revuelto', cantidad: '2 unidades', kcal: 180, prot: 13, grasa: 13, carb: 1 },
        { nombre: 'café con leche', cantidad: '1 taza', kcal: 70, prot: 3, grasa: 3, carb: 6 },
      ],
      total_kcal: 250,
      created_at: hoy.toISOString(),
    },
    {
      id: 'seed-food-2',
      user_id: DEMO_USER_ID,
      fecha: hoy.toISOString(),
      texto_original: 'ensalada de pollo con aguacate',
      items: [
        { nombre: 'ensalada de pollo', cantidad: '1 plato', kcal: 420, prot: 35, grasa: 22, carb: 18 },
      ],
      total_kcal: 420,
      created_at: hoy.toISOString(),
    },
    {
      id: 'seed-food-3',
      user_id: DEMO_USER_ID,
      fecha: ayer.toISOString(),
      texto_original: 'un plato de avena con banano y miel',
      items: [
        { nombre: 'avena', cantidad: '1 taza', kcal: 250, prot: 9, grasa: 3, carb: 47 },
        { nombre: 'banano', cantidad: '1 unidad', kcal: 105, prot: 1, grasa: 0, carb: 27 },
        { nombre: 'miel', cantidad: '1 cucharada', kcal: 60, prot: 0, grasa: 0, carb: 17 },
      ],
      total_kcal: 415,
      created_at: ayer.toISOString(),
    },
    {
      id: 'seed-food-4',
      user_id: DEMO_USER_ID,
      fecha: antes.toISOString(),
      texto_original: 'pollo a la plancha con arroz y verduras',
      items: [
        { nombre: 'pollo a la plancha', cantidad: '150 g', kcal: 240, prot: 36, grasa: 8, carb: 0 },
        { nombre: 'arroz blanco', cantidad: '1 taza', kcal: 205, prot: 4, grasa: 0, carb: 45 },
        { nombre: 'verduras salteadas', cantidad: '1 porción', kcal: 80, prot: 3, grasa: 4, carb: 10 },
      ],
      total_kcal: 525,
      created_at: antes.toISOString(),
    },
  ];
}

function weightSeed() {
  const base = 84;
  const dias = 21;
  const rows = [];
  for (let i = dias - 1; i >= 0; i -= 3) {
    rows.push({
      id: `seed-weight-${i}`,
      user_id: DEMO_USER_ID,
      peso_kg: Math.round((base - (dias - 1 - i) * 0.18) * 10) / 10,
      measured_at: isoOffset(i, 8),
      created_at: isoOffset(i, 8),
    });
  }
  return rows;
}

function prefSeed() {
  return [
    {
      id: 'seed-pref-1',
      user_id: DEMO_USER_ID,
      texto: 'No como carnes rojas, solo pollo y pescado.',
      created_at: isoOffset(5),
    },
    {
      id: 'seed-pref-2',
      user_id: DEMO_USER_ID,
      texto: 'Prefiero porciones pequeñas en la cena.',
      created_at: isoOffset(3),
    },
  ];
}

export async function seedDemoIfNeeded() {
  const seeded = await read(storage, KEYS.seeded, false);
  if (seeded) return;

  try {
    await write(secureStorage, KEYS.user, {
      id: DEMO_USER_ID,
      objetivo_kcal: 2000,
      meta_peso_kg: 76,
      gemini_api_key: '',
      altura_cm: 175,
      sexo: 'hombre',
      edad: 28,
      nivel_actividad: 1.375,
      created_at: new Date().toISOString(),
    });
    await write(storage, KEYS.food, foodSeed());
    await write(storage, KEYS.weight, weightSeed());
    await write(storage, KEYS.prefs, prefSeed());
    await write(storage, KEYS.seeded, true);
  } catch {
    // Si falla el storage no bloqueamos el arranque de la app.
  }
}

export async function resetDemo() {
  await Promise.all(
    [
      storage.removeItem(KEYS.user),
      storage.removeItem(KEYS.food),
      storage.removeItem(KEYS.weight),
      storage.removeItem(KEYS.prefs),
      storage.removeItem(KEYS.seeded),
      secureStorage.removeItem(KEYS.user),
    ].map((p) => p.catch(() => {})),
  );
  await seedDemoIfNeeded();
}

export async function demoGetUser() {
  await seedDemoIfNeeded();
  return read(secureStorage, KEYS.user, null);
}

export async function demoSaveUser(user) {
  await write(secureStorage, KEYS.user, user);
  return user;
}

export async function demoGetFood() {
  await seedDemoIfNeeded();
  return read(storage, KEYS.food, []);
}

export async function demoSaveFood(rows) {
  await write(storage, KEYS.food, rows);
}

export async function demoGetWeight() {
  await seedDemoIfNeeded();
  return read(storage, KEYS.weight, []);
}

export async function demoSaveWeight(rows) {
  await write(storage, KEYS.weight, rows);
}

export async function demoGetPrefs() {
  await seedDemoIfNeeded();
  return read(storage, KEYS.prefs, []);
}

export async function demoSavePrefs(rows) {
  await write(storage, KEYS.prefs, rows);
}

export function nextId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}