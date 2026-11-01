import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import AuthScreen from './src/screens/AuthScreen';
import ErrorBoundary from './src/components/ErrorBoundary';
import ToastProvider from './src/components/Toast';
import { colors, font, radius, spacing } from './src/theme/colors';
import { getSession, onAuthStateChange, isDemoMode } from './src/services/auth';

const IS_WEB = Platform.OS === 'web';

const DemoBanner = () => {
  const demo = isDemoMode();
  return (
    <View
      style={{
        backgroundColor: demo ? colors.primaryDark : colors.surface,
        paddingVertical: 6,
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          color: demo ? colors.white : colors.textMuted,
          fontSize: 12,
          fontWeight: '600',
        }}
      >
        {demo ? '● DEMO MODE — local data' : '● Production mode'}
      </Text>
    </View>
  );
};

export default function App() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  const iniciar = async () => {
    setReady(false);
    setError(null);
    try {
      const s = await getSession();
      setSession(s);
    } catch (e) {
      setError(e.message || 'The app could not start.');
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
          setError(e.message || 'The app could not start.');
          setReady(true);
        }
      });
    const sub = onAuthStateChange((s) => {
      if (activo) setSession(s);
    });
    return () => {
      activo = false;
      sub.data?.subscription?.unsubscribe?.();
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
          <NavigationContainer>
            <StatusBar style="auto" />
            {session ? <AppNavigator /> : <AuthScreen />}
          </NavigationContainer>
        </ToastProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
