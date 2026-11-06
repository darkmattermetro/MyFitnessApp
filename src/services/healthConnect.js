// Health Connect is Android-only. The Android implementation is resolved from
// healthConnect.android.js; web and iOS show an unavailable provider state.
export async function getHealthConnectStatus() {
  return { available: false, updateRequired: false, permissionGranted: false, metricsGranted: false };
}

export async function requestHealthConnectStepPermission() {
  throw new Error('Health Connect is available in the Android app only.');
}

export async function openHealthConnectPermissions() {}

export async function getHealthConnectLastSync() {
  return null;
}

export async function syncHealthConnectSteps() {
  throw new Error('Health Connect is available in the Android app only.');
}

// No-op outside Android: the dashboard calls this on focus and app resume.
export async function autoSyncHealthConnectToday() {
  return { skipped: true, days: [] };
}

export async function getHealthConnectWeeklySummary() {
  return { available: false, days: [] };
}
