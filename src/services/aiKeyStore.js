import { secureStorage } from './storage';

const KEY_NAME = 'openfit:gemini-api-key:v1';
const MIGRATED_FLAG = 'openfit:gemini-api-key-migrated:v1';

export async function readStoredGeminiKey() {
  return (await secureStorage.getItem(KEY_NAME)) || '';
}

export async function writeStoredGeminiKey(value) {
  const key = String(value || '').trim();
  if (key) await secureStorage.setItem(KEY_NAME, key);
  else await secureStorage.removeItem(KEY_NAME);
  return key;
}

export async function hasMigratedLegacyGeminiKey() {
  return (await secureStorage.getItem(MIGRATED_FLAG)) === '1';
}

export async function markLegacyGeminiKeyMigrated() {
  await secureStorage.setItem(MIGRATED_FLAG, '1');
}

export async function clearStoredGeminiKey() {
  await secureStorage.removeItem(KEY_NAME);
}
