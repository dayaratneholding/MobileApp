import React, { useCallback, useEffect, useState } from 'react';
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
import { fetchLeaveBalances } from '../../api/endpoints/leave';
import { colors, radius, spacing, typography, shadow } from '../../styles/theme';
import type { AuthSession } from '../../types/api';
import type { LeaveBalanceSummary } from '../../types/leave';
import { LeaveEntryForm } from './LeaveEntryForm';
import { ViewLeaveScreen } from './ViewLeaveScreen';

type Props = {
  session: AuthSession;
  onBack: () => void;
};

type Screen = 'home' | 'add-leave' | 'view-leave' | 'edit-leave';

type LeaveWidget = {
  key: string;
  title: string;
  subtitle: string;
  emoji: string;
  tint: string;
  accent: string;
  fullWidth?: boolean;
};

const leaveWidgets: LeaveWidget[] = [
  {
    key: 'add-leave',
    title: 'Add Leave',
    subtitle: 'Submit a new request',
    emoji: '➕',
    tint: '#E0E7FF',
    accent: colors.primary,
  },
  {
    key: 'view-leave',
    title: 'View Leave',
    subtitle: 'See your requests',
    emoji: '📋',
    tint: '#DCFCE7',
    accent: colors.success,
  },
  {
    key: 'view-balance',
    title: 'View Leave Balance',
    subtitle: 'Annual, casual & short leave',
    emoji: '📊',
    tint: '#FEF3C7',
    accent: colors.warning,
    fullWidth: true,
  },
];

type BalanceRow = {
  key: string;
  label: string;
  remaining: number | null;
  total: number | null;
  unit: string;
  color: string;
};

