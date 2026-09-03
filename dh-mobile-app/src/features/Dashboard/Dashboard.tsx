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
import {
  getEmployeePayrollPeriods,
  getPayrollPeriods,
} from '../../api/endpoints/payrollPeriod';
import { getApiErrorMessage } from '../../api/client/client';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import { radius, spacing, typography, type ColorPalette, type ShadowTokens } from '../../styles/theme';
import { useTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { AuthSession } from '../../types/api';
import type { AttendanceSummary } from '../../types/attendance';
import type { EmployeeLoanListItem } from '../../types/employeeLoan';
import type { PayrollPeriodItem } from '../../types/payslip';
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

function toDayStart(value?: string | null): number | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function mergePayrollPeriods(
  ...lists: PayrollPeriodItem[][]
): PayrollPeriodItem[] {
  const merged = new Map<string, PayrollPeriodItem>();

  lists.flat().forEach((period) => {
    merged.set(period.payPeriod, period);
  });

  return Array.from(merged.values()).sort((a, b) => {
    const aTime = toDayStart(a.payrollStart) ?? 0;
    const bTime = toDayStart(b.payrollStart) ?? 0;
    if (aTime !== bTime) {
      return bTime - aTime;
    }

    return b.payPeriod.localeCompare(a.payPeriod);
  });
}

function getCurrentPayrollPeriod(
  periods: PayrollPeriodItem[],
  now = new Date(),
): PayrollPeriodItem | null {
  if (periods.length === 0) {
    return null;
  }

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();

  const containing = periods.find((period) => {
    const start = toDayStart(period.payrollStart);
    const end = toDayStart(period.payrollEnd);
    if (start == null || end == null) {
      return false;
    }

    return todayTime >= start && todayTime <= end;
  });

  return containing ?? periods[0] ?? null;
}

function isStartDateInPayrollPeriod(
  startDate: string | null | undefined,
  period: PayrollPeriodItem,
): boolean {
  const startTime = toDayStart(startDate);
  if (startTime == null) {
    return false;
  }

  const periodStart = toDayStart(period.payrollStart);
  const periodEnd = toDayStart(period.payrollEnd);

  if (periodStart != null && periodEnd != null) {
    return startTime >= periodStart && startTime <= periodEnd;
  }

  // Fallback when API only returns payPeriod label (e.g. "2026-08").
  const label = period.payPeriod.trim();
  const yearMonthMatch = label.match(/(\d{4})[-/](\d{1,2})/);
  if (yearMonthMatch) {
    const year = Number(yearMonthMatch[1]);
    const month = Number(yearMonthMatch[2]);
    const date = new Date(startTime);
    return date.getFullYear() === year && date.getMonth() + 1 === month;
  }

  return false;
}

function countActiveAdvancesInPeriod(
  items: EmployeeLoanListItem[],
  period: PayrollPeriodItem | null,
): number {
  const activeItems = items.filter((item) => item.active);

  if (!period) {
    return activeItems.length;
  }

  return activeItems.filter((item) =>
    isStartDateInPayrollPeriod(item.startDate, period),
  ).length;
}

export function Dashboard({ session, onLogout }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [activeScreen, setActiveScreen] = useState<
    'main' | 'leave' | 'salary-advance' | 'payslip' | 'attendance'
  >('main');
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
  const [leaveRemaining, setLeaveRemaining] = useState<number | null>(null);
  const [salaryAdvanceCount, setSalaryAdvanceCount] = useState<number | null>(null);
  const [salaryAdvancePeriod, setSalaryAdvancePeriod] = useState<string | null>(null);
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
      const [
        attendanceResult,
        leaveResult,
        salaryAdvanceResult,
        companyPeriodsResult,
        employeePeriodsResult,
      ] = await Promise.allSettled([
        getAttendanceSummary(eeSerialID),
        fetchLeaveBalances(eeSerialID, session.comSerialID),
        getEmployeeLoanPaged({
          PageNumber: 1,
          PageSize: 50,
          EESerialID: eeSerialID,
          SortColumn: 'startDate',
          SortDirection: 'desc',
        }),
        getPayrollPeriods(session.comSerialID),
        getEmployeePayrollPeriods(eeSerialID),
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

      const companyPeriods =
        companyPeriodsResult.status === 'fulfilled'
          ? companyPeriodsResult.value
          : [];
      const employeePeriods =
        employeePeriodsResult.status === 'fulfilled'
          ? employeePeriodsResult.value
          : [];
      const currentPeriod = getCurrentPayrollPeriod(
        mergePayrollPeriods(companyPeriods, employeePeriods),
      );
      setSalaryAdvancePeriod(currentPeriod?.payPeriod ?? null);

      if (salaryAdvanceResult.status === 'fulfilled') {
        setSalaryAdvanceCount(
          countActiveAdvancesInPeriod(
            salaryAdvanceResult.value.items,
            currentPeriod,
          ),
        );
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
        tint: colors.tintPrimary,
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
        tint: colors.tintSuccess,
        accent: colors.success,
      },
      {
        key: 'salary',
        title: 'Salary',
        subtitle: '',
        value: '',
        emoji: '💰',
        tint: colors.tintWarning,
        accent: colors.warning,
      },
      {
        key: 'salary-advance',
        title: 'Salary Advance',
        subtitle: salaryAdvancePeriod
          ? `Current period · ${salaryAdvancePeriod}`
          : 'Current payroll period',
        value:
          salaryAdvanceCount !== null
            ? `${formatCount(salaryAdvanceCount)} active`
            : '—',
        emoji: '💳',
        tint: colors.tintDanger,
        accent: colors.danger,
      },
    ],
    [
      attendance?.attendanceCount,
      colors,
      leaveRemaining,
      monthLabel,
      salaryAdvanceCount,
      salaryAdvancePeriod,
    ],
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
            <View style={styles.headerActions}>
              <ThemeToggle />
              <Pressable style={styles.logoutBtn} onPress={onLogout} hitSlop={8}>
                <Text style={styles.logoutText}>Logout</Text>
              </Pressable>
            </View>
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
              styles={styles}
              emoji="✅"
              label="View Attendance"
              onPress={() => setActiveScreen('attendance')}
            />
            <Divider styles={styles} />
            <Row
              styles={styles}
              emoji="📝"
              label="Apply for Leave"
              onPress={() => setActiveScreen('leave')}
            />
            <Divider styles={styles} />
            <Row
              styles={styles}
              emoji="📄"
              label="View Payslip"
              onPress={() => setActiveScreen('payslip')}
            />
            <Divider styles={styles} />
            <Row
              styles={styles}
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
  styles,
  emoji,
  label,
  onPress,
}: {
  styles: ReturnType<typeof createStyles>;
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

function Divider({ styles }: { styles: ReturnType<typeof createStyles> }) {
  return <View style={styles.rowDivider} />;
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
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
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
}
