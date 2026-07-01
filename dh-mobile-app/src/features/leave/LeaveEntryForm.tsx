import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import {
  createLeaveEntitlement,
  getCalendarLeaveCount,
} from '../../api/endpoints/leave';
import { getApiErrorMessage } from '../../api/client/client';
import { Button } from '../../components/ui/Button';
import { OptionPicker } from '../../components/forms/OptionPicker';
import { TextField } from '../../components/ui/TextField';
import { colors, radius, spacing, typography, shadow } from '../../styles/theme';
import type { AuthSession } from '../../types/api';
import {
  HalfDay,
  HALF_DAY_OPTIONS,
  LEAVE_TYPE_OPTIONS,
  LeaveStatus,
  LeaveType,
  REASON_OPTIONS,
  ReasonType,
} from '../../types/leave';

type Props = {
  session: AuthSession;
  onBack: () => void;
  onSuccess?: () => void;
};

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

function toIsoDateTime(dateValue: string): string {
  const date = new Date(`${dateValue}T00:00:00`);
  return date.toISOString();
}

export function LeaveEntryForm({ session, onBack, onSuccess }: Props) {
  const [leaveType, setLeaveType] = useState<LeaveType>(LeaveType.Annual);
  const [reason, setReason] = useState<ReasonType>(ReasonType.AnnualLeave);
  const [halfDayId, setHalfDayId] = useState<HalfDay>(HalfDay.None);
  const [dateFrom, setDateFrom] = useState(todayString());
  const [dateTo, setDateTo] = useState(todayString());
  const [cancelNotes, setCancelNotes] = useState('');
  const [leaveCount, setLeaveCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [countError, setCountError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isHalfDay = halfDayId !== HalfDay.None;

  useEffect(() => {
    if (!session.eESerialID || !dateFrom || !dateTo) {
      setLeaveCount(null);
      return;
    }

    if (!isValidDateString(dateFrom) || !isValidDateString(dateTo)) {
      setLeaveCount(null);
      setCountError('');
      return;
    }

    if (new Date(dateTo) < new Date(dateFrom)) {
      setLeaveCount(null);
      setCountError('To date cannot be before from date.');
      return;
    }

    let cancelled = false;

    const fetchLeaveCount = async () => {
      setCountLoading(true);
      setCountError('');

      try {
        const count = await getCalendarLeaveCount({
          fromDate: dateFrom,
          toDate: dateTo,
          eeSerialID: session.eESerialID!,
          isHalfDay,
        });

        if (!cancelled) {
          setLeaveCount(count);
        }
      } catch (err) {
        if (!cancelled) {
          setLeaveCount(null);
          const message = getApiErrorMessage(err);
          if (__DEV__) {
            console.error('[Leave] CalenderLeaveCount error:', err);
          }
          setCountError(message);
        }
      } finally {
        if (!cancelled) {
          setCountLoading(false);
        }
      }
    };

    fetchLeaveCount();

    return () => {
      cancelled = true;
    };
  }, [dateFrom, dateTo, isHalfDay, session.eESerialID]);

  const handleSubmit = async () => {
    if (!session.eESerialID) {
      setError('Employee ID not found in session. Please login again.');
      return;
    }

    if (!dateFrom || !dateTo) {
      setError('Please enter from and to dates.');
      return;
    }

    if (new Date(dateTo) < new Date(dateFrom)) {
      setError('To date cannot be before from date.');
      return;
    }

    if (leaveCount === null) {
      setError(countError || 'Leave count is not available yet. Please wait.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const payload = {
        eeSerialID: session.eESerialID,
        comSerialID: session.comSerialID,
        entryDate: new Date().toISOString(),
        leaveType,
        leaveCount,
        dateFrom: toIsoDateTime(dateFrom),
        dateTo: toIsoDateTime(dateTo),
        reason,
        leaveApprovedBy: 0,
        cancelNotes: cancelNotes.trim() || null,
        halfDayId,
        leaveStatus: LeaveStatus.Pending,
        cancelLeave: false,
      };

      if (__DEV__) {
        console.log('[Leave] Create payload:', payload);
      }

      await createLeaveEntitlement(payload);

      Alert.alert('Success', 'Leave request submitted successfully.');
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

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <Pressable style={styles.backBtn} onPress={onBack} hitSlop={8}>
              <Text style={styles.backText}>← Back</Text>
            </Pressable>
            <Text style={styles.headerTitle}>Add Leave</Text>
            <Text style={styles.headerSubtitle}>
              Submit a new leave request
            </Text>
          </LinearGradient>

          <View style={styles.body}>
            <View style={styles.card}>
              <OptionPicker
                label="Leave Type"
                options={LEAVE_TYPE_OPTIONS}
                value={leaveType}
                onChange={setLeaveType}
              />

              <OptionPicker
                label="Reason"
                options={REASON_OPTIONS}
                value={reason}
                onChange={setReason}
              />

              <TextField
                label="Date From"
                placeholder="YYYY-MM-DD"
                value={dateFrom}
                onChangeText={setDateFrom}
              />

              <TextField
                label="Date To"
                placeholder="YYYY-MM-DD"
                value={dateTo}
                onChangeText={setDateTo}
              />

              <OptionPicker
                label="Half Day"
                options={HALF_DAY_OPTIONS}
                value={halfDayId}
                onChange={setHalfDayId}
              />

              <View style={styles.countBox}>
                <Text style={styles.countLabel}>Leave Count</Text>
                {countLoading ? (
                  <ActivityIndicator color={colors.primary} />
                ) : leaveCount !== null ? (
                  <Text style={styles.countValue}>
                    {leaveCount.toFixed(1)} days
                  </Text>
                ) : (
                  <Text style={styles.countPlaceholder}>—</Text>
                )}
              </View>

              {countError ? (
                <Text style={styles.countErrorText}>{countError}</Text>
              ) : null}

              <TextField
                label="Notes (optional)"
                placeholder="Add any notes"
                value={cancelNotes}
                onChangeText={setCancelNotes}
                multiline
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <Button
                label="Submit Leave"
                onPress={handleSubmit}
                loading={loading}
                disabled={countLoading || leaveCount === null}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
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
  countBox: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countLabel: {
    ...typography.title,
    color: colors.text,
  },
  countValue: {
    ...typography.h3,
    color: colors.primary,
  },
  countPlaceholder: {
    ...typography.h3,
    color: colors.textMuted,
  },
  countErrorText: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.lg,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
});
