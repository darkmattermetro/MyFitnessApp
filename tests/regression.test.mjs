import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateNutritionItems } from '../src/utils/nutritionValidation.mjs';
import { getEffectiveSteps } from '../src/utils/stepReconciliation.mjs';
import { buildExportPayload } from '../src/utils/dataExport.mjs';
import { createSerializedQueue } from '../src/utils/serializedQueue.mjs';
import { createDeadlineFetch } from '../src/utils/deadlineFetch.mjs';
import { bmiInterpretation, healthyWeightRange, waistToHeightRatio } from '../src/utils/nutricion.js';
import {
  coerceNutritionItems,
  extractResponseText,
  parseJsonTolerant,
  toItemList,
} from '../src/services/gemini.js';
import {
  DIET_PREFERENCE_PREFIX,
  DIET_PRESETS,
  dietTextForPreset,
  findDietPreference,
  isDietPreference,
  presetForDietText,
} from '../src/utils/dietPreference.mjs';
import {
  NO_INTERNET,
  SERVER_UNAVAILABLE,
  TIMEOUT,
  friendlyError,
  isOfflineError,
  isTimeoutError,
  isUnavailableError,
} from '../src/utils/networkErrors.mjs';

const validFood = () => ({
  name: 'dal and rice',
  amount: '1 bowl',
  kcal: 380,
  protein: 16,
  fat: 8,
  carbs: 61,
  note: 'Estimate',
});

test('BMI guidance includes adult screening context, Asian thresholds, healthy-weight range, and waist ratio', () => {
  assert.equal(bmiInterpretation(17.2).tone, 'warning');
  assert.equal(bmiInterpretation(24.2).category, 'Within the standard adult range');
  assert.match(bmiInterpretation(24.2, true).category, /Asian screening threshold/);
  assert.match(bmiInterpretation(31).detail, /screening result/i);
  assert.deepEqual(healthyWeightRange(170), { minKg: 53.5, maxKg: 72 });
  assert.deepEqual(waistToHeightRatio(80, 170), { value: 0.47, category: 'Below 0.5' });
  assert.equal(waistToHeightRatio(0, 170), null);
});

test('accepts finite, nonnegative nutrition data and normalizes numbers', () => {
  const result = validateNutritionItems([{ ...validFood(), kcal: '380.4' }]);
  assert.equal(result.valid, true);
  assert.equal(result.items[0].kcal, 380.4);
});

test('rejects negative, missing, non-finite and implausible nutrition values', () => {
  for (const patch of [
    { kcal: -1 },
    { protein: undefined },
    { fat: Number.NaN },
    { carbs: Number.POSITIVE_INFINITY },
    { kcal: 5001 },
    { protein: 501 },
    { amount: '' },
  ]) {
    const result = validateNutritionItems([{ ...validFood(), ...patch }]);
    assert.equal(result.valid, false, JSON.stringify(patch));
    assert.equal(result.items.length, 0);
  }
});

test('treats calorie and macro mismatch as a review warning, not a rejection', () => {
  const result = validateNutritionItems([{ ...validFood(), kcal: 200, fat: 80 }]);
  assert.equal(result.valid, true);
  assert.ok(result.warnings.length > 0);
});

test('Gemini response text skips thought parts and keeps the final answer', () => {
  const payload = {
    candidates: [{
      content: {
        parts: [
          { text: 'Let me think about the meal...', thought: true },
          { text: '{"items":[' },
          { text: '{"name":"egg","amount":"2","kcal":143,"protein":12.6,"fat":9.5,"carbs":0.7}]}' },
        ],
      },
    }],
  };
  assert.equal(
    extractResponseText(payload),
    '{"items":[{"name":"egg","amount":"2","kcal":143,"protein":12.6,"fat":9.5,"carbs":0.7}]}',
  );
  assert.equal(extractResponseText({ candidates: [{ content: { parts: [{ text: 'hi', thought: true }] } }] }), '');
  assert.equal(extractResponseText(null), '');
});

