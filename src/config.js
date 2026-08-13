// Configuración central.
// Los valores se leen de variables de entorno (prefijo EXPO_PUBLIC_ para Expo).
// Completalos en el archivo .env (ver .env.example) o en el dashboard de Vercel.
export const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'PEGA_TU_URL',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'PEGA_TU_KEY',
};

export const isSupabaseConfigured = () =>
  config.supabaseUrl.startsWith('https') &&
  !config.supabaseAnonKey.startsWith('PEGA');

// Modo demo: sin base de datos ni Supabase. Todo vive en storage local
// (AsyncStorage → localStorage en web). Se activa con EXPO_PUBLIC_DEMO_MODE=true
// o automáticamente si Supabase no está configurado.
export const isDemoMode = () => {
  const flag = process.env.EXPO_PUBLIC_DEMO_MODE;
  if (flag === 'true' || flag === '1') return true;
  if (flag === 'false' || flag === '0') return false;
  return !isSupabaseConfigured();
};