// Auth against Supabase (production). Screens never import this directly:
// they use the facade in ./auth, which picks between this backend and demo.

import { supabase } from './supabaseClient';

function messageFor(error) {
  const m = error?.message?.toLowerCase() || '';
  if (m.includes('already registered')) return 'That email is already registered. Sign in instead.';
  if (m.includes('weak_password')) return 'Password must be at least 6 characters.';
  if (m.includes('invalid login credentials')) return 'Wrong email or password.';
  if (m.includes('email not confirmed')) return 'Confirm your email before signing in.';
  if (m.includes('invalid email')) return 'That email is not valid.';
  if (m.includes('password should be at least')) return 'Password must be at least 6 characters.';
  return error?.message || 'Something went wrong. Please try again.';
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

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(messageFor(error));
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
    callback(session);
  });
}
