import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateNutritionItems } from '../src/utils/nutritionValidation.mjs';
import { getEffectiveSteps } from '../src/utils/stepReconciliation.mjs';
import { parseShiftRoster } from '../src/utils/shiftRoster.mjs';
import { buildExportPayload } from '../src/utils/dataExport.mjs';
import { createSerializedQueue } from '../src/utils/serializedQueue.mjs';
import { createDeadlineFetch } from '../src/utils/deadlineFetch.mjs';

const validFood = () => ({
  name: 'dal and rice',
  amount: '1 bowl',
  kcal: 380,
  protein: 16,
  fat: 8,
  carbs: 61,
  note: 'Estimate',
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

test('uses provider totals without adding overlapping phone sensor steps twice', () => {
  assert.equal(getEffectiveSteps({ stepsProvider: 7000, stepsManual: 4000, stepsAdjustment: 100 }), 7100);
  assert.equal(getEffectiveSteps({ stepsProvider: null, stepsManual: 4000, stepsAdjustment: 100 }), 4100);
  assert.equal(getEffectiveSteps({ stepsProvider: 50, stepsAdjustment: -100 }), 0);
});

test('schedules only future shifts with at least twelve hours of rest', () => {
  const now = Date.UTC(2026, 10, 1, 0, 0, 0);
  const roster = [
    'sign_off,next_sign_on',
    '2026-11-04T19:00:00+05:30,2026-11-05T07:00:00+05:30',
    '2026-11-06T19:00:00+05:30,2026-11-07T05:00:00+05:30',
  ].join('\n');
  const result = parseShiftRoster(roster, now);
  assert.equal(result.eligible.length, 1);
  assert.equal(result.ignoredShort, 1);
  assert.equal(result.eligible[0].workoutAt, '2026-11-04T14:30:00.000Z');
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
  assert.match(modal, /event\.nativeEvent\.key === 'Enter'/);
  assert.match(modal, /Shift\+Enter for a new line/);
  assert.match(modal, /Retry message/);
  assert.match(modal, /coachReply\(context, history, controller\.signal\)/);
  assert.match(api, /coachReplyConKey\(apiKey, context, messages, signal\)/);
  assert.match(gemini, /callGemini\(apiKey, prompt, undefined, false, signal\)/);
});
