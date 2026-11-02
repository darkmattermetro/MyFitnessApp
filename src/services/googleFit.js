// Google Fit integration: OAuth (expo-auth-session) + daily fitness sync.
//
// Uses the Google Fit REST API, so it works in Expo Go and on web without
// native code. The user must create OAuth client IDs in Google Cloud Console
// (see README / .env.example) and set the EXPO_PUBLIC_GOOGLE_FIT_*_CLIENT_ID
// variables. Without them the connect button is disabled.

import { Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { secureStorage } from './storage';
import { getDailyActivity, patchDailyActivity } from './api';

WebBrowser.maybeCompleteAuthSession();

export const SCOPES = ['https://www.googleapis.com/auth/fitness.activity.read'];

const TOKENS_KEY = 'google_fit_tokens';
const LAST_SYNC_KEY = 'google_fit_last_sync';
const ACTIVITY_SUMMARY_KEY = 'google_fit_activity_summary';
const ACTIVITY_DATA_TYPES = [
  'com.google.step_count.delta',
  'com.google.distance.delta',
  'com.google.calories.expended',
  'com.google.active_minutes',
  'com.google.heart_minutes',
];

const WEB_CLIENT_ID = String(process.env.EXPO_PUBLIC_GOOGLE_FIT_WEB_CLIENT_ID || '').trim();
const ANDROID_CLIENT_ID = String(process.env.EXPO_PUBLIC_GOOGLE_FIT_ANDROID_CLIENT_ID || '').trim();
const IOS_CLIENT_ID = String(process.env.EXPO_PUBLIC_GOOGLE_FIT_IOS_CLIENT_ID || '').trim();

export function getClientIds() {
  return { web: WEB_CLIENT_ID, android: ANDROID_CLIENT_ID, ios: IOS_CLIENT_ID };
}

function isGoogleClientId(value) {
  return typeof value === 'string' && value.endsWith('.apps.googleusercontent.com');
}

export const isConfigured = () => {
  if (Platform.OS === 'web') return isGoogleClientId(WEB_CLIENT_ID);
  if (Platform.OS === 'android') return isGoogleClientId(ANDROID_CLIENT_ID);
  if (Platform.OS === 'ios') return isGoogleClientId(IOS_CLIENT_ID);
  return false;
};

export function getConfigurationMessage() {
  if (Platform.OS === 'web') {
    return 'Add a valid EXPO_PUBLIC_GOOGLE_FIT_WEB_CLIENT_ID ending in .apps.googleusercontent.com to Vercel. Add your hosted domain as an authorized JavaScript origin and redirect URI in Google Cloud, then redeploy.';
  }
  if (Platform.OS === 'android') {
    return 'Add EXPO_PUBLIC_GOOGLE_FIT_ANDROID_CLIENT_ID to your build environment, then create a new Android build.';
  }
  return 'Add EXPO_PUBLIC_GOOGLE_FIT_IOS_CLIENT_ID to your build environment, then create a new iOS build.';
}

export async function loadTokens() {
  const raw = await secureStorage.getItem(TOKENS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveTokens(tokens) {
  await secureStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

export async function clearTokens() {
  await secureStorage.removeItem(TOKENS_KEY);
  await secureStorage.removeItem(LAST_SYNC_KEY);
  await secureStorage.removeItem(ACTIVITY_SUMMARY_KEY);
}

export async function getLastSync() {
  return secureStorage.getItem(LAST_SYNC_KEY);
}

export async function getActivitySummary() {
  const raw = await secureStorage.getItem(ACTIVITY_SUMMARY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function setLastSync(iso) {
  await secureStorage.setItem(LAST_SYNC_KEY, iso);
}

// Returns a valid access token, refreshing it if needed.
export async function getAccessToken() {
  const tokens = await loadTokens();
  if (!tokens?.access_token) return null;

  const now = Date.now();
  const expiresAt = tokens.expires_at || 0;
  if (expiresAt && now < expiresAt - 60_000) {
    return tokens.access_token;
  }

  if (!tokens.refresh_token) {
    // No way to refresh; force reconnect.
    await clearTokens();
    return null;
  }

  const clientId = Platform.OS === 'web'
    ? WEB_CLIENT_ID
    : Platform.OS === 'android'
    ? ANDROID_CLIENT_ID
    : IOS_CLIENT_ID;

  try {
    const result = await AuthSession.refreshAsync(
      {
        clientId,
        refreshToken: tokens.refresh_token,
      },
      { tokenEndpoint: 'https://oauth2.googleapis.com/token' },
    );
    if (!result?.accessToken) throw new Error('refresh failed');
    const next = {
      ...tokens,
      access_token: result.accessToken,
      expires_at: Date.now() + (result.expiresIn || 3600) * 1000,
    };
    if (result.refreshToken) next.refresh_token = result.refreshToken;
    await saveTokens(next);
    return next.access_token;
  } catch {
    await clearTokens();
    return null;
  }
}

// Fetch daily step counts from Google Fit for [start, end] (Date objects).
export async function fetchFitnessActivity(accessToken, start, end) {
  const body = {
    aggregateBy: ACTIVITY_DATA_TYPES.map((dataTypeName) => ({ dataTypeName })),
    bucketByTime: { durationMillis: 86400000 },
    startTimeMillis: start.getTime(),
    endTimeMillis: end.getTime(),
  };

  const res = await fetch(
    'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Fit error ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  const buckets = Array.isArray(json?.bucket) ? json.bucket : [];
  return buckets.map((b) => {
    const ms = Number(b.startTimeMillis) || 0;
    const d = new Date(ms);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;
    const sums = (b.dataset || []).map((ds) => (ds.point || []).reduce((total, point) => {
      const value = point.value?.[0] || {};
      return total + (Number(value.intVal ?? value.fpVal) || 0);
    }, 0));
    return {
      day,
      steps: Math.round(sums[0] || 0),
      distanceMeters: Math.round(sums[1] || 0),
      caloriesBurned: Math.round(sums[2] || 0),
      moveMinutes: Math.round((sums[3] || 0) / 60_000),
      heartPoints: Math.round(sums[4] || 0),
    };
  });
}

// Sync the last `days` days of steps into daily_activity.
// Imported steps only overwrite when they are larger than the stored value,
// so manual entries are never lost.
export async function syncSteps(days = 7) {
  const token = await getAccessToken();
  if (!token) throw new Error('Connect Google Fit first.');

  const safeDays = Math.max(1, Math.min(30, Math.round(Number(days) || 7)));
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setDate(start.getDate() - (safeDays - 1));
  start.setHours(0, 0, 0, 0);

  let imported;
  try {
    imported = await fetchFitnessActivity(token, start, end);
  } catch (error) {
    if (/Google Fit error 401/i.test(error.message || '')) {
      await clearTokens();
      throw new Error('Your Google Fit connection expired. Reconnect and grant activity access.');
    }
    if (/Google Fit error 403/i.test(error.message || '')) {
      throw new Error('Google denied step access. Confirm the Fitness API is enabled and reconnect with activity access.');
    }
    throw error;
  }
  let updated = 0;
  await secureStorage.setItem(ACTIVITY_SUMMARY_KEY, JSON.stringify(imported));
  for (const { day, steps } of imported) {
    const current = await getDailyActivity(day);
    await patchDailyActivity({ day, stepsProvider: steps, providerSource: 'google_fit' });
    if (Number(current?.steps) !== steps) updated += 1;
  }
  const now = new Date().toISOString();
  await setLastSync(now);
  return {
    imported: imported.filter((row) => (
      row.steps || row.distanceMeters || row.caloriesBurned || row.moveMinutes || row.heartPoints
    )).length,
    updated,
    activity: imported,
    lastSync: now,
  };
}
