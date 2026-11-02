// Fachada de autenticación: elige el backend según el modo.
// Producción → Supabase Auth. Demo → usuario local fijo.

import { isDemoMode } from '../config';
import * as authDemo from './authDemo';
import * as authSupabase from './authSupabase';

export { isDemoMode } from '../config';

const auth = isDemoMode() ? authDemo : authSupabase;

export const signUp = auth.signUp;
export const signIn = auth.signIn;
export const requestPasswordReset = auth.requestPasswordReset;
export const updatePassword = auth.updatePassword;
export const signOut = auth.signOut;
export const deleteAccount = auth.deleteAccount;
export const getSession = auth.getSession;
export const getCurrentUser = auth.getCurrentUser;
export const getCurrentUserId = auth.getCurrentUserId;
export const onAuthStateChange = auth.onAuthStateChange;
