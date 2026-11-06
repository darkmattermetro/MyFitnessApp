// Auth against Supabase (production). Screens never import this directly:
// they use the facade in ./auth, which picks between this backend and demo.

import { supabase } from './supabaseClient';
import { NO_INTERNET, friendlyError, isOfflineError } from '../utils/networkErrors.mjs';

function messageFor(error) {
  if (isOfflineError(error)) return NO_INTERNET;
  const m = error?.message?.toLowerCase() || '';
  if (m.includes('already registered')) return 'That email is already registered. Sign in instead.';
  if (m.includes('weak_password')) return 'Password must be at least 6 characters.';
  if (m.includes('invalid login credentials')) return 'Wrong email or password.';
  if (m.includes('email not confirmed')) return 'Confirm your email before signing in.';
  if (m.includes('invalid email')) return 'That email is not valid.';
  if (m.includes('password should be at least')) return 'Password must be at least 6 characters.';
  return friendlyError(error, 'Something went wrong. Please try again.');
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(messageFor(error));
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(messageFor(error));
  return data;
}

export async function requestPasswordReset(email) {
  const redirectTo = typeof window !== 'undefined'
    ? window.location.origin
    : 'openfit://reset-password';
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw new Error(messageFor(error));
}

export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(messageFor(error));
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(messageFor(error));
}

export async function deleteAccount() {
  const { data, error } = await supabase.functions.invoke('delete-account', { body: {} });
  if (error) throw new Error(friendlyError(error, 'Could not delete the account.'));
  if (data?.error) throw new Error(data.error);
  // The server has already removed this user's auth record. Clear the local
  // session without making account deletion look like it failed if remote
  // token revocation is no longer possible.
  await supabase.auth.signOut({ scope: 'local' });
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(messageFor(error));
  return data.session;
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(messageFor(error));
  return data?.user ?? null;
}

export async function getCurrentUserId() {
  const user = await getCurrentUser();
  return user ? user.id : null;
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session, _event);
  });
}
