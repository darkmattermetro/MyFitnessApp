// Cliente de Supabase perezoso: no crea el cliente al importar.
// En modo demo (o sin configurar) el módulo carga sin error; solo falla
// si se intenta usar Supabase de verdad.

import { createClient } from '@supabase/supabase-js';
import { config, isSupabaseConfigured } from '../config';
import { storage } from './storage';
import { createDeadlineFetch } from '../utils/deadlineFetch.mjs';

let client = null;

const fetchWithDeadline = createDeadlineFetch();

function getClient() {
  if (!client) {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured. Fill in your .env file.');
    }
    client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      global: { fetch: fetchWithDeadline },
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
