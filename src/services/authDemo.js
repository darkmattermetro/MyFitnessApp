// Auth en modo demo: sin Supabase. Siempre hay sesión con un usuario local.
// El perfil y los datos viven en AsyncStorage (localStorage en web).

import { DEMO_USER_ID, seedDemoIfNeeded, resetDemo } from './demoStorage';

const demoUser = {
  id: DEMO_USER_ID,
  email: 'demo@openfit.app',
};

const demoSession = {
  user: demoUser,
  access_token: 'demo-token',
  refresh_token: 'demo-token',
  expires_at: null,
};

export async function signUp() {
  return { user: demoUser, session: demoSession };
}

export async function signIn() {
  return { user: demoUser, session: demoSession };
}

export async function requestPasswordReset() {
  throw new Error('Password recovery is only available for registered accounts.');
}

export async function updatePassword() {
  throw new Error('Password changes are only available for registered accounts.');
}

export async function signOut() {
  await resetDemo();
}

export async function getSession() {
  await seedDemoIfNeeded();
  return demoSession;
}

export async function getCurrentUser() {
  await seedDemoIfNeeded();
  return demoUser;
}

export async function getCurrentUserId() {
  await seedDemoIfNeeded();
  return DEMO_USER_ID;
}

export function onAuthStateChange(callback) {
  seedDemoIfNeeded().then(() => callback(demoSession));
  return { data: { subscription: { unsubscribe: () => {} } } };
}
