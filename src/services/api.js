// Fachada de la API: elige el backend según el modo.
// Producción → Supabase. Demo → storage local (AsyncStorage/localStorage).

import { isDemoMode } from '../config';
import * as apiDemo from './apiDemo';
import * as apiSupabase from './apiSupabase';

export { isDemoMode } from '../config';

const api = isDemoMode() ? apiDemo : apiSupabase;

export const getUser = api.getUser;
export const updateUser = api.updateUser;
export const createFoodEntry = api.createFoodEntry;
export const listFoodEntries = api.listFoodEntries;
export const updateFoodEntry = api.updateFoodEntry;
export const deleteFoodEntry = api.deleteFoodEntry;
export const createWeightEntry = api.createWeightEntry;
export const listWeightEntries = api.listWeightEntries;
export const deleteWeightEntry = api.deleteWeightEntry;
export const listUserPreferences = api.listUserPreferences;
export const createUserPreference = api.createUserPreference;
export const deleteUserPreference = api.deleteUserPreference;
export const parseFood = api.parseFood;
export const mejorarPreferencia = api.mejorarPreferencia;