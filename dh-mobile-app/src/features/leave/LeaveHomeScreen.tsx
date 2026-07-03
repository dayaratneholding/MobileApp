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
import type { MobileShortLeaveEntry } from '../../types/shortLeave';
import { LeaveEntryForm } from './LeaveEntryForm';
import { ShortLeaveEntryForm } from './ShortLeaveEntryForm';
import { ViewLeaveBalanceScreen } from './ViewLeaveBalanceScreen';
import { ViewLeaveScreen } from './ViewLeaveScreen';
import { ViewShortLeaveScreen } from './ViewShortLeaveScreen';

type Props = {
  session: AuthSession;
  onBack: () => void;
};

type Screen =
  | 'home'
  | 'add-leave'
  | 'view-leave'
  | 'edit-leave'
  | 'add-short-leave'
  | 'view-short-leave'
  | 'edit-short-leave'
  | 'view-balance';

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
    key: 'add-short-leave',
    title: 'Add Short Leave',
    subtitle: 'Submit a short leave',
    emoji: '⏱️',
    tint: '#EDE9FE',
    accent: '#7C3AED',
  },
  {
    key: 'view-short-leave',
    title: 'View Short Leave',
    subtitle: 'See short leave history',
    emoji: '📝',
    tint: '#FFE4E6',
    accent: colors.danger,
  },
  {
    key: 'view-balance',
    title: 'View Leave Balance',
    subtitle: 'Annual, casual, medical & no pay',
    emoji: '📊',
    tint: '#FEF3C7',
    accent: colors.warning,
    fullWidth: true,
  },
];

type BalanceRow = {
  key: string;
  label: string;
  taken: number | null;
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
      taken: balances.annual?.taken ?? null,
      remaining: balances.annual?.remaining ?? null,
      total: balances.annual?.total ?? null,
      unit: 'days',
      color: colors.primary,
    },
    {
      key: 'casual',
      label: 'Casual',
      taken: balances.casual?.taken ?? null,
      remaining: balances.casual?.remaining ?? null,
      total: balances.casual?.total ?? null,
      unit: 'days',
      color: colors.accent,
    },
    {
      key: 'short',
      label: `Short Leave (${monthLabel})`,
      taken: balances.shortLeaveThisMonth,
      remaining: null,
      total: null,
      unit: 'this month',
      color: colors.warning,
    },
  ];
}

function sumTakenAndRemaining(balances: LeaveBalanceSummary): {
  taken: number | null;
  remaining: number | null;
} {
  const annualTaken = balances.annual?.taken ?? null;
  const casualTaken = balances.casual?.taken ?? null;
  const annualRemaining = balances.annual?.remaining ?? null;
  const casualRemaining = balances.casual?.remaining ?? null;

  if (
    annualTaken === null &&
    casualTaken === null &&
    annualRemaining === null &&
    casualRemaining === null
  ) {
    return { taken: null, remaining: null };
  }

  return {
    taken: (annualTaken ?? 0) + (casualTaken ?? 0),
    remaining: (annualRemaining ?? 0) + (casualRemaining ?? 0),
  };
}

