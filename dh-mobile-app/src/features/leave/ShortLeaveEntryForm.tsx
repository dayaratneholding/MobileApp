import React, { useEffect, useState } from 'react';
import {
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
  createShortLeave,
  updateShortLeave,
} from '../../api/endpoints/shortLeave';
import { getApiErrorMessage } from '../../api/client/client';
import { Button } from '../../components/ui/Button';
import { OptionPicker } from '../../components/forms/OptionPicker';
import { TextField } from '../../components/ui/TextField';
import { colors, radius, spacing, typography, shadow } from '../../styles/theme';
import type { AuthSession } from '../../types/api';
import type { GetShortLeaveEntryDto, MobileShortLeaveEntry } from '../../types/shortLeave';
import {
  buildShortLeaveEntryFromMobile,
  SLOT_OPTIONS,
  Slot,
} from '../../types/shortLeave';
import { toApiDateTime, toDateInputValue, todayDateString } from '../../utils/leaveDates';

type Props = {
  session: AuthSession;
  editEntry?: MobileShortLeaveEntry | null;
  onBack: () => void;
  onSuccess?: () => void;
};

export function ShortLeaveEntryForm({
  session,
  editEntry,
  onBack,
  onSuccess,
}: Props) {
  const isEditMode = editEntry != null;

  const [date, setDate] = useState(() =>
    editEntry?.date ? toDateInputValue(editEntry.date) : todayDateString(),
  );
  const [slot, setSlot] = useState<Slot>(() =>
    editEntry?.slot ? (editEntry.slot as Slot) : Slot.ShiftStart,
  );
  const [reason, setReason] = useState(() => editEntry?.reason ?? 'Personal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [existingEntry, setExistingEntry] = useState<GetShortLeaveEntryDto | null>(
    () =>
      editEntry
        ? buildShortLeaveEntryFromMobile(editEntry, session.comSerialID)
        : null,
  );

  useEffect(() => {
    if (!isEditMode || editEntry == null) {
      return;
    }

    const entry = buildShortLeaveEntryFromMobile(editEntry, session.comSerialID);
    setExistingEntry(entry);
    setDate(toDateInputValue(entry.date));
    setSlot(entry.slot);
    setReason(entry.reason);
  }, [editEntry, session.comSerialID]);

  const handleSubmit = async () => {
    if (!session.eESerialID) {
      setError('Employee ID not found in session. Please login again.');
      return;
    }

    if (!date.trim()) {
      setError('Please enter the short leave date.');
      return;
    }

    if (!reason.trim()) {
      setError('Please enter a reason.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      if (isEditMode && existingEntry) {
        await updateShortLeave({
          shortLeaveSerialID: existingEntry.shortLeaveSerialID,
          eeSerialID: existingEntry.eeSerialID,
          comSerialID: existingEntry.comSerialID,
          entryDate: existingEntry.entryDate,
          date: toApiDateTime(date),
          slot,
          reason: reason.trim(),
          leaveApprovedBy: existingEntry.leaveApprovedBy ?? 0,
          active: existingEntry.active ?? false,
        });
        Alert.alert('Success', 'Short leave updated successfully.');
      } else {
        await createShortLeave({
          eeSerialID: session.eESerialID,
          comSerialID: session.comSerialID,
          entryDate: new Date().toISOString(),
          date: toApiDateTime(date),
          slot,
          reason: reason.trim(),
          leaveApprovedBy: 0,
        });
        Alert.alert('Success', 'Short leave request submitted successfully.');
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
            <Text style={styles.headerTitle}>
              {isEditMode ? 'Edit Short Leave' : 'Add Short Leave'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {isEditMode
                ? 'Update your short leave request'
                : 'Submit a new short leave request'}
            </Text>
          </LinearGradient>

          <View style={styles.body}>
            <View style={styles.card}>
              <TextField
                label="Date"
                placeholder="YYYY-MM-DD"
                value={date}
                onChangeText={setDate}
              />

              <OptionPicker
                label="Slot"
                options={SLOT_OPTIONS}
                value={slot}
                onChange={setSlot}
              />

              <TextField
                label="Reason"
                placeholder="e.g. Personal"
                value={reason}
                onChangeText={setReason}
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <Button
                label={isEditMode ? 'Save Changes' : 'Submit Short Leave'}
                onPress={handleSubmit}
                loading={loading}
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
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
});
