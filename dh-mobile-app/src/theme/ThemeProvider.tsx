import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createShadow,
  getPalette,
  type ColorPalette,
  type ColorScheme,
  type ShadowTokens,
  type ThemePreference,
} from '../styles/theme';

const STORAGE_KEY = 'dh-theme-preference';

type ThemeContextValue = {
  colors: ColorPalette;
  shadow: ShadowTokens;
  colorScheme: ColorScheme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  toggleColorScheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveScheme(
  preference: ThemePreference,
  systemScheme: ColorScheme | null | undefined,
): ColorScheme {
  if (preference === 'light' || preference === 'dark') {
    return preference;
  }

  return systemScheme === 'dark' ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    let cancelled = false;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (cancelled) return;
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setPreferenceState(stored);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const colorScheme = resolveScheme(preference, systemScheme);
  const colors = getPalette(colorScheme);
  const shadow = useMemo(() => createShadow(colors), [colors]);

  const toggleColorScheme = useCallback(() => {
    setPreference(colorScheme === 'dark' ? 'light' : 'dark');
  }, [colorScheme, setPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors,
      shadow,
      colorScheme,
      preference,
      setPreference,
      toggleColorScheme,
    }),
    [colorScheme, colors, preference, setPreference, shadow, toggleColorScheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return context;
}
