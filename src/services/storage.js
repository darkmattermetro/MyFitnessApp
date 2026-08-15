import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// Storage general (sin límite de 2 KB): AsyncStorage en todas las plataformas.
// Se usa para los datos del modo demo y para la sesión de Supabase.
// El límite de 2 KB de SecureStore rompe con sesiones grandes o seeds demo.
const webStorage = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

const asyncStorageNative = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

export const storage = Platform.OS === 'web' ? webStorage : asyncStorageNative;

// Storage seguro: SecureStore en nativo (cifrado, límite ~2 KB).
// Se usa solo para datos chicos y sensibles (ej. API key de Gemini).
const secureStoreNative = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

export const secureStorage = Platform.OS === 'web' ? webStorage : secureStoreNative;