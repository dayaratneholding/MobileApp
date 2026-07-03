import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { fetchYearLeaveAllocationBalances } from '../../api/endpoints/leave';
import { colors, radius, spacing, typography, shadow } from '../../styles/theme';
import type { AuthSession } from '../../types/api';
import type { LeaveYearBalanceItem, YearLeaveAllocationSummary } from '../../types/leave';

type Props = {
  session: AuthSession;
  onBack: () => void;
};

type BalanceRow = {
  key: string;
  label: string;
  item: LeaveYearBalanceItem | null;
  color: string;
};

function formatCount(value: number | null): string {
  if (value === null) {
    return '—';
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(1);
}

function buildRows(summary: YearLeaveAllocationSummary): BalanceRow[] {
  return [
    {
      key: 'annual',
      label: 'Annual',
      item: summary.annual,
      color: colors.primary,
    },
    {
      key: 'casual',
      label: 'Casual',
      item: summary.casual,
      color: colors.accent,
    },
    {
      key: 'medical',
      label: 'Medical',
      item: summary.medical,
      color: colors.success,
    },
    {
      key: 'no-pay-authorized',
      label: 'No Pay Authorized',
      item: summary.noPayAuthorized,
      color: colors.warning,
    },
    {
      key: 'no-pay-unauthorized',
      label: 'No Pay Unauthorized',
      item: summary.noPayUnauthorized,
      color: colors.danger,
    },
  ];
}

function getRemaining(item: LeaveYearBalanceItem | null): number | null {
  if (!item || item.taken === null || item.entitlement === null) {
    return null;
  }

  return Math.max(0, item.entitlement - item.taken);
}

function sumYearTotals(summary: YearLeaveAllocationSummary): {
  taken: number | null;
  remaining: number | null;
} {
  const items = [
    summary.annual,
    summary.casual,
    summary.medical,
    summary.noPayAuthorized,
    summary.noPayUnauthorized,
  ];

  let taken = 0;
  let remaining = 0;
  let hasTaken = false;
  let hasRemaining = false;

  for (const item of items) {
    if (item?.taken != null) {
      taken += item.taken;
      hasTaken = true;
    }

    const itemRemaining = getRemaining(item);
    if (itemRemaining != null) {
      remaining += itemRemaining;
      hasRemaining = true;
    }
  }

  return {
    taken: hasTaken ? taken : null,
    remaining: hasRemaining ? remaining : null,
  };
}

export function ViewLeaveBalanceScreen({ session, onBack }: Props) {
  const [summary, setSummary] = useState<YearLeaveAllocationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const rows = useMemo(
    () =>
      buildRows(
        summary ?? {
          year: new Date().getFullYear(),
          annual: null,
          casual: null,
          medical: null,
          noPayAuthorized: null,
          noPayUnauthorized: null,
        },
      ),
    [summary],
  );

  const loadBalances = useCallback(async () => {
    const eeSerialID = session.eESerialID;

    if (!eeSerialID) {
      setError('Employee ID not found in session.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await fetchYearLeaveAllocationBalances(
        eeSerialID,
        session.comSerialID,
      );
      setSummary(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load leave balances.';
      setError(message);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [session.comSerialID, session.eESerialID]);

  useEffect(() => {
    loadBalances();
  }, [loadBalances]);

  const yearLabel = summary?.year ?? new Date().getFullYear();
  const yearTotals = summary ? sumYearTotals(summary) : null;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <ScrollView showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Pressable style={styles.backBtn} onPress={onBack} hitSlop={8}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Leave Balance</Text>
          <Text style={styles.headerSubtitle}>
            {yearLabel} allocation · {session.companyCode}
          </Text>
        </LinearGradient>

        <View style={styles.body}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>CURRENT YEAR · {yearLabel}</Text>
            <View style={styles.summaryStats}>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryStatValue}>
                  {formatCount(yearTotals?.taken ?? null)}
                </Text>
                <Text style={styles.summaryStatLabel}>Total Taken</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryStat}>
                <Text style={[styles.summaryStatValue, styles.summaryRemaining]}>
                  {formatCount(yearTotals?.remaining ?? null)}
                </Text>
                <Text style={styles.summaryStatLabel}>Total Remaining</Text>
              </View>
            </View>
            <Text style={styles.summaryHint}>Across all leave types below</Text>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.loadingText}>Loading balances…</Text>
            </View>
          ) : null}

          {!loading && error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable onPress={loadBalances} hitSlop={8}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : null}

          {!loading && !error ? (
            <View style={styles.balanceCard}>
              {rows.map((row, index) => {
                const taken = row.item?.taken ?? null;
                const entitlement = row.item?.entitlement ?? null;
                const remaining = getRemaining(row.item);
                const progress =
                  remaining !== null && entitlement
                    ? Math.max(0, Math.min(1, remaining / entitlement))
                    : 0;

                return (
                  <View
                    key={row.key}
                    style={[
                      styles.balanceRow,
                      index !== rows.length - 1 && styles.balanceSpacing,
                    ]}
                  >
                    <Text style={styles.balanceLabel}>{row.label}</Text>

                    <View style={styles.balanceStats}>
                      <View style={styles.balanceStat}>
                        <Text style={styles.balanceStatLabel}>Taken</Text>
                        <Text style={styles.balanceStatValue}>
                          {formatCount(taken)}
                          {taken !== null ? (
                            <Text style={styles.balanceStatUnit}> days</Text>
                          ) : null}
                        </Text>
                      </View>
                      <View style={styles.balanceStat}>
                        <Text style={styles.balanceStatLabel}>Remaining</Text>
                        <Text style={[styles.balanceStatValue, styles.balanceRemaining]}>
                          {formatCount(remaining)}
                          {remaining !== null ? (
                            <Text style={styles.balanceStatUnit}> days</Text>
                          ) : null}
                        </Text>
                      </View>
                    </View>

                    {entitlement !== null ? (
                      <Text style={styles.entitlementText}>
                        Entitlement: {formatCount(entitlement)} days
                      </Text>
                    ) : null}

                    <View style={styles.track}>
                      <View
                        style={[
                          styles.trackFill,
                          {
                            width: `${progress * 100}%`,
                            backgroundColor: row.color,
                            opacity: remaining !== null ? 1 : 0.25,
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: spacing.xxxl + spacing.md,
    paddingBottom: spacing.xxxl + spacing.xl,
    paddingHorizontal: spacing.xl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  backBtn: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    marginBottom: spacing.lg,
  },
  backText: {
    ...typography.label,
    color: colors.textOnPrimary,
  },
  headerTitle: {
    ...typography.h1,
    color: colors.textOnPrimary,
  },
  headerSubtitle: {
    ...typography.body,
    color: 'rgba(255,255,255,0.85)',
    marginTop: spacing.xs,
    textTransform: 'capitalize',
  },
  body: {
    padding: spacing.xl,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginTop: -spacing.xxxl,
    marginBottom: spacing.xl,
    ...shadow.card,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textMuted,
    letterSpacing: 1,
    fontWeight: '600',
  },
  summaryStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  summaryStat: {
    flex: 1,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },
  summaryStatValue: {
    ...typography.h2,
    color: colors.text,
  },
  summaryRemaining: {
    color: colors.primary,
  },
  summaryStatLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  summaryHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  loadingText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  errorBox: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
  },
  retryText: {
    ...typography.label,
    color: colors.primary,
    marginTop: spacing.sm,
  },
  balanceCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...shadow.soft,
  },
  balanceRow: {},
  balanceSpacing: {
    marginBottom: spacing.lg,
  },
  balanceLabel: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  balanceStats: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  balanceStat: {
    flex: 1,
  },
  balanceStatLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: 2,
  },
  balanceStatValue: {
    ...typography.title,
    color: colors.text,
  },
  balanceRemaining: {
    color: colors.primary,
  },
  balanceStatUnit: {
    ...typography.caption,
    color: colors.textMuted,
  },
  entitlementText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.inputBg,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
});
