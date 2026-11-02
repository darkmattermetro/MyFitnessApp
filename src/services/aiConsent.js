import { Alert, Platform } from 'react-native';
import { storage } from './storage';

const CONSENT_KEY = 'openfit:ai-data-consent:v1';

export async function ensureAIDataConsent() {
  if ((await storage.getItem(CONSENT_KEY)) === 'accepted') return true;
  const message = 'When you use OpenFit AI, the meal text, meal photos, saved food preferences, recent chat, and selected health and profile context needed for your request are sent to Google Gemini using your API key. Continue and remember this choice on this device?';

  let accepted = false;
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
    accepted = window.confirm(`${message}\n\nYou can remove this choice by clearing app data on this device.`);
  } else {
    accepted = await new Promise((resolve) => {
      Alert.alert('How OpenFit AI uses your data', message, [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continue', onPress: () => resolve(true) },
      ], { cancelable: true, onDismiss: () => resolve(false) });
    });
  }
  if (!accepted) throw new Error('AI request cancelled. Review the data sharing notice before using AI.');
  await storage.setItem(CONSENT_KEY, 'accepted');
  return true;
}

export async function clearAIDataConsent() {
  await storage.removeItem(CONSENT_KEY);
}