test('Gemini JSON parsing accepts arrays, renamed envelopes and truncated tails', () => {
  const bareArray = parseJsonTolerant('[{"name":"egg","amount":"1","kcal":70,"protein":6,"fat":5,"carbs":0.5}]');
  assert.equal(toItemList(bareArray).length, 1);

  const renamed = parseJsonTolerant('{"foods":[{"name":"rice","amount":"1 bowl","kcal":200,"protein":4,"fat":1,"carbs":44}]}');
  assert.equal(toItemList(renamed)[0].name, 'rice');

  const fenced = parseJsonTolerant('```json\n{"items":[{"name":"apple","amount":"1","kcal":95,"protein":0.5,"fat":0.3,"carbs":25}]}\n```');
  assert.equal(toItemList(fenced)[0].name, 'apple');

  // The model stopped mid-way through the fourth item.
  const truncated = parseJsonTolerant(
    '{"items":['
    + '{"name":"egg","amount":"2","kcal":143,"protein":12.6,"fat":9.5,"carbs":0.7},'
    + '{"name":"toast","amount":"1 slice","kcal":80,"protein":3,"fat":1,"carbs":14},'
    + '{"name":"milk","amount":"1 glass","kcal":110,"protein":8,"fat":4,"carbs":1'
    + ']}',
  );
  const salvaged = toItemList(truncated);
  assert.equal(salvaged.length, 2);
  assert.equal(salvaged[1].name, 'toast');
});

test('Gemini items are repaired before validation so 3-4 foods succeed together', () => {
  const aiItems = [
    // Amount dropped by the model.
    { name: 'egg', kcal: '143 kcal', protein: '12.6 g', fat: '9.5 g', carbs: '0.7 g' },
    // One macro dropped but calories are present, so it can be inferred.
    { name: 'toast', amount: '1 slice', kcal: 80, protein: 3, carbs: 14 },
    // Calories dropped but all macros are present.
    { nombre: 'milk', cantidad: '1 glass', protein: 8, fat: 4, carbs: 12 },
    // Alternative key names and a thousands separator.
    { name: 'paneer curry', amount: '1 bowl', calories: '1,200', protein_g: 30, fat_g: 80, carbohydrates: 40 },
  ];

  const prepared = coerceNutritionItems(aiItems);
  assert.equal(prepared[0].amount, '1 serving');
  assert.equal(prepared[0].kcal, 143);
  assert.equal(prepared[1].fat, 1.3, 'unknown macro inferred from remaining calories');
  assert.equal(prepared[2].kcal, 116, 'calories derived from macros');
  assert.equal(prepared[3].kcal, 1200);
  assert.equal(prepared[3].carbs, 40);

  const result = validateNutritionItems(prepared);
  assert.equal(result.valid, true, result.issues.join('; '));
  assert.equal(result.items.length, 4);
  assert.ok(result.items.every((item) => item.name && item.amount));
});

test('uses provider totals without adding overlapping phone sensor steps twice', () => {
  assert.equal(getEffectiveSteps({ stepsProvider: 7000, stepsManual: 4000, stepsAdjustment: 100 }), 7100);
  assert.equal(getEffectiveSteps({ stepsProvider: null, stepsManual: 4000, stepsAdjustment: 100 }), 4100);
  assert.equal(getEffectiveSteps({ stepsProvider: 50, stepsAdjustment: -100 }), 0);
});

test('exports all relevant records with units and no credentials', () => {
  const payload = buildExportPayload({
    profile: { objetivo_kcal: 1800, gemini_api_key: 'must-not-export', access_token: 'private' },
    meals: [{ id: 'meal' }],
    weightEntries: [{ peso_kg: 71 }],
    workouts: [{ id: 'workout' }],
    dailyActivity: [{ steps: 7000, water: 5 }],
    foodPreferences: [{ texto: 'vegetarian' }],
    achievements: [{ achievement_key: 'steps_goal_1', private: { service_role_key: 'nested-secret' } }],
  }, '2026-11-02T00:00:00.000Z', 'Asia/Kolkata');
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.profile.gemini_api_key, undefined);
  assert.equal(payload.profile.access_token, undefined);
  assert.equal(payload.achievements[0].private.service_role_key, undefined);
  assert.equal(payload.units.weight, 'kg');
  assert.equal(payload.timezone, 'Asia/Kolkata');
  assert.equal(payload.dailyActivity[0].water, 5);
  assert.equal(payload.achievements.length, 1);
});

test('serializes concurrent local step and water patches without dropping either field', async () => {
  const enqueue = createSerializedQueue();
  let row = { steps: 0, water: 0 };
  const patch = (field, value, wait) => enqueue(async () => {
    const snapshot = { ...row };
    await new Promise((resolve) => setTimeout(resolve, wait));
    row = { ...snapshot, [field]: value };
  });
  await Promise.all([patch('steps', 9000, 10), patch('water', 4, 0)]);
  assert.deepEqual(row, { steps: 9000, water: 4 });
});