function formatBalanceValue(value: number | null): string {
  if (value === null) {
    return '—';
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(1);
}

function buildBalanceRows(
  balances: LeaveBalanceSummary,
  monthLabel: string,
): BalanceRow[] {
  return [
    {
      key: 'annual',
      label: 'Annual',
      remaining: balances.annual?.remaining ?? null,
      total: balances.annual?.total ?? null,
      unit: 'days',
      color: colors.primary,
    },
    {
      key: 'casual',
      label: 'Casual',
      remaining: balances.casual?.remaining ?? null,
      total: balances.casual?.total ?? null,
      unit: 'days',
      color: colors.accent,
    },
    {
      key: 'short',
      label: `Short Leave (${monthLabel})`,
      remaining: balances.shortLeaveThisMonth,
      total: null,
      unit: 'this month',
      color: colors.warning,
    },
  ];
}

function sumAnnualAndCasual(balances: LeaveBalanceSummary): number | null {
  const annual = balances.annual?.remaining ?? null;
  const casual = balances.casual?.remaining ?? null;

  if (annual === null && casual === null) {
    return null;
  }

  return (annual ?? 0) + (casual ?? 0);
}

export function LeaveHomeScreen({ session, onBack }: Props) {
  const [screen, setScreen] = useState<Screen>('home');
  const [editLeaveId, setEditLeaveId] = useState<number | null>(null);
  const [viewLeaveRefreshKey, setViewLeaveRefreshKey] = useState(0);
  const [balances, setBalances] = useState<LeaveBalanceSummary | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [balancesError, setBalancesError] = useState<string | null>(null);
  const name = session.userName || session.userID;
  const monthLabel = new Date().toLocaleString('default', { month: 'short' });
  const balanceRows = buildBalanceRows(
    balances ?? { annual: null, casual: null, shortLeaveThisMonth: null },
    monthLabel,
  );
  const totalRemaining = balances ? sumAnnualAndCasual(balances) : null;

  const loadBalances = useCallback(async () => {
    const eeSerialID = session.eESerialID;
    const comSerialID = session.comSerialID;

    if (!eeSerialID) {
      setBalancesError('Employee ID not found in session.');
      return;
    }

    setBalancesLoading(true);
    setBalancesError(null);

    try {
      const summary = await fetchLeaveBalances(eeSerialID, comSerialID);
      setBalances(summary);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load leave balances.';
      setBalancesError(message);
    } finally {
      setBalancesLoading(false);
    }
  }, [session.comSerialID, session.eESerialID]);

  useEffect(() => {
    if (screen === 'home') {
      loadBalances();
    }
  }, [screen, loadBalances]);

  if (screen === 'add-leave') {
    return (
      <LeaveEntryForm
        session={session}
        onBack={() => setScreen('home')}
        onSuccess={() => setScreen('home')}
      />
    );
  }

  if (screen === 'view-leave') {
    return (
      <ViewLeaveScreen
        key={viewLeaveRefreshKey}
        session={session}
        refreshKey={viewLeaveRefreshKey}
        onBack={() => setScreen('home')}
        onEditLeave={(leaveId) => {
          setEditLeaveId(leaveId);
          setScreen('edit-leave');
        }}
      />
    );
  }

  if (screen === 'edit-leave' && editLeaveId != null) {
    return (
      <LeaveEntryForm
        session={session}
        editLeaveId={editLeaveId}
        onBack={() => setScreen('view-leave')}
        onSuccess={() => {
          setViewLeaveRefreshKey((key) => key + 1);
          setScreen('view-leave');
        }}
      />
    );
  }

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
          <View style={styles.appBar}>
            <Pressable style={styles.backBtn} onPress={onBack} hitSlop={8}>
              <Text style={styles.backText}>← Back</Text>
            </Pressable>
          </View>

          <View style={styles.headerContent}>
            <Text style={styles.headerEmoji}>🏖️</Text>
            <Text style={styles.headerTitle}>Leave Management</Text>
            <Text style={styles.headerSubtitle}>
              {name} · {session.companyCode}
            </Text>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          <View style={styles.summaryCard}>
            <View>
              <Text style={styles.summaryLabel}>TOTAL LEAVE BALANCE</Text>
              {balancesLoading ? (
                <ActivityIndicator
                  color={colors.primary}
                  style={styles.summaryLoader}
                />
              ) : (
                <Text style={styles.summaryValue}>
                  {formatBalanceValue(totalRemaining)}
                  {totalRemaining !== null ? ' days' : ''}
                </Text>
              )}
            </View>
            <View style={styles.summaryBadge}>
              <Text style={styles.summaryBadgeText}>Available</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Quick actions</Text>
          <View style={styles.grid}>
            {leaveWidgets.map((widget) => (
              <Pressable
                key={widget.key}
                style={[styles.widgetCard, widget.fullWidth && styles.widgetFull]}
                onPress={
                  widget.key === 'add-leave'
                    ? () => setScreen('add-leave')
                    : widget.key === 'view-leave'
                      ? () => setScreen('view-leave')
                      : undefined
                }
              >
                <View style={[styles.widgetIcon, { backgroundColor: widget.tint }]}>
                  <Text style={styles.widgetEmoji}>{widget.emoji}</Text>
                </View>
                <Text style={styles.widgetTitle}>{widget.title}</Text>
                <Text style={styles.widgetSubtitle}>{widget.subtitle}</Text>
                <Text style={[styles.widgetAction, { color: widget.accent }]}>
                  Open →
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Leave balance</Text>
          <View style={styles.balanceCard}>
            {balancesLoading && (
              <View style={styles.balanceLoading}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.balanceLoadingText}>Loading balances…</Text>
              </View>
            )}

            {!balancesLoading && balancesError && (
              <View style={styles.balanceError}>
                <Text style={styles.balanceErrorText}>{balancesError}</Text>
                <Pressable onPress={loadBalances} hitSlop={8}>
                  <Text style={styles.balanceRetry}>Retry</Text>
                </Pressable>
              </View>
            )}

            {!balancesLoading &&
              !balancesError &&
              balanceRows.map((item, index) => {
                const pct =
                  item.total && item.remaining !== null
                    ? Math.max(0, Math.min(1, item.remaining / item.total))
                    : item.remaining !== null
                      ? 1
                      : 0;

                return (
                  <View
                    key={item.key}
                    style={[
                      styles.balanceRow,
                      index !== balanceRows.length - 1 && styles.balanceSpacing,
                    ]}
                  >
                    <View style={styles.balanceTop}>
                      <Text style={styles.balanceLabel}>{item.label}</Text>
                      <Text style={styles.balanceValue}>
                        {formatBalanceValue(item.remaining)}
                        {item.total !== null ? (
                          <Text style={styles.balanceTotal}>
                            {' '}
                            / {formatBalanceValue(item.total)} {item.unit}
                          </Text>
                        ) : item.remaining !== null ? (
                          <Text style={styles.balanceTotal}> {item.unit}</Text>
                        ) : null}
                      </Text>
                    </View>
                    <View style={styles.track}>
                      <View
                        style={[
                          styles.trackFill,
                          {
                            width: `${pct * 100}%`,
                            backgroundColor: item.color,
                            opacity: item.remaining !== null ? 1 : 0.25,
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
          </View>
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
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  backText: {
    ...typography.label,
    color: colors.textOnPrimary,
  },
  headerContent: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  headerEmoji: {
    fontSize: 40,
    marginBottom: spacing.sm,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  summaryValue: {
    ...typography.h1,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  summaryLoader: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  summaryBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  summaryBadgeText: {
    ...typography.label,
    color: colors.success,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  widgetCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.soft,
  },
  widgetFull: {
    width: '100%',
  },
  widgetIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  widgetEmoji: {
    fontSize: 26,
  },
  widgetTitle: {
    ...typography.title,
    color: colors.text,
  },
  widgetSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  widgetAction: {
    ...typography.label,
    marginTop: spacing.sm,
  },
  balanceCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...shadow.soft,
  },
  balanceLoading: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  balanceLoadingText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  balanceError: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  balanceErrorText: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
  },
  balanceRetry: {
    ...typography.label,
    color: colors.primary,
    marginTop: spacing.sm,
  },
  balanceRow: {},
  balanceSpacing: {
    marginBottom: spacing.lg,
  },
  balanceTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.sm,
  },
  balanceLabel: {
    ...typography.title,
    color: colors.text,
  },
  balanceValue: {
    ...typography.title,
    color: colors.text,
  },
  balanceTotal: {
    ...typography.caption,
    color: colors.textMuted,
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
