import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import AuthScreen from './src/screens/AuthScreen';
import ErrorBoundary from './src/components/ErrorBoundary';
import ToastProvider from './src/components/Toast';
import { colors } from './src/theme/colors';
import { getSession, onAuthStateChange } from './src/services/auth';

export default function App() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let activo = true;
    getSession().then((s) => {
      if (activo) {
        setSession(s);
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

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ToastProvider>
          <NavigationContainer>
            <StatusBar style="auto" />
            {session ? <AppNavigator /> : <AuthScreen />}
          </NavigationContainer>
        </ToastProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}