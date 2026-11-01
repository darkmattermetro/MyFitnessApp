// Google Fit integration: OAuth (expo-auth-session) + step-count sync.
//
// Uses the Google Fit REST API, so it works in Expo Go and on web without
// native code. The user must create OAuth client IDs in Google Cloud Console
// (see README / .env.example) and set the EXPO_PUBLIC_GOOGLE_FIT_*_CLIENT_ID
// variables. Without them the connect button is disabled.

import { Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { secureStorage } from './storage';
import { getDailyActivity, saveDailyActivity } from './api';

WebBrowser.maybeCompleteAuthSession();

export const SCOPES = ['https://www.googleapis.com/auth/fitness.activity.read'];

const TOKENS_KEY = 'google_fit_tokens';
const LAST_SYNC_KEY = 'google_fit_last_sync';

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_FIT_WEB_CLIENT_ID;
const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_FIT_ANDROID_CLIENT_ID;
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_FIT_IOS_CLIENT_ID;

export const isConfigured = () =>
  Platform.OS === 'web'
    ? !!WEB_CLIENT_ID
    : Platform.OS === 'android'
    ? !!ANDROID_CLIENT_ID
    : !!IOS_CLIENT_ID;

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
}

export async function getLastSync() {
  return secureStorage.getItem(LAST_SYNC_KEY);
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

  const clientId =
    Platform.OS === 'web'
      ? WEB_CLIENT_ID
      : Platform.OS === 'android'
      ? ANDROID_CLIENT_ID
      : IOS_CLIENT_ID;

  try {
    const discovery = AuthSession.useProxy
      ? AuthSession.makeRedirectUri({ useProxy: true })
      : undefined;
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
export async function fetchSteps(accessToken, start, end) {
  const body = {
    aggregateBy: [{ dataTypeName: 'com.google.step_count.delta' }],
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
  const out = [];
  for (const b of buckets) {
    const ms = Number(b.startTimeMillis) || 0;
    const d = new Date(ms);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;
    let steps = 0;
    for (const ds of b.dataset || []) {
      for (const pt of ds.point || []) {
        for (const v of pt.value || []) {
          steps += Number(v.intVal) || 0;
        }
      }
    }
    out.push({ day, steps });
  }
  return out;
}

// Sync the last `days` days of steps into daily_activity.
// Imported steps only overwrite when they are larger than the stored value,
// so manual entries are never lost.
export async function syncSteps(days = 7) {
  const token = await getAccessToken();
  if (!token) throw new Error('Connect Google Fit first.');

  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  const imported = await fetchSteps(token, start, end);
  let updated = 0;
  for (const { day, steps } of imported) {
    if (!steps) continue;
    const current = await getDailyActivity(day);
    const currentSteps = Number(current?.steps) || 0;
    if (steps > currentSteps) {
      await saveDailyActivity({ day, steps, water: Number(current?.water) || 0 });
      updated += 1;
    }
  }
  const now = new Date().toISOString();
  await setLastSync(now);
  return { imported: imported.length, updated, lastSync: now };
}

export function getClientIds() {
  return { web: WEB_CLIENT_ID, android: ANDROID_CLIENT_ID, ios: IOS_CLIENT_ID };
}