test('database migrations include atomic field patches, owner policies, and idempotency keys', async () => {
  const privacy = await readFile(new URL('../supabase/migrations/0009_privacy_and_validation.sql', import.meta.url), 'utf8');
  const source = await readFile(new URL('../supabase/migrations/0010_step_provenance.sql', import.meta.url), 'utf8');
  const idempotency = await readFile(new URL('../supabase/migrations/0012_idempotent_submissions.sql', import.meta.url), 'utf8');
  const deletion = await readFile(new URL('../supabase/functions/delete-account/index.ts', import.meta.url), 'utf8');
  assert.match(privacy, /create policy "own food"/i);
  assert.match(privacy, /delete_my_account_data/);
  assert.match(source, /on conflict \(user_id, day\) do update/i);
  assert.match(source, /water = case when p_water is null then daily_activity\.water/i);
  assert.match(source, /steps_provider_source/);
  assert.match(idempotency, /unique index.*food_entries_user_request_uidx/is);
  assert.match(idempotency, /unique index.*workout_sessions_user_request_uidx/is);
  assert.match(deletion, /userClient\.auth\.getUser/);
  assert.match(deletion, /delete_my_account_data/);
});

test('network deadlines stop stalled requests and preserve caller cancellation', async () => {
  const stalledFetch = (_input, { signal }) => new Promise((_resolve, reject) => {
    const abort = () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    };
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
  const timed = createDeadlineFetch({ timeoutMs: 10, fetchImpl: stalledFetch });
  await assert.rejects(timed('/slow'), /took too long/);

  const slowBodyFetch = (_input, { signal }) => Promise.resolve({
    body: {},
    text: () => new Promise((_resolve, reject) => {
      const abort = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      if (signal.aborted) abort();
      else signal.addEventListener('abort', abort, { once: true });
    }),
  });
  const bodyTimed = createDeadlineFetch({ timeoutMs: 10, fetchImpl: slowBodyFetch });
  const response = await bodyTimed('/slow-body');
  await assert.rejects(response.text(), /took too long/);

  const caller = new AbortController();
  const cancellable = createDeadlineFetch({ timeoutMs: 1000, fetchImpl: stalledFetch });
  const pending = cancellable('/cancel', { signal: caller.signal });
  caller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});

test('food and workout retries reuse unique idempotency keys', async () => {
  const [foodApi, workoutApi, mealScreen, workoutScreen, migration] = await Promise.all([
    readFile(new URL('../src/services/apiSupabase.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/apiSupabase.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/screens/RegistrarComidaScreen.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/screens/WorkoutScreen.js', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/migrations/0012_idempotent_submissions.sql', import.meta.url), 'utf8'),
  ]);
  assert.match(foodApi, /eq\('client_request_id', clientRequestId\)/);
  assert.match(foodApi, /\.abortSignal\(signal\)/);
  assert.match(workoutApi, /clientRequestId,\s*\}, signal\)/);
  assert.match(mealScreen, /clientRequestId: requestIdRef\.current/);
  assert.match(workoutScreen, /clientRequestId: active\.id/);
  assert.match(migration, /unique index.*food_entries_user_request_uidx/is);
  assert.match(migration, /unique index.*workout_sessions_user_request_uidx/is);
});

test('owner policies and account deletion cover every user-owned table', async () => {
  const [privacy, suggestions, deletion, calorieFunction] = await Promise.all([
    readFile(new URL('../supabase/migrations/0009_privacy_and_validation.sql', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/migrations/0011_calorie_suggestions.sql', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/functions/delete-account/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/functions/suggest-next-day-calories/index.ts', import.meta.url), 'utf8'),
  ]);
  for (const policy of ['own users', 'own food', 'own weight', 'own preferences', 'own workouts', 'own activity']) {
    assert.ok(privacy.includes(`create policy "${policy}"`), `missing owner policy: ${policy}`);
  }
  assert.match(privacy, /read own achievements[\s\S]*?auth\.uid\(\) = user_id/i);
  assert.match(suggestions, /read own calorie suggestions[\s\S]*?auth\.uid\(\) = user_id/i);
  assert.match(deletion, /userClient\.auth\.getUser\(\)/);
  assert.match(deletion, /userClient\.rpc\('delete_my_account_data'\)/);
  assert.match(deletion, /await walk\(userId, 0\)/);
  assert.match(deletion, /admin\.auth\.admin\.deleteUser\(user\.id\)/);
  assert.match(calorieFunction, /steps_provider_source !== 'health_connect'/);
});

test('AI chat composer supports multiline writing, Android keyboard resizing, cancellation, and retries', async () => {
  const [modal, api, gemini] = await Promise.all([
    readFile(new URL('../src/components/CoachModal.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/apiSupabase.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/gemini.js', import.meta.url), 'utf8'),
  ]);
  assert.match(modal, /submitBehavior="newline"/);
  assert.match(modal, /Platform\.OS === 'android' \? 'height'/);
  assert.match(modal, /styles\.avoider/);
  assert.match(modal, /useSafeAreaInsets/);
  assert.match(modal, /scrollToEnd/);
  assert.match(modal, /visualViewport/);
  assert.match(modal, /event\.nativeEvent\.key === 'Enter'/);
  assert.match(modal, /Shift\+Enter for a new line/);
  assert.match(modal, /Retry message/);
  assert.match(modal, /coachReply\(context, history, controller\.signal\)/);
  assert.match(api, /coachReplyConKey\(apiKey, context, messages, signal\)/);
  assert.match(gemini, /callGemini\(apiKey, prompt, undefined, false, signal\)/);
});

test('Gemini API-key entry is an explicit secure save and does not trigger profile auto-save while typing', async () => {
  const [profile, input] = await Promise.all([
    readFile(new URL('../src/screens/PerfilScreen.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/ui.js', import.meta.url), 'utf8'),
  ]);
  assert.match(profile, /const saveApiKey = async \(\) =>/);
  assert.match(profile, /<PasswordInput/);
  assert.match(profile, /Save API key/);
  assert.doesNotMatch(profile, /keyboardType="visible-password"/);
  assert.doesNotMatch(profile, /\[objetivoKcal, metaPeso, apiKey,/);
  assert.doesNotMatch(profile, /const guardar = async \(overrides = \{\}\) => \{\s*try \{\s*await setGeminiApiKey/s);
  assert.match(input, /secureTextEntry=\{secureTextEntry && !visible\}/);
  assert.match(input, /onPressIn=\{\(\) => setVisible\(\(v\) => !v\)\}/);
  assert.match(input, /accessibilityLabel=\{visible \? 'Hide value' : 'Show value'\}/);
});

test('diet preference presets round-trip and stay identifiable among AI preferences', () => {
  assert.deepEqual(
    DIET_PRESETS.map((preset) => preset.value),
    ['indian_veg', 'indian_nonveg', 'indian_egg', 'custom'],
  );

  for (const preset of DIET_PRESETS.filter((item) => item.value !== 'custom')) {
    assert.equal(isDietPreference(DIET_PREFERENCE_PREFIX + preset.text), true);
    assert.equal(presetForDietText(preset.text), preset.value);
    assert.equal(presetForDietText(`  ${preset.text.toUpperCase()}  `), preset.value);
    assert.equal(dietTextForPreset(preset.value), preset.text);
  }

  assert.equal(presetForDietText('Jain, no root vegetables'), 'custom');
  assert.equal(presetForDietText(''), null);
  assert.equal(dietTextForPreset('custom'), '');
  assert.equal(dietTextForPreset('missing'), '');
  assert.equal(isDietPreference('Indian vegetarian'), false);
});

test('diet preference is stored once, updated in place, and hidden from generic preferences', () => {
  const found = findDietPreference([
    { id: 'p1', texto: 'No peanuts after 6pm' },
    { id: 'p2', texto: `${DIET_PREFERENCE_PREFIX}Indian non-vegetarian` },
  ]);
  assert.deepEqual(found, { id: 'p2', text: 'Indian non-vegetarian' });
  assert.equal(findDietPreference([{ id: 'p1', texto: 'No peanuts' }]), null);
  assert.equal(findDietPreference(null), null);
});

test('food screen exposes the AI diet coach and saves the preference without duplicates', async () => {
  const [card, screen, preferences, api, supabase] = await Promise.all([
    readFile(new URL('../src/components/DietCoachCard.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/screens/RegistrarComidaScreen.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/PreferenciasSection.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/api.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/apiSupabase.js', import.meta.url), 'utf8'),
  ]);
  assert.match(card, /const stored = DIET_PREFERENCE_PREFIX \+ next;/);
  assert.match(card, /if \(dietIdRef\.current\) \{\s*await updateUserPreference\(dietIdRef\.current, stored\)/);
  assert.match(card, /pendingRef\.current = text/);
  assert.match(card, /Ask AI Diet Coach/);
  assert.match(card, /dietPreference: dietText \|\| 'not set'/);
  assert.match(screen, /<DietCoachCard mealType=\{mealType\} \/>/);
  assert.match(preferences, /filter\(\(p\) => !isDietPreference\(p\?\.texto\)\)/);
  assert.match(api, /export const updateUserPreference = api\.updateUserPreference;/);
  assert.match(supabase, /\.update\(\{ texto \}\)[\s\S]*?\.eq\('user_id', uid\)/);
});

test('offline failures from every platform map to one standard message', () => {
  const offlineSamples = [
    new TypeError('Failed to fetch'),
    new Error('Network request failed'),
    new TypeError('fetch failed'),
    Object.assign(new TypeError('fetch failed'), {
      cause: new Error('getaddrinfo ENOTFOUND example.supabase.co'),
    }),
    {
      message: 'TypeError: fetch failed',
      details:
        'TypeError: fetch failed\n\nCaused by: Error: getaddrinfo ENOTFOUND example.supabase.co (ENOTFOUND)',
      hint: '',
      code: '',
    },
    Object.assign(new Error('NetworkError when attempting to fetch resource.'), {
      name: 'NetworkError',
    }),
    'Load failed',
    'The Internet connection appears to be offline.',
    Object.assign(new Error('Fetch failed'), { name: 'AuthRetryableFetchError', status: 0 }),
    Object.assign(new Error('Failed to send a request to the Edge Function'), {
      name: 'FunctionsFetchError',
    }),
    new Error('connect ECONNREFUSED 127.0.0.1:5432'),
  ];

  for (const sample of offlineSamples) {
    assert.equal(isOfflineError(sample), true, `not classified offline: ${JSON.stringify(sample)}`);
    assert.equal(friendlyError(sample, 'Fallback message.'), NO_INTERNET);
  }

  assert.equal(
    NO_INTERNET,
    'No internet connection. Check your network and try again.',
  );
});

test('timeouts, server failures and normal errors keep distinct standard messages', () => {
  const timeouts = [
    new Error('The server took too long to respond. Check your connection and try again.'),
    new Error('connect ETIMEDOUT 1.2.3.4:443'),
    new Error('Request timeout'),
  ];
  for (const sample of timeouts) {
    assert.equal(isOfflineError(sample), false);
    assert.equal(isTimeoutError(sample), true);
    assert.equal(friendlyError(sample, 'Fallback.'), TIMEOUT);
  }

  assert.equal(TIMEOUT, 'The connection timed out. Check your internet and try again.');
  const slowAuth = Object.assign(
    new Error('The server took too long to respond. Check your connection and try again.'),
    { name: 'AuthRetryableFetchError', status: 0 },
  );
  assert.equal(friendlyError(slowAuth, 'Fallback.'), TIMEOUT);
  assert.equal(
    friendlyError(Object.assign(new Error('Service unavailable'), { status: 503 }), 'Fallback.'),
    SERVER_UNAVAILABLE,
  );
  assert.equal(friendlyError(new Error('Bad gateway'), 'Fallback.'), SERVER_UNAVAILABLE);
  assert.equal(isUnavailableError({ status: 502 }), true);
  assert.equal(isUnavailableError({ status: 400 }), false);

  const validation = new Error('Wrong email or password.');
  assert.equal(friendlyError(validation, 'Fallback.'), 'Wrong email or password.');
  assert.equal(
    friendlyError(new Error('AuthApiError: Invalid login credentials'), 'Fallback.'),
    'Invalid login credentials',
  );
  assert.equal(
    friendlyError(new Error('TypeError: Cannot read property of undefined'), 'Fallback.'),
    'Cannot read property of undefined',
  );
  assert.equal(friendlyError(null, 'Could not save.'), 'Could not save.');
  assert.equal(friendlyError({}, 'Could not save.'), 'Could not save.');
  assert.equal(
    friendlyError(undefined),
    'Something went wrong. Please try again.',
  );
});

test('Supabase, Gemini and every user-facing error path use the shared classifier', async () => {
  const [supabaseClient, gemini, auth, api, ...ui] = await Promise.all([
    readFile(new URL('../src/services/supabaseClient.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/gemini.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/authSupabase.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/apiSupabase.js', import.meta.url), 'utf8'),
    ...[
      '../App.js',
      '../src/screens/AuthScreen.js',
      '../src/screens/ResetPasswordScreen.js',
      '../src/screens/DashboardScreen.js',
      '../src/screens/HistorialScreen.js',
      '../src/screens/PerfilScreen.js',
      '../src/screens/PesoScreen.js',
      '../src/screens/WorkoutScreen.js',
      '../src/screens/RegistrarComidaScreen.js',
      '../src/components/CoachModal.js',
      '../src/components/DietCoachCard.js',
      '../src/components/CalorieAdjustmentCard.js',
      '../src/components/PreferenciasSection.js',
      '../src/components/GoogleFitCard.js',
      '../src/components/HealthConnectCard.js',
    ].map((file) => readFile(new URL(file, import.meta.url), 'utf8')),
  ]);

  assert.match(supabaseClient, /async function fetchForSupabase\(/);
  assert.match(supabaseClient, /if \(!isOnline\(\)\) throw new Error\(NO_INTERNET\)/);
  assert.match(supabaseClient, /global: \{ fetch: fetchForSupabase \}/);
  assert.match(supabaseClient, /if \(isOfflineError\(error\)\) throw new Error\(NO_INTERNET\)/);

  assert.match(gemini, /if \(!isOnline\(\)\) throw new Error\(NO_INTERNET\)/);
  assert.match(gemini, /if \(res\.status >= 500\) throw new Error\(SERVER_UNAVAILABLE\)/);
  assert.match(gemini, /if \(isOfflineError\(error\)\) throw new Error\(NO_INTERNET\)/);

  assert.match(auth, /if \(isOfflineError\(error\)\) return NO_INTERNET/);
  assert.match(auth, /friendlyError\(error, 'Could not delete the account\.'\)/);

  assert.match(api, /friendlyError\(error, 'Could not prepare a calorie suggestion\.'\)/);

  for (const source of ui) {
    assert.match(source, /friendlyError\(/, 'a user-facing error path still shows raw messages');
    assert.doesNotMatch(source, /(?:setError|toast|showToast)\(\s*e(?:rror)?\.message \|\|/);
  }
});

test('steps refresh automatically from the phone sensor and Health Connect', async () => {
  const [android, facade, dashboard, pedometer] = await Promise.all([
    readFile(new URL('../src/services/healthConnect.android.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/healthConnect.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/screens/DashboardScreen.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/hooks/usePedometer.js', import.meta.url), 'utf8'),
  ]);

  // Health Connect: today-only import with a throttle, stored as the provider
  // total so it never double-counts the phone sensor.
  assert.match(android, /export async function autoSyncHealthConnectToday\(/);
  assert.match(android, /start\.setHours\(0, 0, 0, 0\)/);
  assert.match(android, /providerSource: 'health_connect'/);
  assert.match(android, /lastAutoSyncAt = Date\.now\(\)/);
  assert.match(facade, /export async function autoSyncHealthConnectToday\(\)/);

  // Dashboard: import on focus, refresh while open, refresh on app resume.
  assert.match(dashboard, /await autoSyncHealthConnectToday\(\)\.catch\(\(\) => \{\}\)/);
  assert.match(dashboard, /setInterval\(refreshTodaySteps, 60_000\)/);
  assert.match(dashboard, /AppState\.addEventListener\('change'/);
  assert.match(dashboard, /const providerLabel = activity\.stepsProviderSource/);
  assert.match(dashboard, /const sensorEnabled = sensorOn && isToday\(selectedDay\) && !providerLabel/);

  // Sensor: on by default, remembered across restarts, and restarted when the
  // app returns to the foreground.
  assert.match(dashboard, /useState\(true\)/);
  assert.match(dashboard, /storage\.setItem\(SENSOR_PREF_KEY/);
  assert.match(pedometer, /AppState\.addEventListener\('change'/);
  assert.match(pedometer, /stopWatching\(\);\s*start\(\);/);
});
