import { supabase } from './supabaseClient';

function msgDe(error) {
  const m = error?.message?.toLowerCase() || '';
  if (m.includes('already registered')) return 'Ese email ya está registrado. Iniciá sesión.';
  if (m.includes('weak_password')) return 'La contraseña debe tener al menos 6 caracteres.';
  if (m.includes('invalid login credentials')) return 'Email o contraseña incorrectos.';
  if (m.includes('email not confirmed')) return 'Confirmá tu email antes de ingresar.';
  if (m.includes('invalid email')) return 'El email no es válido.';
  if (m.includes('password should be at least')) return 'La contraseña debe tener al menos 6 caracteres.';
  return error?.message || 'Ocurrió un error. Intentá de nuevo.';
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(msgDe(error));
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(msgDe(error));
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(msgDe(error));
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(msgDe(error));
  return data.session;
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(msgDe(error));
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