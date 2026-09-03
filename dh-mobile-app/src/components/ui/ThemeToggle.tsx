import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { radius, spacing, typography } from '../../styles/theme';
import { useTheme } from '../../theme/ThemeProvider';

export function ThemeToggle() {
  const { colorScheme, toggleColorScheme } = useTheme();
  const isDark = colorScheme === 'dark';

  return (
    <Pressable
      onPress={toggleColorScheme}
      hitSlop={8}
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.85 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to night mode'}
    >
      <Text style={styles.icon}>{isDark ? '☀️' : '🌙'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 40,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  icon: {
    ...typography.label,
    fontSize: 16,
  },
});