export function LeaveHomeScreen({ session, onBack }: Props) {
  const [screen, setScreen] = useState<Screen>('home');
  const [editLeaveId, setEditLeaveId] = useState<number | null>(null);
  const [editShortLeaveEntry, setEditShortLeaveEntry] =
    useState<MobileShortLeaveEntry | null>(null);
  const [viewLeaveRefreshKey, setViewLeaveRefreshKey] = useState(0);
  const [viewShortLeaveRefreshKey, setViewShortLeaveRefreshKey] = useState(0);
  const [balances, setBalances] = useState<LeaveBalanceSummary | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [balancesError, setBalancesError] = useState<string | null>(null);
  const name = session.userName || session.userID;
  const monthLabel = new Date().toLocaleString('default', { month: 'short' });
  const balanceRows = buildBalanceRows(
    balances ?? { annual: null, casual: null, shortLeaveThisMonth: null },
    monthLabel,
  );
  const balanceTotals = balances ? sumTakenAndRemaining(balances) : null;

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

  if (screen === 'add-short-leave') {
    return (
      <ShortLeaveEntryForm
        session={session}
        onBack={() => setScreen('home')}
        onSuccess={() => {
          setViewShortLeaveRefreshKey((key) => key + 1);
          setScreen('view-short-leave');
        }}
      />
    );
  }

  if (screen === 'view-short-leave') {
    return (
      <ViewShortLeaveScreen
        key={viewShortLeaveRefreshKey}
        session={session}
        refreshKey={viewShortLeaveRefreshKey}
        onBack={() => setScreen('home')}
        onEditShortLeave={(entry) => {
          setEditShortLeaveEntry(entry);
          setScreen('edit-short-leave');
        }}
      />
    );
  }

  if (screen === 'edit-short-leave' && editShortLeaveEntry != null) {
    return (
      <ShortLeaveEntryForm
        session={session}
        editEntry={editShortLeaveEntry}
        onBack={() => setScreen('view-short-leave')}
        onSuccess={() => {
          setViewShortLeaveRefreshKey((key) => key + 1);
          setScreen('view-short-leave');
        }}
      />
    );
  }

  if (screen === 'view-balance') {
    return (
      <ViewLeaveBalanceScreen
        session={session}
        onBack={() => setScreen('home')}
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
            <View style={styles.summaryMain}>
              <Text style={styles.summaryLabel}>LEAVE BALANCE</Text>
              {balancesLoading ? (
                <ActivityIndicator
                  color={colors.primary}
                  style={styles.summaryLoader}
                />
              ) : (
                <View style={styles.summaryStats}>
                  <View style={styles.summaryStat}>
                    <Text style={styles.summaryStatValue}>
                      {formatBalanceValue(balanceTotals?.taken ?? null)}
                    </Text>
                    <Text style={styles.summaryStatLabel}>Taken</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryStat}>
                    <Text style={[styles.summaryStatValue, styles.summaryRemaining]}>
                      {formatBalanceValue(balanceTotals?.remaining ?? null)}
                    </Text>
                    <Text style={styles.summaryStatLabel}>Remaining</Text>
                  </View>
                </View>
              )}
            </View>
            <View style={styles.summaryBadge}>
              <Text style={styles.summaryBadgeText}>Annual + Casual</Text>
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
                      : widget.key === 'add-short-leave'
                        ? () => setScreen('add-short-leave')
                        : widget.key === 'view-short-leave'
                          ? () => setScreen('view-short-leave')
                          : widget.key === 'view-balance'
                            ? () => setScreen('view-balance')
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
                    : 0;

                return (
                  <View
                    key={item.key}
                    style={[
                      styles.balanceRow,
                      index !== balanceRows.length - 1 && styles.balanceSpacing,
                    ]}
                  >
                    <Text style={styles.balanceLabel}>{item.label}</Text>
                    <View style={styles.balanceStats}>
                      <View style={styles.balanceStat}>
                        <Text style={styles.balanceStatLabel}>Taken</Text>
                        <Text style={styles.balanceStatValue}>
                          {formatBalanceValue(item.taken)}
                          {item.taken !== null && item.key !== 'short' ? (
                            <Text style={styles.balanceStatUnit}> days</Text>
                          ) : item.taken !== null ? (
                            <Text style={styles.balanceStatUnit}> {item.unit}</Text>
                          ) : null}
                        </Text>
                      </View>
                      <View style={styles.balanceStat}>
                        <Text style={styles.balanceStatLabel}>Remaining</Text>
                        <Text style={[styles.balanceStatValue, styles.balanceRemaining]}>
                          {formatBalanceValue(item.remaining)}
                          {item.remaining !== null ? (
                            <Text style={styles.balanceStatUnit}> days</Text>
                          ) : item.key === 'short' ? (
                            <Text style={styles.balanceStatUnit}> —</Text>
                          ) : null}
                        </Text>
                      </View>
                    </View>
                    {item.total !== null ? (
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
                    ) : null}
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
  summaryMain: {
    flex: 1,
  },
  summaryStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
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
