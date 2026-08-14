import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { radius, spacing, typography, type ColorPalette } from '../../styles/theme';
import { useThemedStyles } from '../../theme/useThemedStyles';

type Option<T extends number> = {
  value: T;
  label: string;
};

type Props<T extends number> = {
  label: string;
  options: Option<T>[];
  value?: T;
  onChange: (value: T) => void;
  error?: string;
};

export function OptionPicker<T extends number>({
  label,
  options,
  value,
  onChange,
  error,
}: Props<T>) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.list}>
        {options.map((option) => {
          const selected = value === option.value;

          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={[styles.item, selected && styles.itemSelected]}
            >
              <Text style={[styles.itemText, selected && styles.itemTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return {
    wrapper: {
      marginBottom: spacing.lg,
    },
    label: {
      ...typography.label,
      color: colors.textSecondary,
      marginBottom: spacing.sm,
    },
    list: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
    },
    item: {
      backgroundColor: colors.inputBg,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderWidth: 1.5,
      borderColor: 'transparent',
      marginRight: spacing.sm,
      marginBottom: spacing.sm,
    },
    itemSelected: {
      backgroundColor: colors.tintSelected,
      borderColor: colors.primary,
    },
    itemText: {
      ...typography.caption,
      color: colors.text,
    },
    itemTextSelected: {
      color: colors.primary,
      fontWeight: '600' as const,
    },
    error: {
      ...typography.caption,
      color: colors.danger,
      marginTop: spacing.xs,
    },
  };
}
