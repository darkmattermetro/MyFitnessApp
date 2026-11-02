// Local storage for demo mode.
// Mirrors the Supabase schema (users, food_entries, weight_entries,
// user_preferences, workout_sessions) using AsyncStorage (localStorage on web).
// The user profile (which holds the Gemini API key) lives in SecureStore;
// everything else stays in AsyncStorage.
// There is no remote persistence: all data lives on this device/browser.

import { storage, secureStorage } from './storage';
import { dayKey } from '../utils/dates';

const KEYS = {
  user: 'demo:user',
  food: 'demo:food_entries',
  weight: 'demo:weight_entries',
  prefs: 'demo:user_preferences',
  workouts: 'demo:workout_sessions',
  activity: 'demo:daily_activity',
  seeded: 'demo:seeded',
  achievements: 'demo:achievements',
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
  const at = (daysAgo, hour, minute = 0) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };

  return [
    {
      id: 'seed-food-1',
      user_id: DEMO_USER_ID,
      fecha: at(0, 8, 15),
      meal_type: 'breakfast',
      texto_original: 'two scrambled eggs and a coffee with milk',
      items: [
        { name: 'scrambled eggs', amount: '2 units', kcal: 180, protein: 13, fat: 13, carbs: 1 },
        { name: 'coffee with milk', amount: '1 cup', kcal: 70, protein: 3, fat: 3, carbs: 6 },
      ],
      total_kcal: 250,
      created_at: at(0, 8, 15),
    },
    {
      id: 'seed-food-2',
      user_id: DEMO_USER_ID,
      fecha: at(0, 13, 20),
      meal_type: 'lunch',
      texto_original: 'chicken salad with avocado',
      items: [
        { name: 'chicken salad', amount: '1 plate', kcal: 420, protein: 35, fat: 22, carbs: 18 },
      ],
      total_kcal: 420,
      created_at: at(0, 13, 20),
    },
    {
      id: 'seed-food-3',
      user_id: DEMO_USER_ID,
      fecha: at(1, 8, 40),
      meal_type: 'breakfast',
      texto_original: 'a bowl of oatmeal with banana and honey',
      items: [
        { name: 'oatmeal', amount: '1 cup', kcal: 250, protein: 9, fat: 3, carbs: 47 },
        { name: 'banana', amount: '1 unit', kcal: 105, protein: 1, fat: 0, carbs: 27 },
        { name: 'honey', amount: '1 tablespoon', kcal: 60, protein: 0, fat: 0, carbs: 17 },
      ],
      total_kcal: 415,
      created_at: at(1, 8, 40),
    },
    {
      id: 'seed-food-4',
      user_id: DEMO_USER_ID,
      fecha: at(2, 19, 30),
      meal_type: 'dinner',
      texto_original: 'grilled chicken with rice and vegetables',
      items: [
        { name: 'grilled chicken', amount: '150 g', kcal: 240, protein: 36, fat: 8, carbs: 0 },
        { name: 'white rice', amount: '1 cup', kcal: 205, protein: 4, fat: 0, carbs: 45 },
        { name: 'sauteed vegetables', amount: '1 serving', kcal: 80, protein: 3, fat: 4, carbs: 10 },
      ],
      total_kcal: 525,
      created_at: at(2, 19, 30),
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
      texto: 'No red meat, only chicken and fish.',
      created_at: isoOffset(5),
    },
    {
      id: 'seed-pref-2',
      user_id: DEMO_USER_ID,
      texto: 'I prefer smaller portions at dinner.',
      created_at: isoOffset(3),
    },
  ];
}

