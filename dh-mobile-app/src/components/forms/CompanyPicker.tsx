import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from 'react-native';
import { radius, spacing, typography, type ColorPalette } from '../../styles/theme';
import { useTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { UserCompany } from '../../types/api';

type Props = {
  companies: UserCompany[];
  selected?: UserCompany | null;
  loading?: boolean;
  onSelect: (company: UserCompany) => void;
};

export function CompanyPicker({
  companies,
  selected,
  loading = false,
  onSelect,
}: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Loading companies...</Text>
      </View>
    );
  }

  if (companies.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyText}>No companies found for this user.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>Select Company</Text>
      {companies.map((company) => {
        const isSelected = selected?.comSerialID === company.comSerialID;

        return (
          <Pressable
            key={company.comSerialID}
            onPress={() => onSelect(company)}
            style={[styles.item, isSelected && styles.itemSelected]}
          >
            <View style={styles.itemContent}>
              <Text style={[styles.itemName, isSelected && styles.itemNameSelected]}>
                {company.comName}
              </Text>
              <Text style={styles.itemCode}>{company.comCode}</Text>
            </View>
            {isSelected ? <Text style={styles.check}>✓</Text> : null}
          </Pressable>
        );
      })}
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
    item: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      backgroundColor: colors.inputBg,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: 'transparent',
      padding: spacing.lg,
      marginBottom: spacing.sm,
    },
    itemSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.tintSelected,
    },
    itemContent: {
      flex: 1,
    },
    itemName: {
      ...typography.title,
      color: colors.text,
    },
    itemNameSelected: {
      color: colors.primary,
    },
    itemCode: {
      ...typography.caption,
      color: colors.textMuted,
      marginTop: 2,
    },
    check: {
      ...typography.title,
      color: colors.primary,
      marginLeft: spacing.md,
    },
    loadingBox: {
      alignItems: 'center' as const,
      paddingVertical: spacing.xl,
      marginBottom: spacing.lg,
    },
    loadingText: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: spacing.sm,
    },
    emptyBox: {
      backgroundColor: colors.inputBg,
      borderRadius: radius.md,
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    emptyText: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center' as const,
    },
  };
}
