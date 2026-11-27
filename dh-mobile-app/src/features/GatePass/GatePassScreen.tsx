import React, { useState } from 'react';
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
import { GatePassCreate } from './GatePassCreate';
import { GatePassView } from './GatePassView';

type Props = {
  session: AuthSession;
  onBack: () => void;
  onCreatePress?: () => Promise<void> | void;
  onViewPress?: () => void;
  onConfirmPress?: () => void;
  onApprovePress?: () => void;
};

type GatePassView = 'MENU' | 'CREATE' | 'VIEW' | 'CONFIRM' | 'APPROVE';

export function GatePassScreen({
  session,
  onBack,
  onCreatePress,
  onViewPress,
  onConfirmPress,
  onApprovePress,
}: Props) {
  const styles = useThemedStyles(createStyles);
  const [activeView, setActiveView] = useState<GatePassView>('MENU');

  function handleOpenCreate() {
    setActiveView('CREATE');
  }

  async function handleCreateSubmit() {
    await onCreatePress?.();
    setActiveView('MENU');
  }

  if (activeView === 'CREATE') {
    return (
      <GatePassCreate
        session={session}
        onBack={() => setActiveView('MENU')}
        onSubmit={handleCreateSubmit}
      />
    );
  }

  if (activeView === 'VIEW') {
    return <GatePassView session={session} onBack={() => setActiveView('MENU')} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>GatePass</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.sectionLabel}>Quick Actions</Text>

        <View style={styles.grid}>
          <View style={styles.row}>
            <Pressable
              onPress={handleOpenCreate}
              style={({ pressed }) => [
                styles.card,
                styles.primaryCard,
                pressed && styles.cardPressed,
              ]}
            >
              <View style={[styles.iconBadge, styles.primaryIconBadge]}>
                <Text style={styles.primaryIconText}>＋</Text>
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.primaryCardTitle}>Create{'\n'}GatePass</Text>
                <Text style={styles.primaryCardSubtitle}>
                  Request a new exit or entry pass
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => {
                onViewPress?.();
                setActiveView('VIEW');
              }}
              style={({ pressed }) => [
                styles.card,
                styles.secondaryCard,
                pressed && styles.cardPressed,
              ]}
            >
              <View style={[styles.iconBadge, styles.secondaryIconBadge]}>
                <Text style={styles.secondaryIconText}>☰</Text>
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.cardTitle}>View{'\n'}GatePass</Text>
                <Text style={styles.cardSubtitle}>
                  Check status & pass history
                </Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.row}>
            <Pressable
              onPress={onConfirmPress}
              style={({ pressed }) => [
                styles.card,
                styles.secondaryCard,
                pressed && styles.cardPressed,
              ]}
            >
              <View style={[styles.iconBadge, styles.confirmIconBadge]}>
                <Text style={styles.confirmIconText}>✓</Text>
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.cardTitle}>Confirm{'\n'}GatePass</Text>
                <Text style={styles.cardSubtitle}>
                  Verify & confirm pending passes
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={onApprovePress}
              style={({ pressed }) => [
                styles.card,
                styles.secondaryCard,
                pressed && styles.cardPressed,
              ]}
            >
              <View style={[styles.iconBadge, styles.approveIconBadge]}>
                <Text style={styles.approveIconText}>★</Text>
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.cardTitle}>Approve{'\n'}GatePass</Text>
                <Text style={styles.cardSubtitle}>
                  Review & approve requests
                </Text>
              </View>
            </Pressable>
          </View>
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
      flex: 1,
      padding: spacing.xl,
    },
    sectionLabel: {
      ...typography.label,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: spacing.md,
    },
    grid: {
      gap: spacing.md,
    },
    row: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    card: {
      flex: 1,
      minHeight: 164,
      borderRadius: radius.xl ?? radius.lg,
      padding: spacing.lg,
      justifyContent: 'space-between',
      ...shadow.soft,
    },
    primaryCard: {
      backgroundColor: colors.primary,
    },
    secondaryCard: {
      backgroundColor: colors.surface ?? colors.gradientStart,
      borderWidth: 1,
      borderColor: colors.border ?? 'rgba(0,0,0,0.06)',
    },
    cardPressed: {
      opacity: 0.88,
      transform: [{ scale: 0.98 }],
    },
    iconBadge: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryIconBadge: {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    secondaryIconBadge: {
      backgroundColor: colors.gradientStart,
    },
    confirmIconBadge: {
      backgroundColor: 'rgba(16, 185, 129, 0.14)',
    },
    approveIconBadge: {
      backgroundColor: 'rgba(245, 158, 11, 0.14)',
    },
    primaryIconText: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.textOnPrimary,
    },
    secondaryIconText: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.primary,
    },
    confirmIconText: {
      fontSize: 20,
      fontWeight: '700',
      color: '#10B981',
    },
    approveIconText: {
      fontSize: 20,
      fontWeight: '700',
      color: '#F59E0B',
    },
    cardFooter: {
      marginTop: spacing.lg,
    },
    primaryCardTitle: {
      ...typography.h3,
      color: colors.textOnPrimary,
    },
    primaryCardSubtitle: {
      ...typography.caption ?? typography.body,
      color: colors.textOnPrimary,
      opacity: 0.85,
      marginTop: spacing.xs,
    },
    cardTitle: {
      ...typography.h3,
      color: colors.text,
    },
    cardSubtitle: {
      ...typography.caption ?? typography.body,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
  });
}