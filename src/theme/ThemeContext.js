import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import { palettes } from './colors';
import { storage } from '../services/storage';

const THEME_KEY = 'openfit:theme-mode:v1';

export const THEME_MODES = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const ThemeContext = createContext(null);

const isMode = (value) => THEME_MODES.some((mode) => mode.value === value);

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  // Dark is the historical default, so existing installs keep the same look
  // until the user chooses otherwise.
  const [mode, setModeState] = useState('dark');

  useEffect(() => {
    let active = true;
    storage
      .getItem(THEME_KEY)
      .then((stored) => {
        if (active && isMode(stored)) setModeState(stored);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const resolvedMode = mode === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : mode;
  const colors = palettes[resolvedMode];
  const isDark = resolvedMode === 'dark';

  const setMode = useCallback((next) => {
    if (!isMode(next)) return;
    setModeState(next);
    storage.setItem(THEME_KEY, next).catch(() => {});
  }, []);

  // Keep native OS surfaces and the web page in sync with the app background.
  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof document !== 'undefined') {
        document.documentElement.style.backgroundColor = colors.background;
        document.documentElement.style.colorScheme = resolvedMode;
        if (document.body) document.body.style.backgroundColor = colors.background;
      }
      return;
    }
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background, resolvedMode]);

  const value = useMemo(
    () => ({ mode, resolvedMode, isDark, colors, setMode }),
    [mode, resolvedMode, isDark, colors, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside <ThemeProvider>.');
  return theme;
}

// Memoised StyleSheet factory: components keep `makeStyles(colors)` at module
// scope and call this hook to rebuild only when the palette changes.
export function useThemedStyles(factory) {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [factory, colors]);
}
