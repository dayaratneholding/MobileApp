import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import {
  getEmployeeByEeid,
  getEmployeeByEeSerialId,
} from '../../api/endpoints/employee';
import { getEmployeePayrollPeriods, getPayrollPeriods } from '../../api/endpoints/payrollPeriod';
import { getPayslip } from '../../api/endpoints/payslip';
import { getApiErrorMessage } from '../../api/client/client';
import { Button } from '../../components/ui/Button';
import { KeyboardForm } from '../../components/layout/KeyboardForm';
import { TextField } from '../../components/ui/TextField';
import { radius, spacing, typography, type ColorPalette, type ShadowTokens } from '../../styles/theme';
import { useTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { AuthSession } from '../../types/api';
import type {
  EmployeeDetails,
  PayrollPeriodItem,
  PayslipData,
} from '../../types/payslip';
import { formatMoney } from '../../types/payslip';
import { downloadPayslipPdf } from '../../utils/payslipPdf';

type Props = {
  session: AuthSession;
  onBack: () => void;
};

function PayslipLine({
  label,
  value,
  highlight = false,
  bold = false,
}: {
  label: string;
  value?: number | null;
  highlight?: boolean;
  bold?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  if (value == null || value === 0) {
    return null;
  }

  return (
    <View style={styles.lineRow}>
      <Text style={[styles.lineLabel, bold && styles.lineLabelBold]}>{label}</Text>
      <Text
        style={[
          styles.lineValue,
          highlight && styles.lineValueHighlight,
          bold && styles.lineValueBold,
        ]}
      >
        {formatMoney(value)}
      </Text>
    </View>
  );
}

function PayPeriodPicker({
  periods,
  selected,
  onSelect,
}: {
  periods: PayrollPeriodItem[];
  selected?: string;
  onSelect: (payPeriod: string) => void;
}) {
  const styles = useThemedStyles(createStyles);
  if (periods.length === 0) {
    return (
      <Text style={styles.emptyPeriodText}>
        No payroll periods found for this company and scheme.
      </Text>
    );
  }

  return (
    <View style={styles.periodList}>
      {periods.map((period) => {
        const isSelected = selected === period.payPeriod;

        return (
          <Pressable
            key={`${period.payPeriodSerialID ?? period.payPeriod}`}
            style={[styles.periodChip, isSelected && styles.periodChipSelected]}
            onPress={() => onSelect(period.payPeriod)}
          >
            <Text
              style={[
                styles.periodChipText,
                isSelected && styles.periodChipTextSelected,
              ]}
            >
              {period.payPeriod}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PayslipCard({
  payslip,
  onDownload,
  downloading,
}: {
  payslip: PayslipData;
  onDownload: () => void;
  downloading: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.payslipCard}>
      <View style={styles.payslipHeader}>
        <Text style={styles.companyName}>{payslip.companyName ?? '—'}</Text>
        <Text style={styles.payPeriodLabel}>{payslip.payPeriod ?? '—'}</Text>
      </View>

      <View style={styles.employeeBlock}>
        <Text style={styles.employeeName}>{payslip.nameWithInitials ?? '—'}</Text>
        <Text style={styles.employeeMeta}>
          EPF {payslip.empNo ?? '—'} · {payslip.desigName ?? '—'}
        </Text>
        <Text style={styles.employeeMeta}>{payslip.deptName ?? '—'}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{payslip.workdays ?? '—'}</Text>
          <Text style={styles.statLabel}>Work days</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{payslip.leaveCount ?? '—'}</Text>
          <Text style={styles.statLabel}>Leave</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{formatMoney(payslip.dayPay)}</Text>
          <Text style={styles.statLabel}>Day pay</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Earnings</Text>
      <PayslipLine label="Basic salary" value={payslip.basicSalary} />
      <PayslipLine label="Travelling & fuel" value={payslip.travellingAndFuel_Amount} />
      <PayslipLine label="Living allowance" value={payslip.living_Amount} />
      <PayslipLine label="Special allowance" value={payslip.special_Amount} />
      <PayslipLine label="Other emoluments" value={payslip.otherEmol_Amount} />
      <PayslipLine label="Overtime" value={payslip.totalOT} />
      <PayslipLine label="Attendance allowance" value={payslip.attendaceAllowance} />
      <PayslipLine label="Arrears" value={payslip.arrears} />
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Gross pay</Text>
        <Text style={styles.totalValue}>{formatMoney(payslip.grossPay)}</Text>
      </View>

      <Text style={styles.sectionTitle}>Deductions</Text>
      <PayslipLine label="No pay" value={payslip.noPayAmount} />
      <PayslipLine label="Late minutes" value={payslip.lateMinuteAmount} />
      <PayslipLine label="PAYE tax" value={payslip.payeTax} />
      <PayslipLine label="EPF 8%" value={payslip.epF8} />
      <PayslipLine label="Stamp fee" value={payslip.stampFee} />
      <PayslipLine label="Salary advance" value={payslip.salaryAdvance_Amount} />
      <PayslipLine label="Loan" value={payslip.loan_Amount} />
      <PayslipLine label="Mobile" value={payslip.mobile_Amount} />
      <PayslipLine label="Other deductions" value={payslip.otherDeduct_Amount} />

      <View style={styles.netCard}>
        <Text style={styles.netLabel}>Net salary</Text>
        <Text style={styles.netValue}>{formatMoney(payslip.netSalary)}</Text>
        <Text style={styles.bankText}>
          To bank: {formatMoney(payslip.salaryToBank)}
        </Text>
        <Text style={styles.bankText}>
          {payslip.bankName ?? '—'} · {payslip.bankAccNo ?? '—'}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Employer contributions</Text>
      <PayslipLine label="EPF 12%" value={payslip.epF12} />
      <PayslipLine label="ETF 3%" value={payslip.etF3} />
      <PayslipLine label="Total for EPF" value={payslip.totalForEPF} />

      <Button
        label={downloading ? 'Preparing PDF…' : 'Download Payslip (PDF)'}
        onPress={onDownload}
        loading={downloading}
      />
    </View>
  );
}

export function PayslipScreen({ session, onBack }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [employee, setEmployee] = useState<EmployeeDetails | null>(null);
  const [periods, setPeriods] = useState<PayrollPeriodItem[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [payslip, setPayslip] = useState<PayslipData | null>(null);
  const [eeidInput, setEeidInput] = useState('');
  const [setupLoading, setSetupLoading] = useState(true);
  const [payslipLoading, setPayslipLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [error, setError] = useState('');

  const loadPayrollPeriods = useCallback(
    async (details: EmployeeDetails) => {
      const [pagedPeriods, employeePeriods] = await Promise.all([
        getPayrollPeriods(details.comSerialID, details.scheme),
        getEmployeePayrollPeriods(details.eeSerialID),
      ]);

      const merged = new Map<string, PayrollPeriodItem>();
      [...pagedPeriods, ...employeePeriods].forEach((period) => {
        merged.set(period.payPeriod, period);
      });

      const sorted = Array.from(merged.values()).sort((a, b) =>
        b.payPeriod.localeCompare(a.payPeriod),
      );

      setPeriods(sorted);
      setSelectedPeriod((current) => current || sorted[0]?.payPeriod || '');
    },
    [],
  );

  const loadEmployeeSetup = useCallback(async () => {
    setSetupLoading(true);
    setError('');
    setPayslip(null);

    try {
      let details: EmployeeDetails;

      if (session.eESerialID) {
        details = await getEmployeeByEeSerialId(session.eESerialID);
      } else if (eeidInput.trim()) {
        details = await getEmployeeByEeid(
          Number(eeidInput.trim()),
          session.comSerialID,
        );
      } else {
        throw new Error('Employee ID not found in session.');
      }

      setEmployee(details);
      setEeidInput(String(details.eeid));
      await loadPayrollPeriods(details);
    } catch (err) {
      setError(getApiErrorMessage(err));
      setEmployee(null);
      setPeriods([]);
    } finally {
      setSetupLoading(false);
    }
  }, [loadPayrollPeriods, session.comSerialID, session.eESerialID]);

  useEffect(() => {
    loadEmployeeSetup();
  }, [loadEmployeeSetup]);

  const handleLookupByEeid = async () => {
    const eeid = Number(eeidInput.trim());
    if (!eeid || Number.isNaN(eeid)) {
      setError('Please enter a valid EEID.');
      return;
    }

    setSetupLoading(true);
    setError('');
    setPayslip(null);

    try {
      const details = await getEmployeeByEeid(eeid, session.comSerialID);
      setEmployee(details);
      await loadPayrollPeriods(details);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSetupLoading(false);
    }
  };

  const handleLoadPayslip = async () => {
    if (!employee) {
      setError('Employee details not loaded.');
      return;
    }

    if (!selectedPeriod) {
      setError('Please select a pay period.');
      return;
    }

    if (employee.scheme == null) {
      setError('Pay scheme not found for this employee.');
      return;
    }

    setPayslipLoading(true);
    setError('');

    try {
      const result = await getPayslip({
        scheme: employee.scheme,
        comSerialID: employee.comSerialID,
        payPeriod: selectedPeriod,
        eeid: employee.eeid,
        callName: employee.callName ?? session.userName ?? session.userID,
        reportType: 1,
        dataSet: 1,
      });
      setPayslip(result);
    } catch (err) {
      setPayslip(null);
      setError(getApiErrorMessage(err));
    } finally {
      setPayslipLoading(false);
    }
  };

  const handleDownloadPayslip = async () => {
    if (!payslip) {
      return;
    }

    setDownloadLoading(true);
    setError('');

    try {
      await downloadPayslipPdf(payslip);
    } catch (err) {
      const message = getApiErrorMessage(err);
      setError(message);
      Alert.alert('Download failed', message);
    } finally {
      setDownloadLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <KeyboardForm>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Pressable style={styles.backBtn} onPress={onBack} hitSlop={8}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Salary / Payslip</Text>
          <Text style={styles.headerSubtitle}>
            {employee?.nameWithInitials ?? session.userName} · {session.companyCode}
          </Text>
        </LinearGradient>

        <View style={styles.body}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Employee details</Text>

            {setupLoading ? (
              <ActivityIndicator color={colors.primary} style={styles.loader} />
            ) : employee ? (
              <>
                <View style={styles.detailGrid}>
                  <DetailItem label="EEID" value={String(employee.eeid)} />
                  <DetailItem
                    label="Scheme"
                    value={employee.scheme != null ? String(employee.scheme) : '—'}
                  />
                  <DetailItem
                    label="Company ID"
                    value={String(employee.comSerialID)}
                  />
                  <DetailItem
                    label="Employee"
                    value={employee.nameWithInitials ?? '—'}
                  />
                </View>
              </>
            ) : (
              <>
                <TextField
                  label="EEID"
                  placeholder="Enter employee EEID"
                  value={eeidInput}
                  onChangeText={setEeidInput}
                  keyboardType="number-pad"
                />
                <Button label="Load Employee" onPress={handleLookupByEeid} />
              </>
            )}
          </View>

          <View style={[styles.card, styles.periodCard]}>
            <Text style={styles.cardTitle}>Pay period</Text>
            <Text style={styles.cardHint}>
              Select a payroll period for this company and scheme.
            </Text>

            {setupLoading ? (
              <ActivityIndicator color={colors.primary} style={styles.loader} />
            ) : (
              <PayPeriodPicker
                periods={periods}
                selected={selectedPeriod}
                onSelect={setSelectedPeriod}
              />
            )}

            <Button
              label={payslipLoading ? 'Loading payslip…' : 'View Payslip'}
              onPress={handleLoadPayslip}
              loading={payslipLoading}
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {payslip ? (
            <PayslipCard
              payslip={payslip}
              onDownload={handleDownloadPayslip}
              downloading={downloadLoading}
            />
          ) : null}
        </View>
      </KeyboardForm>
    </View>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginTop: -spacing.xxxl,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  periodCard: {
    marginTop: 0,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  cardHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  loader: {
    marginVertical: spacing.md,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  detailItem: {
    width: '48%',
    marginBottom: spacing.md,
  },
  detailLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  detailValue: {
    ...typography.title,
    color: colors.text,
    marginTop: 2,
  },
  periodList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.lg,
  },
  periodChip: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  periodChipSelected: {
    backgroundColor: colors.tintSelected,
    borderColor: colors.primary,
  },
  periodChipText: {
    ...typography.caption,
    color: colors.text,
  },
  periodChipTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  emptyPeriodText: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  payslipCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.xxxl,
    ...shadow.card,
  },
  payslipHeader: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.md,
    marginBottom: spacing.md,
  },
  companyName: {
    ...typography.title,
    color: colors.text,
  },
  payPeriodLabel: {
    ...typography.h3,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  employeeBlock: {
    marginBottom: spacing.lg,
  },
  employeeName: {
    ...typography.h2,
    color: colors.text,
  },
  employeeMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginRight: spacing.sm,
  },
  statValue: {
    ...typography.title,
    color: colors.text,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  lineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  lineLabel: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
    paddingRight: spacing.md,
  },
  lineLabelBold: {
    color: colors.text,
    fontWeight: '600',
  },
  lineValue: {
    ...typography.caption,
    color: colors.text,
  },
  lineValueHighlight: {
    color: colors.primary,
  },
  lineValueBold: {
    fontWeight: '700',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  totalLabel: {
    ...typography.title,
    color: colors.text,
  },
  totalValue: {
    ...typography.title,
    color: colors.primary,
  },
  netCard: {
    backgroundColor: colors.tintWarning,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  netLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  netValue: {
    ...typography.h1,
    color: colors.text,
    marginTop: spacing.xs,
  },
  bankText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  });
}
