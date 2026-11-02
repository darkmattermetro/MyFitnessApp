import {
  aggregateGroupByPeriod,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import { secureStorage } from './storage';
import { getDailyActivity, saveDailyActivity } from './api';
import { dayKey } from '../utils/dates';

const LAST_SYNC_KEY = 'health_connect_last_sync';
const STEP_PERMISSION = { accessType: 'read', recordType: 'Steps' };
const DATA_PERMISSIONS = [
  STEP_PERMISSION,
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'SleepSession' },
];

async function readyClient() {
  const status = await getSdkStatus();
  if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
    return { available: false, updateRequired: true };
  }
  if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
    return { available: false, updateRequired: false };
  }
  const initialized = await initialize();
  return { available: Boolean(initialized), updateRequired: false };
}

export async function getHealthConnectStatus() {
  try {
    const status = await readyClient();
    if (!status.available) return { ...status, permissionGranted: false };
    const granted = await getGrantedPermissions();
    const hasRead = (recordType) => granted.some((p) => p.recordType === recordType && p.accessType === 'read');
    return {
      ...status,
      permissionGranted: hasRead('Steps'),
      metricsGranted: ['Steps', 'ActiveCaloriesBurned', 'SleepSession'].every(hasRead),
    };
  } catch (error) {
    return { available: false, updateRequired: false, permissionGranted: false, error };
  }
}

export async function requestHealthConnectStepPermission() {
  const status = await readyClient();
  if (!status.available) {
    throw new Error(status.updateRequired
      ? 'Update Health Connect from Google Play, then try again.'
      : 'Health Connect is not available on this device.');
  }
  const granted = await requestPermission(DATA_PERMISSIONS);
  return granted.some(
    (permission) => permission.recordType === 'Steps' && permission.accessType === 'read',
  );
}

export async function getHealthConnectWeeklySummary(days = 7) {
  const status = await readyClient();
  if (!status.available) return { available: false, days: [] };
  const granted = await getGrantedPermissions();
  const allowed = new Set(granted.filter((p) => p.accessType === 'read').map((p) => p.recordType));
  const count = Math.max(1, Math.min(30, Math.round(Number(days) || 7)));
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - (count - 1));
  start.setHours(0, 0, 0, 0);
  const range = { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() };
  const metrics = {};
  const requests = [
    ['Steps', 'COUNT_TOTAL'],
    ['ActiveCaloriesBurned', 'ACTIVE_CALORIES_TOTAL'],
    ['SleepSession', 'SLEEP_DURATION_TOTAL'],
  ];
  await Promise.all(requests.map(async ([recordType, field]) => {
    if (!allowed.has(recordType)) return;
    const groups = await aggregateGroupByPeriod({ recordType, timeRangeFilter: range, timeRangeSlicer: { period: 'DAYS', length: 1 } });
    for (const group of groups || []) {
      const day = dayKey(new Date(group.startTime));
      if (!metrics[day]) metrics[day] = { day, steps: 0, activeCalories: 0, sleepMinutes: 0 };
      const raw = group.result?.[field];
      const value = typeof raw === 'object' ? Number(raw.inKilocalories) || 0 : Number(raw) || 0;
      if (recordType === 'Steps') metrics[day].steps = Math.round(value);
      if (recordType === 'ActiveCaloriesBurned') metrics[day].activeCalories = Math.round(value);
      if (recordType === 'SleepSession') metrics[day].sleepMinutes = Math.round(value / 60);
    }
  }));
  return { available: true, days: Object.values(metrics).sort((a, b) => a.day.localeCompare(b.day)), permissions: [...allowed] };
}

export async function openHealthConnectPermissions() {
  await openHealthConnectSettings();
}

export async function getHealthConnectLastSync() {
  return secureStorage.getItem(LAST_SYNC_KEY);
}

export async function syncHealthConnectSteps(days = 7) {
  const status = await getHealthConnectStatus();
  if (!status.available) {
    throw new Error(status.updateRequired
      ? 'Update Health Connect from Google Play, then try again.'
      : 'Health Connect is not available on this device.');
  }
  if (!status.permissionGranted) {
    throw new Error('Allow OpenFit to read steps in Health Connect, then sync again.');
  }

  const countDays = Math.max(1, Math.min(30, Math.round(Number(days) || 7)));
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - (countDays - 1));
  start.setHours(0, 0, 0, 0);

  // Period grouping follows local calendar days. Health Connect aggregates
  // overlapping sources for Steps, avoiding double-counting Fitbit/phone data.
  const groups = await aggregateGroupByPeriod({
    recordType: 'Steps',
    timeRangeFilter: {
      operator: 'between',
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    },
    timeRangeSlicer: { period: 'DAYS', length: 1 },
  });

  const imported = (groups || []).map((group) => ({
    day: dayKey(new Date(group.startTime)),
    steps: Math.max(0, Math.round(Number(group.result?.COUNT_TOTAL) || 0)),
  })).filter((row) => row.day);

  let updated = 0;
  for (const { day, steps } of imported) {
    if (!steps) continue;
    const current = await getDailyActivity(day);
    const currentSteps = Number(current?.steps) || 0;
    if (steps > currentSteps) {
      await saveDailyActivity({ day, steps, water: Number(current?.water) || 0 });
      updated += 1;
    }
  }

  const lastSync = new Date().toISOString();
  await secureStorage.setItem(LAST_SYNC_KEY, lastSync);
  return {
    imported: imported.filter((row) => row.steps > 0).length,
    updated,
    lastSync,
  };
}
