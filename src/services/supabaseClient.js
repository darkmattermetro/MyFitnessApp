import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { storage } from './storage';

export const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage,
  },
});