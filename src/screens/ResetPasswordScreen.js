import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, PasswordInput } from '../components/ui';
import { font, spacing } from '../theme/colors';
import { useThemedStyles } from '../theme/ThemeContext';
import { updatePassword } from '../services/auth';
import { friendlyError } from '../utils/networkErrors.mjs';

export default function ResetPasswordScreen({ onComplete }) {
  const styles = useThemedStyles(makeStyles);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setError('');
    if (password.length < 8 || !/[a-zA-Z]/.test(password)) {
      setError('Use at least 8 characters and include a letter.');
      return;
    }
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      await updatePassword(password);
      onComplete?.();
    } catch (e) {
      setError(friendlyError(e, 'Could not update your password. Request a new reset email.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <Text style={styles.title}>Choose a new password</Text>
          <Text style={styles.subtitle}>Use at least 8 characters and include a letter.</Text>
          <Card style={styles.card}>
            <PasswordInput
              placeholder="New password"
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoComplete="new-password"
              style={{ marginBottom: spacing.md }}
            />
            <PasswordInput
              placeholder="Confirm new password"
              value={confirmation}
              onChangeText={setConfirmation}
              autoCapitalize="none"
              autoComplete="new-password"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button variant="primary" onPress={save} loading={saving} disabled={saving} style={{ marginTop: spacing.md }}>
              Update password
            </Button>
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  form: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  title: { fontSize: font.xxl, fontWeight: '800', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: font.base, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.lg },
  card: { padding: spacing.lg },
  error: { color: colors.danger, textAlign: 'center', marginTop: spacing.sm },
});
