import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radius, spacing, typography } from '../../styles/theme';
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

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  itemSelected: {
    borderColor: colors.primary,
    backgroundColor: '#EEF2FF',
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
    alignItems: 'center',
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
    textAlign: 'center',
  },
});