function workoutSeed() {
  return [
    {
      id: 'seed-workout-1',
      user_id: DEMO_USER_ID,
      name: 'Push Day',
      started_at: isoOffset(1, 1),
      ended_at: isoOffset(1, 0),
      duration_min: 58,
      notes: '',
      exercises: [
        {
          id: 'seed-ex-1',
          name: 'Bench Press',
          muscle: 'chest',
          sets: [
            { weight: 60, reps: 10 },
            { weight: 70, reps: 8 },
            { weight: 70, reps: 7 },
          ],
        },
        {
          id: 'seed-ex-2',
          name: 'Overhead Press',
          muscle: 'shoulders',
          sets: [
            { weight: 35, reps: 10 },
            { weight: 40, reps: 8 },
          ],
        },
        {
          id: 'seed-ex-3',
          name: 'Triceps Pushdown',
          muscle: 'arms',
          sets: [
            { weight: 25, reps: 12 },
            { weight: 25, reps: 12 },
          ],
        },
      ],
      total_volume_kg: 2655,
      total_sets: 7,
      created_at: isoOffset(1, 1),
    },
    {
      id: 'seed-workout-2',
      user_id: DEMO_USER_ID,
      name: 'Leg Day',
      started_at: isoOffset(3, 2),
      ended_at: isoOffset(3, 1),
      duration_min: 64,
      notes: 'Felt strong on squats.',
      exercises: [
        {
          id: 'seed-ex-4',
          name: 'Back Squat',
          muscle: 'legs',
          sets: [
            { weight: 80, reps: 8 },
            { weight: 90, reps: 6 },
            { weight: 90, reps: 6 },
          ],
        },
        {
          id: 'seed-ex-5',
          name: 'Romanian Deadlift',
          muscle: 'legs',
          sets: [
            { weight: 70, reps: 10 },
            { weight: 70, reps: 10 },
          ],
        },
      ],
      total_volume_kg: 3400,
      total_sets: 5,
      created_at: isoOffset(3, 2),
    },
    {
      id: 'seed-workout-3',
      user_id: DEMO_USER_ID,
      name: 'Pull Day',
      started_at: isoOffset(5, 3),
      ended_at: isoOffset(5, 2),
      duration_min: 51,
      notes: '',
      exercises: [
        {
          id: 'seed-ex-6',
          name: 'Deadlift',
          muscle: 'back',
          sets: [
            { weight: 100, reps: 6 },
            { weight: 110, reps: 5 },
          ],
        },
        {
          id: 'seed-ex-7',
          name: 'Lat Pulldown',
          muscle: 'back',
          sets: [
            { weight: 50, reps: 12 },
            { weight: 55, reps: 10 },
          ],
        },
      ],
      total_volume_kg: 2360,
      total_sets: 4,
      created_at: isoOffset(5, 3),
    },
  ];
}

function activitySeed() {
  const rows = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    rows.push({
      id: `seed-activity-${dayKey(date)}`,
      user_id: DEMO_USER_ID,
      day: dayKey(date),
      steps: i === 0 ? 6420 : 4000 + ((i * 1730) % 5000),
      water: i === 0 ? 4 : 3 + (i % 5),
      created_at: date.toISOString(),
      updated_at: date.toISOString(),
    });
  }
  return rows;
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
      sexo: 'male',
      edad: 28,
      nivel_actividad: 1.375,
      step_goal: 8000,
      water_goal: 8,
      goal_type: 'lose',
      created_at: new Date().toISOString(),
    });
    await write(storage, KEYS.food, foodSeed());
    await write(storage, KEYS.weight, weightSeed());
    await write(storage, KEYS.prefs, prefSeed());
    await write(storage, KEYS.workouts, workoutSeed());
    await write(storage, KEYS.activity, activitySeed());
    await write(storage, KEYS.seeded, true);
  } catch {
    // If storage fails we do not block app startup.
  }
}

export async function resetDemo() {
  await Promise.all(
    [
      storage.removeItem(KEYS.user),
      storage.removeItem(KEYS.food),
      storage.removeItem(KEYS.weight),
      storage.removeItem(KEYS.prefs),
      storage.removeItem(KEYS.workouts),
      storage.removeItem(KEYS.activity),
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

export async function demoGetWorkouts() {
  await seedDemoIfNeeded();
  return read(storage, KEYS.workouts, []);
}

export async function demoSaveWorkouts(rows) {
  await write(storage, KEYS.workouts, rows);
}

export async function demoGetActivity() {
  await seedDemoIfNeeded();
  return read(storage, KEYS.activity, []);
}

export async function demoSaveActivity(rows) {
  await write(storage, KEYS.activity, rows);
}

export async function demoGetAchievements() {
  return read(storage, KEYS.achievements, []);
}

export async function demoUnlockAchievement(key, metadata = {}) {
  const current = await demoGetAchievements();
  if (current.some((item) => item.achievement_key === key)) return current;
  const next = [...current, { achievement_key: key, unlocked_at: new Date().toISOString(), metadata }];
  await write(storage, KEYS.achievements, next);
  return next;
}

export function nextId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
