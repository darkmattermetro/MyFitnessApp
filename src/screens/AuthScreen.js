import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Input, PasswordInput } from '../components/ui';
import { colors, font, radius, spacing } from '../theme/colors';
import { requestPasswordReset, signIn, signUp } from '../services/auth';

export default function AuthScreen() {
  const { width } = useWindowDimensions();
  const [modo, setModo] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const esLogin = modo === 'login';

  const validar = () => {
    if (!email.trim() || !password) {
      return 'Fill in your email and password.';
    }
    if (!esLogin) {
      if (password.length < 8) {
        return 'Password must be at least 8 characters.';
      }
      if (!/[a-zA-Z]/.test(password)) {
        return 'Password must include at least one letter.';
      }
      if (!confirmar) {
        return 'Repeat your password to confirm it.';
      }
      if (password !== confirmar) {
        return 'Passwords do not match.';
      }
    }
    return null;
  };

  const enviar = async () => {
    const mensaje = validar();
    if (mensaje) {
      setError(mensaje);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (esLogin) {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const cambiarModo = (nuevo) => {
    setModo(nuevo);
    setError(null);
    setNotice(null);
    setConfirmar('');
  };

  const recuperarPassword = async () => {
    const address = email.trim();
    if (!address) {
      setError('Enter your email first, then request a reset link.');
      setNotice(null);
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      await requestPasswordReset(address);
      setNotice('If an account exists for this email, a password reset link is on its way.');
    } catch (e) {
      setError(e.message || 'Could not send a reset link.');
    } finally {
      setLoading(false);
    }
  };

  const innerWidth = Platform.OS === 'web' && width >= 900 ? 420 : null;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.container, innerWidth && { alignItems: 'center' }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={innerWidth ? {} : { width: '100%' }}>
          <View style={innerWidth ? { width: innerWidth } : null}>
            <View style={styles.logoWrap}>
              <View style={styles.logoCircle}>
                <Ionicons name="fitness" size={34} color={colors.white} />
              </View>
            </View>
            <Text style={styles.titulo}>
              {esLogin ? 'Welcome back' : 'Create your account'}
            </Text>
            <Text style={styles.subtitulo}>
              {esLogin
                ? 'Sign in to see your logs on all your devices.'
                : 'Your data is stored securely per account.'}
            </Text>

            <Card style={styles.card}>
              <Input
                key="email"
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                style={{ marginBottom: spacing.md }}
              />
              <PasswordInput
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                autoComplete={esLogin ? 'password' : 'new-password'}
                style={{ marginBottom: spacing.md }}
              />
              {esLogin ? null : (
                <>
                  <Text style={styles.hint}>
                    At least 8 characters and one letter.
                  </Text>
                  <PasswordInput
                    placeholder="Confirm password"
                    value={confirmar}
                    onChangeText={setConfirmar}
                    autoCapitalize="none"
                    autoComplete="new-password"
                  />
                </>
              )}

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Button
                variant="primary"
                icon={esLogin ? 'log-in-outline' : 'person-add-outline'}
                onPress={enviar}
                disabled={loading}
                loading={loading}
                style={{ marginTop: spacing.md }}
              >
                {esLogin ? 'Sign in' : 'Sign up'}
              </Button>
              {esLogin ? (
                <TouchableOpacity style={styles.forgotLink} onPress={recuperarPassword} disabled={loading}>
                  <Text style={styles.linkText}>Forgot your password?</Text>
                </TouchableOpacity>
              ) : null}
              {notice ? <Text style={styles.notice}>{notice}</Text> : null}
            </Card>

            <TouchableOpacity
              style={styles.link}
              onPress={() => cambiarModo(esLogin ? 'registro' : 'login')}
            >
              <Text style={styles.linkText}>
                {esLogin
                  ? "Don't have an account? Create one"
                  : 'Already have an account? Sign in'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  logoWrap: { alignItems: 'center', marginBottom: spacing.md },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: { fontSize: font.xxl, fontWeight: '800', color: colors.text, textAlign: 'center' },
  subtitulo: { fontSize: font.base, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.lg },
  card: { padding: spacing.lg },
  error: { color: colors.danger, textAlign: 'center', marginTop: spacing.sm },
  notice: { color: colors.primaryDark, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
  hint: {
    fontSize: font.sm,
    color: colors.textMuted,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  link: { marginTop: spacing.md, alignItems: 'center', paddingVertical: spacing.sm },
  linkText: { color: colors.primary, fontWeight: '600', fontSize: font.base },
  forgotLink: { alignItems: 'center', paddingVertical: spacing.sm },
});
