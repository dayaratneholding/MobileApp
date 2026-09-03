import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import {
  createEmployeeLoan,
  updateEmployeeLoan,
} from '../../api/endpoints/employeeLoan';
import { getApiErrorMessage } from '../../api/client/client';
import { Button } from '../../components/ui/Button';
import { KeyboardForm } from '../../components/layout/KeyboardForm';
import { TextField } from '../../components/ui/TextField';
import { radius, spacing, typography, type ColorPalette, type ShadowTokens } from '../../styles/theme';
import { useTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { AuthSession } from '../../types/api';
import type {
  EmployeeLoanListItem,
  GetEmployeeLoanDto,
} from '../../types/employeeLoan';
import {
  buildEmployeeLoanFromListItem,
  EmployeeLoanType,
} from '../../types/employeeLoan';
import {
  toApiDateOnlyObject,
  toDateInputValue,
  todayDateString,
} from '../../utils/leaveDates';

type Props = {
  session: AuthSession;
  editEntry?: EmployeeLoanListItem | null;
  onBack: () => void;
  onSuccess?: () => void;
};

function parseAmount(value: string): number | null {
  const trimmed = value.trim().replace(/,/g, '');
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

export function SalaryAdvanceEntryForm({
  session,
  editEntry,
  onBack,
  onSuccess,
}: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const isEditMode = editEntry != null;

  const [loanAmount, setLoanAmount] = useState(() =>
    editEntry?.loanAmount != null ? String(editEntry.loanAmount) : '',
  );
  const [installmentAmount, setInstallmentAmount] = useState(() =>
    editEntry?.installmentAmount != null ? String(editEntry.installmentAmount) : '',
  );
  const [installments, setInstallments] = useState(() =>
    editEntry?.installments != null ? String(editEntry.installments) : '',
  );
  const [startDate, setStartDate] = useState(() =>
    editEntry?.startDate ? toDateInputValue(editEntry.startDate) : todayDateString(),
  );
  const [loanDescription, setLoanDescription] = useState(
    () => editEntry?.loanDescription ?? 'Salary Advance',
  );
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [existingEntry, setExistingEntry] = useState<GetEmployeeLoanDto | null>(
    () =>
      editEntry
        ? buildEmployeeLoanFromListItem(editEntry)
        : null,
  );

  useEffect(() => {
    if (!isEditMode || editEntry == null) {
      return;
    }

    const entry = buildEmployeeLoanFromListItem(editEntry);
    setExistingEntry(entry);
    setLoanAmount(entry.loanAmount != null ? String(entry.loanAmount) : '');
    setInstallmentAmount(
      entry.installmentAmount != null ? String(entry.installmentAmount) : '',
    );
    setInstallments(entry.installments != null ? String(entry.installments) : '');
    setStartDate(toDateInputValue(
      typeof entry.startDate === 'string' ? entry.startDate : null,
    ));
    setLoanDescription(entry.loanDescription ?? 'Salary Advance');
    setNotes(entry.notes ?? '');
  }, [editEntry]);

  const handleSubmit = async () => {
    if (!session.eESerialID) {
      setError('Employee ID not found in session. Please login again.');
      return;
    }

    const amount = parseAmount(loanAmount);
    if (amount === null || amount <= 0) {
      setError('Please enter a valid advance amount.');
      return;
    }

    if (!startDate.trim()) {
      setError('Please enter the start date.');
      return;
    }

    const installmentsValue =
      parseOptionalInt(installments) ?? 1;
    const installmentAmountValue =
      parseAmount(installmentAmount) ??
      (installmentsValue === 1 ? amount : null);

    if (installmentAmountValue === null || installmentAmountValue <= 0) {
      setError('Please enter a valid installment amount.');
      return;
    }

    if (installmentsValue <= 0) {
      setError('Please enter a valid number of installments.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const payload = {
        eeSerialID: session.eESerialID,
        comSerialID: session.comSerialID,
        loanType: EmployeeLoanType.SalaryAdvance,
        loanDescription: loanDescription.trim() || 'Salary Advance',
        loanAmount: amount,
        installmentAmount: installmentAmountValue,
        installments: installmentsValue,
        startDate: toApiDateOnlyObject(startDate),
        notes: notes.trim() || null,
      };

      if (isEditMode && existingEntry) {
        await updateEmployeeLoan({
          ...payload,
          employeeLoanSerialID: existingEntry.employeeLoanSerialID,
        });
        Alert.alert('Success', 'Salary advance updated successfully.');
      } else {
        await createEmployeeLoan(payload);
        Alert.alert('Success', 'Salary advance request submitted successfully.');
      }

      onSuccess?.();
      onBack();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
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
            <Text style={styles.headerTitle}>
              {isEditMode ? 'Edit Salary Advance' : 'Request Salary Advance'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {isEditMode
                ? 'Update your salary advance request'
                : 'Submit a new salary advance request'}
            </Text>
          </LinearGradient>

          <View style={styles.body}>
            <View style={styles.card}>
              <TextField
                label="Advance Amount"
                placeholder="e.g. 50000"
                value={loanAmount}
                onChangeText={setLoanAmount}
                keyboardType="decimal-pad"
              />

              <TextField
                label="Installment Amount"
                placeholder="Defaults to full amount"
                value={installmentAmount}
                onChangeText={setInstallmentAmount}
                keyboardType="decimal-pad"
              />

              <TextField
                label="Number of Installments"
                placeholder="Default: 1"
                value={installments}
                onChangeText={setInstallments}
                keyboardType="number-pad"
              />

              <TextField
                label="Start Date"
                placeholder="YYYY-MM-DD"
                value={startDate}
                onChangeText={setStartDate}
              />

              <TextField
                label="Description"
                placeholder="Salary Advance"
                value={loanDescription}
                onChangeText={setLoanDescription}
              />

              <TextField
                label="Notes"
                placeholder="Optional notes"
                value={notes}
                onChangeText={setNotes}
                multiline
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <Button
                label={isEditMode ? 'Save Changes' : 'Submit Request'}
                onPress={handleSubmit}
                loading={loading}
              />
            </View>
          </View>
      </KeyboardForm>
    </View>
  );
}

function createStyles(colors: ColorPalette, shadow: ShadowTokens) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
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
  },
  body: {
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginTop: -spacing.xxxl,
    ...shadow.card,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  });
}
