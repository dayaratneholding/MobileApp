import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  radius,
  spacing,
  typography,
  type ColorPalette,
  type ShadowTokens,
} from '../../styles/theme';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { AuthSession } from '../../types/api';

type Props = {
  session: AuthSession;
  onBack: () => void;
};

export function GatePassScreen({ session, onBack }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>GatePass Add</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>GatePass Add</Text>
          <Text style={styles.cardSubtitle}>
            Employee: {session.userName || session.userID}
          </Text>
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ColorPalette, shadow: ShadowTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingTop: spacing.xxxl + spacing.md,
      paddingBottom: spacing.lg,
      paddingHorizontal: spacing.xl,
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
    },
    backBtn: {
      marginRight: spacing.md,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
    },
    backText: {
      ...typography.title,
      color: colors.textOnPrimary,
    },
    title: {
      ...typography.h2,
      color: colors.textOnPrimary,
    },
    body: {
      padding: spacing.xl,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.xl,
      ...shadow.soft,
    },
    cardTitle: {
      ...typography.h3,
      color: colors.text,
    },
    cardSubtitle: {
      ...typography.body,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
  });
}