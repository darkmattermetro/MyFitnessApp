import { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, SectionLabel } from './ui';
import { useToast } from './Toast';
import { scheduleShiftWorkoutReminders, clearShiftWorkoutReminders } from '../services/shiftNotifications';
import { colors, font, spacing } from '../theme/colors';

export default function ShiftReminderCard() {
  const [roster, setRoster] = useState('');
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState('');
  const { showToast } = useToast();

  const schedule = async () => {
    setBusy(true);
    try {
      const result = await scheduleShiftWorkoutReminders(roster);
      const parts = [result.added + ' reminder(s) added'];
      if (result.ignoredShort) parts.push(result.ignoredShort + ' short-rest shift(s) skipped');
      if (result.skippedPast) parts.push(result.skippedPast + ' past window(s) skipped');
      if (result.truncated) parts.push('limited to the next 30 eligible shifts');
      setSummary(parts.join(' · '));
      showToast(parts.join(' · '), 'success');
    } catch (error) {
      showToast(error.message || 'Could not schedule workout reminders.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    try {
      const count = await clearShiftWorkoutReminders();
      setSummary('Removed ' + count + ' OpenFit workout reminder(s).');
    } catch (error) {
      showToast(error.message || 'Could not clear workout reminders.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={styles.card}>
      <SectionLabel>Shift workout reminders</SectionLabel>
      <Text style={styles.help}>
        Paste CSV with sign_off and next_sign_on columns and ISO 8601 timestamps with a time zone. OpenFit keeps the roster on this device and schedules a reminder one hour after sign-off only when the rest interval is at least 12 hours.
      </Text>
      <TextInput
        style={styles.input}
        value={roster}
        onChangeText={setRoster}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={'sign_off,next_sign_on\n2026-11-04T19:00:00+05:30,2026-11-05T07:00:00+05:30'}
        placeholderTextColor={colors.textMuted}
      />
      {Platform.OS === 'web' ? <Text style={styles.help}>Local reminders are available in the Android and iOS apps.</Text> : null}
      {summary ? <Text style={styles.summary}>{summary}</Text> : null}
      <View style={styles.actions}>
        <Button variant="primary" icon="notifications-outline" onPress={schedule} loading={busy} disabled={busy || !roster.trim()}>
          Schedule rest-window reminders
        </Button>
        <Button variant="ghost" icon="close-circle-outline" onPress={clear} disabled={busy}>
          Clear OpenFit reminders
        </Button>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  help: { fontSize: font.sm, color: colors.textMuted, lineHeight: 19, marginBottom: spacing.sm },
  input: { minHeight: 112, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md, color: colors.text, textAlignVertical: 'top', fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, marginBottom: spacing.sm },
  summary: { fontSize: font.sm, color: colors.primaryDark, marginBottom: spacing.sm },
  actions: { gap: spacing.xs },
});
