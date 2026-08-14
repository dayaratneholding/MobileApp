import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { getAttendanceSummary } from '../../api/endpoints/attendance';
import { getEmployeeLoanPaged } from '../../api/endpoints/employeeLoan';
import { fetchLeaveBalances } from '../../api/endpoints/leave';
import { getApiErrorMessage } from '../../api/client/client';
import { colors, radius, spacing, typography, shadow } from '../../styles/theme';
import type { AuthSession } from '../../types/api';
import type { AttendanceSummary } from '../../types/attendance';
import { LeaveHomeScreen } from '../leave/LeaveHomeScreen';
import { SalaryAdvanceHomeScreen } from '../salaryAdvance/SalaryAdvanceHomeScreen';
import { PayslipScreen } from '../payslip/PayslipScreen';
import { ViewAttendanceScreen } from '../attendance/ViewAttendanceScreen';

type Props = {
  session: AuthSession;
  onLogout: () => void;
};

type Widget = {
  key: string;
  title: string;
  subtitle: string;
  value: string;
  emoji: string;
  tint: string;
  accent: string;
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

export function Dashboard({ session, onLogout }: Props) {
  const [activeScreen, setActiveScreen] = useState<
    'main' | 'leave' | 'salary-advance' | 'payslip' | 'attendance'
  >('main');
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
  const [leaveRemaining, setLeaveRemaining] = useState<number | null>(null);
  const [salaryAdvanceCount, setSalaryAdvanceCount] = useState<number | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');

  const name = session.userName || session.userID;
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
  const monthLabel = new Date().toLocaleString('default', { month: 'short' });

  const loadDashboardSummary = useCallback(async () => {
    const eeSerialID = session.eESerialID;

    if (!eeSerialID) {
      setSummaryError('Employee ID not found in session.');
      return;
    }

    setSummaryLoading(true);
    setSummaryError('');

    try {
      const [attendanceResult, leaveResult, salaryAdvanceResult] =
        await Promise.allSettled([
        getAttendanceSummary(eeSerialID),
        fetchLeaveBalances(eeSerialID, session.comSerialID),
        getEmployeeLoanPaged({
          PageNumber: 1,
          PageSize: 20,
          EESerialID: eeSerialID,
        }),
      ]);

      if (attendanceResult.status === 'fulfilled') {
        setAttendance(attendanceResult.value);
      } else {
        setAttendance(null);
        if (__DEV__) {
          console.warn('[Dashboard] Attendance summary failed:', attendanceResult.reason);
        }
      }

      if (leaveResult.status === 'fulfilled') {
        const annual = leaveResult.value.annual?.remaining ?? 0;
        const casual = leaveResult.value.casual?.remaining ?? 0;
        const hasLeave =
          leaveResult.value.annual !== null || leaveResult.value.casual !== null;
        setLeaveRemaining(hasLeave ? annual + casual : null);
      } else {
        setLeaveRemaining(null);
      }

      if (salaryAdvanceResult.status === 'fulfilled') {
        const activeAdvances = salaryAdvanceResult.value.items.filter(
          (item) => item.active,
        );
        setSalaryAdvanceCount(activeAdvances.length);
      } else {
        setSalaryAdvanceCount(null);
      }

      if (attendanceResult.status === 'rejected') {
        setSummaryError(getApiErrorMessage(attendanceResult.reason));
      }
    } catch (error) {
      setSummaryError(getApiErrorMessage(error));
    } finally {
      setSummaryLoading(false);
    }
  }, [session.comSerialID, session.eESerialID]);

  useEffect(() => {
    if (activeScreen === 'main') {
      loadDashboardSummary();
    }
  }, [activeScreen, loadDashboardSummary]);

  const widgets = useMemo<Widget[]>(
    () => [
      {
        key: 'leave',
        title: 'Leave Management',
        subtitle: 'Balance remaining',
        value:
          leaveRemaining !== null ? `${formatCount(leaveRemaining)} days` : '—',
        emoji: '🏖️',
        tint: '#E0E7FF',
        accent: colors.primary,
      },
      {
        key: 'attendance',
        title: 'Attendance',
        subtitle: `This month · ${monthLabel}`,
        value:
          attendance?.attendanceCount !== null &&
          attendance?.attendanceCount !== undefined
            ? `${formatCount(attendance.attendanceCount)} days`
            : '—',
        emoji: '🕒',
        tint: '#DCFCE7',
        accent: colors.success,
      },
      {
        key: 'salary',
        title: 'Salary',
        subtitle: 'Next payout',
        value: 'Jul 30',
        emoji: '💰',
        tint: '#FEF3C7',
        accent: colors.warning,
      },
      {
        key: 'salary-advance',
        title: 'Salary Advance',
        subtitle: 'Active requests',
        value:
          salaryAdvanceCount !== null
            ? `${formatCount(salaryAdvanceCount)} active`
            : 'Open',
        emoji: '💳',
        tint: '#FEE2E2',
        accent: colors.danger,
      },
    ],
    [attendance?.attendanceCount, leaveRemaining, monthLabel, salaryAdvanceCount],
  );

  if (activeScreen === 'leave') {
    return (
      <LeaveHomeScreen
        session={session}
        onBack={() => setActiveScreen('main')}
      />
    );
  }

  if (activeScreen === 'salary-advance') {
    return (
      <SalaryAdvanceHomeScreen
        session={session}
        onBack={() => setActiveScreen('main')}
      />
    );
  }

  if (activeScreen === 'payslip') {
    return (
      <PayslipScreen
        session={session}
        onBack={() => setActiveScreen('main')}
      />
    );
  }

  if (activeScreen === 'attendance') {
    return (
      <ViewAttendanceScreen
        session={session}
        onBack={() => setActiveScreen('main')}
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
            <View style={styles.brandRow}>
              <View style={styles.logoBadge}>
                <Image
                  source={require('../../../assets/psk-logo.png')}
                  style={styles.brandLogo}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.brandName}>{session.companyCode}</Text>
            </View>
            <Pressable style={styles.logoutBtn} onPress={onLogout} hitSlop={8}>
              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
          </View>

          <View style={styles.greetingBlock}>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.name}>{name} 👋</Text>
            <Text style={styles.date}>{today}</Text>
            <Text style={styles.company}>{session.companyName}</Text>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          <View style={styles.summaryCard}>
            {summaryLoading ? (
              <View style={styles.summaryLoading}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {formatCount(attendance?.attendanceCount ?? null)}
                  </Text>
                  <Text style={styles.summaryLabel}>Attendance</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {formatCount(attendance?.lateMinutes ?? null)}
                  </Text>
                  <Text style={styles.summaryLabel}>Late (min)</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {formatCount(attendance?.overtimeCount ?? null)}
                  </Text>
                  <Text style={styles.summaryLabel}>Overtime</Text>
                </View>
              </>
            )}
          </View>

          {!summaryLoading && summaryError ? (
            <Pressable onPress={loadDashboardSummary} style={styles.summaryError}>
              <Text style={styles.summaryErrorText}>{summaryError}</Text>
              <Text style={styles.summaryRetry}>Tap to retry</Text>
            </Pressable>
          ) : null}

          <Text style={styles.sectionTitle}>Services</Text>
          <View style={styles.grid}>
            {widgets.map((w) => (
              <Pressable
                key={w.key}
                style={styles.widgetCard}
                onPress={
                  w.key === 'leave'
                    ? () => setActiveScreen('leave')
                    : w.key === 'salary-advance'
                      ? () => setActiveScreen('salary-advance')
                      : w.key === 'salary'
                        ? () => setActiveScreen('payslip')
                        : w.key === 'attendance'
                          ? () => setActiveScreen('attendance')
                          : undefined
                }
              >
                <View style={[styles.widgetIcon, { backgroundColor: w.tint }]}>
                  <Text style={styles.widgetEmoji}>{w.emoji}</Text>
                </View>
                <Text style={styles.widgetTitle}>{w.title}</Text>
                <Text style={styles.widgetSubtitle}>{w.subtitle}</Text>
                <Text style={[styles.widgetValue, { color: w.accent }]}>
                  {w.value}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Quick links</Text>
          <View style={styles.linksCard}>
            <Row
              emoji="✅"
              label="View Attendance"
              onPress={() => setActiveScreen('attendance')}
            />
            <Divider />
            <Row
              emoji="📝"
              label="Apply for Leave"
              onPress={() => setActiveScreen('leave')}
            />
            <Divider />
            <Row
              emoji="📄"
              label="View Payslip"
              onPress={() => setActiveScreen('payslip')}
            />
            <Divider />
            <Row
              emoji="💳"
              label="Request Salary Advance"
              onPress={() => setActiveScreen('salary-advance')}
              last
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function Row({
  emoji,
  label,
  onPress,
  last = false,
}: {
  emoji: string;
  label: string;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={styles.rowEmoji}>{emoji}</Text>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowChevron}>›</Text>
    </Pressable>
  );
}

function Divider() {
  return <View style={styles.rowDivider} />;
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
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
    ...shadow.soft,
  },
  brandLogo: {
    width: '100%',
    height: '100%',
  },
  brandName: {
    ...typography.h3,
    color: colors.textOnPrimary,
    marginLeft: spacing.md,
    letterSpacing: 1,
  },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  logoutText: {
    ...typography.label,
    color: colors.textOnPrimary,
  },
  greetingBlock: {
    marginTop: spacing.xl,
  },
  greeting: {
    ...typography.body,
    color: 'rgba(255,255,255,0.85)',
  },
  name: {
    ...typography.h1,
    color: colors.textOnPrimary,
    textTransform: 'capitalize',
  },
  date: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.8)',
    marginTop: spacing.xs,
  },
  company: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.9)',
    marginTop: spacing.xs,
    fontWeight: '600',
  },
  body: {
    padding: spacing.xl,
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginTop: -spacing.xxxl,
    marginBottom: spacing.md,
    alignItems: 'center',
    minHeight: 96,
    ...shadow.card,
  },
  summaryLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border,
  },
  summaryValue: {
    ...typography.h2,
    color: colors.primary,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
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
  widgetValue: {
    ...typography.h3,
    marginTop: spacing.sm,
  },
  linksCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    ...shadow.soft,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  rowEmoji: {
    fontSize: 20,
    marginRight: spacing.lg,
  },
  rowLabel: {
    ...typography.title,
    color: colors.text,
    flex: 1,
  },
  rowChevron: {
    fontSize: 26,
    color: colors.textMuted,
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
});
