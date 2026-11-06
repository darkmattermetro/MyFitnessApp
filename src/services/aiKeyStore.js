import { secureStorage } from './storage';

const KEY_NAME = 'openfit_gemini_api_key_v1';
const MIGRATED_FLAG = 'openfit_gemini_api_key_migrated_v1';

// Older builds used ':' in the SecureStore key, which expo-secure-store rejects on
// native ("Invalid key provided to SecureStore. Keys must not be empty..."). Keep
// those names only as a read-only migration source.
const LEGACY_KEY_NAME = 'openfit:gemini-api-key:v1';
const LEGACY_MIGRATED_FLAG = 'openfit:gemini-api-key-migrated:v1';

async function safeGet(key) {
  try {
    return await secureStorage.getItem(key);
  } catch {
    return null;
  }
}

async function safeRemove(key) {
  try {
    await secureStorage.removeItem(key);
  } catch {}
}

async function migrateLegacyKey() {
  const legacy = await safeGet(LEGACY_KEY_NAME);
  if (!legacy) return null;
  try {
    await secureStorage.setItem(KEY_NAME, legacy);
  } catch {
    return legacy;
  }
  await safeRemove(LEGACY_KEY_NAME);
  return legacy;
}

async function migrateLegacyFlag() {
  const legacy = await safeGet(LEGACY_MIGRATED_FLAG);
  if (legacy !== '1') return false;
  try {
    await secureStorage.setItem(MIGRATED_FLAG, '1');
  } catch {
    return true;
  }
  await safeRemove(LEGACY_MIGRATED_FLAG);
  return true;
}

export async function readStoredGeminiKey() {
  let value = await secureStorage.getItem(KEY_NAME);
  if (value) return value;
  const migrated = await migrateLegacyKey();
  return migrated || '';
}

export async function writeStoredGeminiKey(value) {
  const key = String(value || '').trim();
  if (key) await secureStorage.setItem(KEY_NAME, key);
  else await secureStorage.removeItem(KEY_NAME);
  return key;
}

export async function hasMigratedLegacyGeminiKey() {
  const current = await secureStorage.getItem(MIGRATED_FLAG);
  if (current === '1') return true;
  return await migrateLegacyFlag();
}

export async function markLegacyGeminiKeyMigrated() {
  await secureStorage.setItem(MIGRATED_FLAG, '1');
}

export async function clearStoredGeminiKey() {
  await secureStorage.removeItem(KEY_NAME);
  await safeRemove(LEGACY_KEY_NAME);
}