const secretField = /(?:api.?key|service.?role|secret|password|access.?token|refresh.?token|authorization|credential)/i;

function withoutSecrets(value) {
  if (Array.isArray(value)) return value.map(withoutSecrets);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !secretField.test(key))
    .map(([key, entry]) => [key, withoutSecrets(entry)]));
}

export function buildExportPayload(data, exportedAt = new Date().toISOString(), timezone = 'unknown') {
  const safe = withoutSecrets(data || {});

  return {
    schemaVersion: 1,
    exportedAt,
    timezone,
    dateConvention: {
      timestamps: 'ISO 8601 UTC timestamps',
      dailyActivity: 'YYYY-MM-DD local calendar day in the exported timezone',
    },
    units: {
      weight: 'kg',
      height: 'cm',
      energy: 'kcal',
      macros: 'g',
      stepCount: 'steps',
      water: 'glasses',
      duration: 'minutes',
      workoutVolume: 'kg',
    },
    profile: safe.profile || {},
    meals: safe.meals || [],
    weightEntries: safe.weightEntries || [],
    workouts: safe.workouts || [],
    dailyActivity: safe.dailyActivity || [],
    foodPreferences: safe.foodPreferences || [],
    achievements: safe.achievements || [],
    calorieSuggestions: safe.calorieSuggestions || [],
  };
}
