// Cliente de Supabase perezoso: no crea el cliente al importar.
// En modo demo (o sin configurar) el módulo carga sin error; solo falla
// si se intenta usar Supabase de verdad.

import { createClient } from '@supabase/supabase-js';
import { config, isSupabaseConfigured } from '../config';
import { storage } from './storage';
import { createDeadlineFetch } from '../utils/deadlineFetch.mjs';
import { NO_INTERNET, isOfflineError, isOnline } from '../utils/networkErrors.mjs';

let client = null;

const fetchWithDeadline = createDeadlineFetch();

// Every Supabase request (auth, tables and Edge Functions) goes through this
// wrapper, so a lost connection fails fast with one standard message instead
// of a raw "fetch failed" from the transport.
async function fetchForSupabase(input, init) {
  if (!isOnline()) throw new Error(NO_INTERNET);
  try {
    return await fetchWithDeadline(input, init);
  } catch (error) {
    if (isOfflineError(error)) throw new Error(NO_INTERNET);
    throw error;
  }
}

function getClient() {
  if (!client) {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured. Fill in your .env file.');
    }
    client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      global: { fetch: fetchForSupabase },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage,
      },
    });
  }
  return client;
}

export const supabase = new Proxy(
  {},
  {
    get(_target, prop) {
      return getClient()[prop];
    },
  },
);
