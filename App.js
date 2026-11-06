import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, AppState, Platform, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import AuthScreen from './src/screens/AuthScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import ErrorBoundary from './src/components/ErrorBoundary';
import ToastProvider from './src/components/Toast';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { font, radius, spacing } from './src/theme/colors';
import { getSession, onAuthStateChange, isDemoMode } from './src/services/auth';
import { supabase } from './src/services/supabaseClient';
import { friendlyError } from './src/utils/networkErrors.mjs';

const IS_WEB = Platform.OS === 'web';

const DemoBanner = () => {
  const demo = isDemoMode();
  const { colors } = useTheme();
  return (
    <View
      style={{
        backgroundColor: demo ? colors.primaryDark : colors.primary,
        paddingVertical: 6,
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          color: colors.white,
          fontSize: 12,
          fontWeight: '600',
        }}
      >
        {demo ? '● Demo — logs are local; AI and sync use the internet' : '● Account mode — syncs when connected'}
      </Text>
    </View>
  );
};

function AppShell() {
  const { colors, isDark } = useTheme();
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  const navigationTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.danger,
      },
    };
  }, [colors, isDark]);

  const iniciar = async () => {
    setReady(false);
    setError(null);
    try {
      const s = await getSession();
      setSession(s);
    } catch (e) {
      setError(friendlyError(e, 'The app could not start.'));
    } finally {
      setReady(true);
    }
  };

  useEffect(() => {
    let activo = true;
    getSession()
      .then((s) => {
        if (activo) {
          setSession(s);
          setReady(true);
        }
      })
      .catch((e) => {
        if (activo) {
          setError(friendlyError(e, 'The app could not start.'));
          setReady(true);
        }
      });
    const sub = onAuthStateChange((s, event) => {
      if (activo) {
        setSession(s);
        if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      }
    });

    // Keep the session alive across app backgrounding / tab switching.
    // Supabase refreshes the access token automatically; on native the timer
    // is paused while backgrounded, so we (re)start it on foreground.
    let appStateSub = null;
    if (!isDemoMode()) {
      supabase.auth.startAutoRefresh();
      appStateSub = AppState.addEventListener('change', (state) => {
        if (state === 'active') supabase.auth.startAutoRefresh();
        else supabase.auth.stopAutoRefresh();
      });
    }

    return () => {
      activo = false;
      sub.data?.subscription?.unsubscribe?.();
      appStateSub?.remove?.();
    };
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: spacing.lg }}>
        <Text style={{ fontSize: font.md, color: colors.text, fontWeight: '700', marginBottom: spacing.xs }}>
          Something went wrong
        </Text>
        <Text style={{ fontSize: font.base, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.lg }}>
          {error}
        </Text>
        <TouchableOpacity
          onPress={iniciar}
          style={{
            backgroundColor: colors.primary,
            borderRadius: radius.md,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.lg,
          }}
        >
          <Text style={{ color: colors.white, fontSize: font.base, fontWeight: '700' }}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ToastProvider>
          {IS_WEB && <DemoBanner />}
          <NavigationContainer theme={navigationTheme}>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            {session
              ? passwordRecovery
                ? <ResetPasswordScreen onComplete={() => setPasswordRecovery(false)} />
                : <AppNavigator />
              : <AuthScreen />}
          </NavigationContainer>
        </ToastProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
