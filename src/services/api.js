// Facade for the API: picks the backend based on the mode.
// Production → Supabase. Demo → local storage (AsyncStorage/localStorage).

import { isDemoMode } from '../config';
import * as apiDemo from './apiDemo';
import * as apiSupabase from './apiSupabase';

export { isDemoMode } from '../config';

const api = isDemoMode() ? apiDemo : apiSupabase;

export const getUser = api.getUser;
export const updateUser = api.updateUser;
export const getGeminiApiKey = api.getGeminiApiKey;
export const setGeminiApiKey = api.setGeminiApiKey;
export const createFoodEntry = api.createFoodEntry;
export const listFoodEntries = api.listFoodEntries;
export const updateFoodEntry = api.updateFoodEntry;
export const deleteFoodEntry = api.deleteFoodEntry;
export const createWeightEntry = api.createWeightEntry;
export const listWeightEntries = api.listWeightEntries;
export const deleteWeightEntry = api.deleteWeightEntry;
export const createWorkoutSession = api.createWorkoutSession;
export const listWorkoutSessions = api.listWorkoutSessions;
export const deleteWorkoutSession = api.deleteWorkoutSession;
export const getDailyActivity = api.getDailyActivity;
export const saveDailyActivity = api.saveDailyActivity;
export const patchDailyActivity = api.patchDailyActivity;
export const listDailyActivity = api.listDailyActivity;
export const listUserPreferences = api.listUserPreferences;
export const createUserPreference = api.createUserPreference;
export const deleteUserPreference = api.deleteUserPreference;
export const parseFood = api.parseFood;
export const analyzeFoodImage = api.analyzeFoodImage;
export const mejorarPreferencia = api.mejorarPreferencia;
export const coachReply = api.coachReply;
export const generateDailyCalorieSuggestion = api.generateDailyCalorieSuggestion;
export const listAchievements = api.listAchievements;
export const unlockAchievement = api.unlockAchievement;
export const listCalorieSuggestions = api.listCalorieSuggestions;
