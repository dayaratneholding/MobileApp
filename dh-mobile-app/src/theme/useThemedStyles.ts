import { useMemo } from 'react';
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
import type { ColorPalette, ShadowTokens } from '../styles/theme';
import { useTheme } from './ThemeProvider';

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

export function useThemedStyles<T extends NamedStyles<T>>(
  factory: (colors: ColorPalette, shadow: ShadowTokens) => T,
): T {
  const { colors, shadow } = useTheme();

  return useMemo(
    () => StyleSheet.create(factory(colors, shadow)),
    [colors, factory, shadow],
  );
}
