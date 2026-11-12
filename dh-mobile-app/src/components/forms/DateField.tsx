import React, { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { radius, spacing, typography, type ColorPalette } from '../../styles/theme';
import { useTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
};

function parseDateKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplay(value: string): string {
  const date = parseDateKey(value);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function DateField({ label, value, onChange, minimumDate, maximumDate }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [open, setOpen] = useState(false);

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setOpen(false);
      if (event.type !== 'set' || !selected) return;
    }
    if (!selected) return;
    onChange(toDateKey(selected));
    if (Platform.OS === 'ios') setOpen(false);
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.field} onPress={() => setOpen((current) => !current)}>
        <Text style={styles.value}>{value ? formatDisplay(value) : 'Select a date'}</Text>
        <Text style={styles.hint}>Calendar</Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={parseDateKey(value)}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={handleChange}
          themeVariant="light"
          accentColor={colors.primary}
        />
      ) : null}
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return {
    wrapper: {
      width: '100%' as const,
      marginBottom: spacing.lg,
    },
    label: {
      ...typography.label,
      color: colors.textSecondary,
      marginBottom: spacing.sm,
    },
    field: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      backgroundColor: colors.inputBg,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingHorizontal: spacing.lg,
      height: 54,
    },
    value: {
      ...typography.body,
      color: colors.text,
    },
    hint: {
      ...typography.caption,
      color: colors.primary,
      fontWeight: '700' as const,
    },
  };
}
