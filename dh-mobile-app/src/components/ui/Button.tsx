import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { radius, spacing, typography, type ColorPalette } from '../../styles/theme';
import { useTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';

type Variant = 'primary' | 'outline' | 'ghost';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const isDisabled = disabled || loading;

  if (variant === 'primary') {
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.base,
          { opacity: isDisabled ? 0.6 : pressed ? 0.9 : 1 },
          style,
        ]}
      >
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {loading ? (
            <ActivityIndicator color={colors.textOnPrimary} />
          ) : (
            <Text style={styles.primaryLabel}>{label}</Text>
          )}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles.nonPrimary,
        variant === 'outline' && styles.outline,
        { opacity: isDisabled ? 0.6 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <Text style={styles.secondaryLabel}>{label}</Text>
      )}
    </Pressable>
  );
}

function createStyles(colors: ColorPalette) {
  return {
    base: {
      borderRadius: radius.md,
      overflow: 'hidden' as const,
    },
    gradient: {
      height: 54,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      paddingHorizontal: spacing.xl,
    },
    nonPrimary: {
      height: 54,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      paddingHorizontal: spacing.xl,
      backgroundColor: 'transparent',
    },
    outline: {
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    primaryLabel: {
      ...typography.title,
      color: colors.textOnPrimary,
    },
    secondaryLabel: {
      ...typography.title,
      color: colors.primary,
    },
  };
}
