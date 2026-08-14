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
import { getEmployeeLoanPaged } from '../../api/endpoints/employeeLoan';
import { radius, spacing, typography, type ColorPalette, type ShadowTokens } from '../../styles/theme';
import { useTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { AuthSession } from '../../types/api';
import type { EmployeeLoanListItem } from '../../types/employeeLoan';
import { formatCurrency } from '../../types/employeeLoan';
import { SalaryAdvanceEntryForm } from './SalaryAdvanceEntryForm';
import { ViewSalaryAdvanceScreen } from './ViewSalaryAdvanceScreen';

type Props = {
  session: AuthSession;
  onBack: () => void;
};

type Screen = 'home' | 'add' | 'view' | 'edit';

type Widget = {
  key: string;
  title: string;
  subtitle: string;
  emoji: string;
  tint: string;
  accent: string;
};

function getWidgets(colors: ColorPalette): Widget[] {
  return [
  {
    key: 'add',
    title: 'Request Advance',
    subtitle: 'Submit a new request',
    emoji: '➕',
    tint: colors.tintDanger,
    accent: colors.danger,
  },
  {
    key: 'view',
    title: 'View Advances',
    subtitle: 'See your history',
    emoji: '📋',
    tint: colors.tintWarning,
    accent: colors.warning,
  },
];
}

function sumRemainingAmount(items: EmployeeLoanListItem[]): number | null {
  const activeItems = items.filter((item) => item.active);
  if (activeItems.length === 0) {
    return null;
  }

  return activeItems.reduce((total, item) => {
    const remaining = item.remainingAmount ?? item.balanceAmount ?? 0;
    return total + remaining;
  }, 0);
}

export function SalaryAdvanceHomeScreen({ session, onBack }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const widgets = getWidgets(colors);
  const [screen, setScreen] = useState<Screen>('home');
  const [editEntry, setEditEntry] = useState<EmployeeLoanListItem | null>(null);
  const [viewRefreshKey, setViewRefreshKey] = useState(0);
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [remainingTotal, setRemainingTotal] = useState<number | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const name = session.userName || session.userID;

  const loadSummary = useCallback(async () => {
    const eeSerialID = session.eESerialID;
    if (!eeSerialID) {
      setSummaryError('Employee ID not found in session.');
      return;
    }

    setSummaryLoading(true);
    setSummaryError(null);

    try {
      const result = await getEmployeeLoanPaged({
        PageNumber: 1,
        PageSize: 50,
        EESerialID: eeSerialID,
        SortColumn: 'startDate',
        SortDirection: 'desc',
      });

      const activeItems = result.items.filter((item) => item.active);
      setActiveCount(activeItems.length);
      setRemainingTotal(sumRemainingAmount(result.items));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load salary advance summary.';
      setSummaryError(message);
      setActiveCount(null);
      setRemainingTotal(null);
    } finally {
      setSummaryLoading(false);
    }
  }, [session.eESerialID]);

  useEffect(() => {
    if (screen === 'home') {
      loadSummary();
    }
  }, [screen, loadSummary, viewRefreshKey]);

  if (screen === 'add') {
    return (
      <SalaryAdvanceEntryForm
        session={session}
        onBack={() => setScreen('home')}
        onSuccess={() => {
          setViewRefreshKey((key) => key + 1);
          setScreen('home');
        }}
      />
    );
  }

  if (screen === 'view') {
    return (
      <ViewSalaryAdvanceScreen
        key={viewRefreshKey}
        session={session}
        refreshKey={viewRefreshKey}
        onBack={() => setScreen('home')}
        onEditSalaryAdvance={(entry) => {
          setEditEntry(entry);
          setScreen('edit');
        }}
      />
    );
  }

  if (screen === 'edit' && editEntry != null) {
    return (
      <SalaryAdvanceEntryForm
        session={session}
        editEntry={editEntry}
        onBack={() => setScreen('view')}
        onSuccess={() => {
          setViewRefreshKey((key) => key + 1);
          setScreen('view');
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
            <Text style={styles.headerEmoji}>💳</Text>
            <Text style={styles.headerTitle}>Salary Advance</Text>
            <Text style={styles.headerSubtitle}>
              {name} · {session.companyCode}
            </Text>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryMain}>
              <Text style={styles.summaryLabel}>ACTIVE ADVANCES</Text>
              {summaryLoading ? (
                <ActivityIndicator
                  color={colors.primary}
                  style={styles.summaryLoader}
                />
              ) : (
                <View style={styles.summaryStats}>
                  <View style={styles.summaryStat}>
                    <Text style={styles.summaryStatValue}>
                      {activeCount ?? '—'}
                    </Text>
                    <Text style={styles.summaryStatLabel}>Active</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryStat}>
                    <Text style={[styles.summaryStatValue, styles.summaryRemaining]}>
                      {formatCurrency(remainingTotal)}
                    </Text>
                    <Text style={styles.summaryStatLabel}>Remaining</Text>
                  </View>
                </View>
              )}
            </View>
            <View style={styles.summaryBadge}>
              <Text style={styles.summaryBadgeText}>Loan Type 1</Text>
            </View>
          </View>

          {summaryError ? (
            <Pressable onPress={loadSummary} style={styles.summaryError}>
              <Text style={styles.summaryErrorText}>{summaryError}</Text>
              <Text style={styles.summaryRetry}>Tap to retry</Text>
            </Pressable>
          ) : null}

          <Text style={styles.sectionTitle}>Quick actions</Text>
          <View style={styles.grid}>
            {widgets.map((widget) => (
              <Pressable
                key={widget.key}
                style={styles.widgetCard}
                onPress={
                  widget.key === 'add'
                    ? () => setScreen('add')
                    : widget.key === 'view'
                      ? () => setScreen('view')
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
        </View>
      </ScrollView>
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
    marginBottom: spacing.md,
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
  summaryLoader: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  summaryBadge: {
    backgroundColor: colors.tintDanger,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  summaryBadgeText: {
    ...typography.label,
    color: colors.danger,
  },
  summaryError: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  summaryErrorText: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
  },
  summaryRetry: {
    ...typography.label,
    color: colors.primary,
    marginTop: spacing.xs,
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
  });
}
