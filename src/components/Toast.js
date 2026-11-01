import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, radius, spacing } from '../theme/colors';

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>.');
  return ctx;
}

const TONES = {
  success: { bg: colors.primarySoft, text: colors.primaryDark, icon: 'checkmark-circle' },
  error: { bg: colors.dangerSoft, text: colors.danger, icon: 'alert-circle' },
  info: { bg: colors.surfaceMuted, text: colors.text, icon: 'information-circle' },
};

export default function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  const timer = useRef(null);

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 12, duration: 200, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [opacity, translateY]);

  const showToast = useCallback(
    (message, tone = 'info', duration) => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ message, tone });
      translateY.setValue(12);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
      timer.current = setTimeout(hide, duration || (tone === 'error' ? 4000 : 2600));
    },
    [hide, opacity, translateY],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <ToastView
          toast={toast}
          tone={TONES[toast.tone] || TONES.info}
          opacity={opacity}
          translateY={translateY}
        />
      ) : null}
    </ToastContext.Provider>
  );
}

function ToastView({ toast, tone, opacity, translateY }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Animated.View
        style={[styles.toast, { opacity, transform: [{ translateY }], top: insets.top + spacing.md }]}
      >
        <View style={[styles.iconWrap, { backgroundColor: tone.bg }]}>
          <Ionicons name={tone.icon} size={18} color={tone.text} />
        </View>
        <Text style={[styles.text, { color: tone.text }]} numberOfLines={3}>
          {toast.message}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    alignItems: 'center',
  },
  toast: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: '90%',
    maxWidth: 520,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, fontSize: font.base, fontWeight: '600' },
});