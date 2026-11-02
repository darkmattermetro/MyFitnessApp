import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { parseShiftRoster } from '../utils/shiftRoster.mjs';

const KIND = 'openfit-shift-workout';
const CHANNEL_ID = 'workout-reminders';

export async function scheduleShiftWorkoutReminders(csv) {
  if (Platform.OS === 'web') throw new Error('Shift reminders need the Android or iOS app.');
  const parsed = parseShiftRoster(csv);
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Workout reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 180, 100, 180],
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') throw new Error('Allow notifications in system settings to schedule workout reminders.');

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const own = scheduled.filter((item) => item.content?.data?.kind === KIND);
  const existing = new Map(own.map((item) => [item.content.data.reminderId, item.identifier]));
  const reminderIds = new Set(parsed.eligible.map((item) => item.signOff));
  let added = 0;

  for (const shift of parsed.eligible) {
    if (existing.has(shift.signOff)) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Time for your 20-minute workout',
        body: 'You have a workout window during your scheduled rest period.',
        data: { kind: KIND, reminderId: shift.signOff },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(shift.workoutAt),
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
    });
    added += 1;
  }

  // Remove obsolete app reminders only after new rows were scheduled.
  for (const item of own) {
    if (!reminderIds.has(item.content.data.reminderId)) {
      await Notifications.cancelScheduledNotificationAsync(item.identifier);
    }
  }
  return { scheduled: parsed.eligible.length, added, ignoredShort: parsed.ignoredShort, skippedPast: parsed.skippedPast, truncated: parsed.truncated };
}

export async function clearShiftWorkoutReminders() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const own = scheduled.filter((item) => item.content?.data?.kind === KIND);
  await Promise.all(own.map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)));
  return own.length;
}
