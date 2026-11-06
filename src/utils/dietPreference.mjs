// The diet preference is stored as a normal AI preference row so it syncs with
// the account and is also available when the AI interprets a meal. The prefix
// keeps it identifiable so the dedicated picker can update it in place instead
// of creating duplicates.
export const DIET_PREFERENCE_PREFIX = 'Diet preference: ';

export const DIET_PRESETS = [
  { value: 'indian_veg', label: 'Indian veg', text: 'Indian vegetarian' },
  { value: 'indian_nonveg', label: 'Indian non-veg', text: 'Indian non-vegetarian' },
  { value: 'indian_egg', label: 'Indian egg + veg', text: 'Indian egg + vegetarian' },
  { value: 'custom', label: 'Other', text: '' },
];

export function isDietPreference(texto) {
  return String(texto || '').startsWith(DIET_PREFERENCE_PREFIX);
}

export function findDietPreference(preferences) {
  const row = (preferences || []).find((preference) => isDietPreference(preference?.texto));
  if (!row) return null;
  return {
    id: row.id,
    text: String(row.texto).slice(DIET_PREFERENCE_PREFIX.length).trim(),
  };
}

export function presetForDietText(text) {
  const clean = String(text || '').trim().toLowerCase();
  if (!clean) return null;
  const match = DIET_PRESETS.find(
    (preset) => preset.value !== 'custom' && preset.text.toLowerCase() === clean,
  );
  return match ? match.value : 'custom';
}

export function dietTextForPreset(value) {
  return DIET_PRESETS.find((preset) => preset.value === value)?.text ?? '';
}
