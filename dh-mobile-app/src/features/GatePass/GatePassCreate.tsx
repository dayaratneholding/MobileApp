import React, { useState, useEffect } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  radius,
  spacing,
  typography,
  type ColorPalette,
  type ShadowTokens,
} from '../../styles/theme';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { AuthSession } from '../../types/api';
import { getEmployeeByEeSerialId } from '../../api/endpoints/employee';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
export type GatePassType = 'EXIT' | 'ENTRY';

export type GatePassCreatePayload = {
  passType: GatePassType;
  purpose: string;
  destination: string;
  vehicleOrItem: string;
  remarks: string;
};

type Props = {
  session?: AuthSession;
  onBack?: () => void;
  onSubmit?: (payload: GatePassCreatePayload) => Promise<void> | void;
};

export function GatePassCreate({ session, onBack, onSubmit }: Props) {
  const styles = useThemedStyles(createStyles);

  // Session & Employee IDs
  const [eeSerialID, setEESerialID] = useState(session?.eESerialID ?? '');
  const [comSerialID, setComSerialID] = useState(session?.comSerialID ?? '');
  const [eeid, setEeid] = useState('');

  // Form states matching your inputs and GatePassCreatePayload
  const [passType, setPassType] = useState<GatePassType>('EXIT');
  const [purpose, setPurpose] = useState('');
  const [destination, setDestination] = useState('');
  const [vehicleOrItem, setVehicleOrItem] = useState('');
  const [remarks, setRemarks] = useState('');

  // Optional extra fields you declared (kept if you plan to use them later)
  const [departureTime, setDepartureTime] = useState('');
  const [returnTime, setReturnTime] = useState('');
  const [date, setDate] = useState('');
  const [planDepartureDate, setPlanDepartureDate] = useState('');
  const [planDepartureTime, setPlanDepartureTime] = useState('');
  const [returnstatus, setReturnstatus] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [departureDateObj, setDepartureDateObj] = useState<Date>(new Date());
function formatDateYMD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function handleDateChange(event: DateTimePickerEvent, selectedDate?: Date) {
  // On Android, dismiss the picker on both 'set' and 'dismissed'
  if (Platform.OS === 'android') {
    setShowDatePicker(false);
  }

  if (event.type === 'set' && selectedDate) {
    setDepartureDateObj(selectedDate);
    setPlanDepartureDate(formatDateYMD(selectedDate));
  }
}

  // Fetch EEID once when session loads or changes
  useEffect(() => {
    const currentEeSerialId = session?.eESerialID ?? eeSerialID;
    const currentComSerialId = session?.comSerialID ?? comSerialID;

    if (session?.eESerialID) setEESerialID(session.eESerialID);
    if (session?.comSerialID) setComSerialID(session.comSerialID);

    if (!currentEeSerialId) return;

    let isMounted = true;

    async function fetchEmployeeId() {
      const numericSerialId = Number(currentEeSerialId);

      if (!currentEeSerialId || Number.isNaN(numericSerialId)) {
        return;
      }

      try {
        const employee = await getEmployeeByEeSerialId(numericSerialId);
        if (isMounted && employee?.eeid != null) {
          setEeid(String(employee.eeid));
        }
      } catch (err) {
        if (__DEV__) {
          console.warn('[GatePass] Could not resolve EEID:', err);
        }
      }
}

    fetchEmployeeId();

    return () => {
      isMounted = false;
    };
  }, [session?.eESerialID, session?.comSerialID]);

  async function handleSubmit() {
    if (!String(eeSerialID).trim() || !String(comSerialID).trim()) {
      setError('Restart the Mobile App');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await onSubmit?.({
        passType,
        purpose: purpose.trim(),
        destination: destination.trim(),
        vehicleOrItem: vehicleOrItem.trim(),
        remarks: remarks.trim(),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        {onBack && (
          <Pressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
        )}
        <Text style={styles.title}>Create GatePass</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Employee ID</Text>
            <TextInput
              value={eeid}
              placeholder="Loading..."
              placeholderTextColor={styles.placeholder.color}
              style={styles.input}
              editable={false}
              selectTextOnFocus={false}
            />
          </View>

          <View style={styles.fieldGroup}>
  <Text style={styles.label}>Plan Departure Date</Text>
  <Pressable onPress={() => setShowDatePicker(true)}>
    <TextInput
      value={planDepartureDate}
      placeholder="Select departure date (YYYY-MM-DD)"
      placeholderTextColor={styles.placeholder.color}
      style={styles.input}
      editable={false}
      pointerEvents="none"
    />
  </Pressable>

  {showDatePicker && (
    <DateTimePicker
      value={departureDateObj}
      mode="date"
      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
      onChange={handleDateChange}
    />
  )}
</View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Destination / Location *</Text>
            <TextInput
              value={destination}
              onChangeText={setDestination}
              placeholder="e.g. Head Office, Supplier site, Client location"
              placeholderTextColor={styles.placeholder.color}
              style={styles.input}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Vehicle / Item Details</Text>
            <TextInput
              value={vehicleOrItem}
              onChangeText={setVehicleOrItem}
              placeholder="Optional vehicle number or carried items"
              placeholderTextColor={styles.placeholder.color}
              style={styles.input}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Remarks</Text>
            <TextInput
              value={remarks}
              onChangeText={setRemarks}
              placeholder="Additional notes for confirmation / approval"
              placeholderTextColor={styles.placeholder.color}
              style={[styles.input, styles.textArea]}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={({ pressed }) => [
              styles.submitBtn,
              submitting && styles.submitBtnDisabled,
              pressed && !submitting && styles.submitBtnPressed,
            ]}
          >
            <Text style={styles.submitText}>
              {submitting ? 'Submitting...' : 'Submit GatePass'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
      paddingBottom: spacing.lg,
      paddingHorizontal: spacing.xl,
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
    },
    backBtn: {
      marginRight: spacing.md,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
    },
    backText: {
      ...typography.title,
      color: colors.textOnPrimary,
    },
    title: {
      ...typography.h2,
      color: colors.textOnPrimary,
    },
    scrollContent: {
      padding: spacing.xl,
      paddingBottom: spacing.xxxl,
    },
    card: {
      backgroundColor: colors.surface ?? colors.gradientStart,
      borderRadius: radius.xl ?? radius.lg,
      padding: spacing.xl,
      borderWidth: 1,
      borderColor: colors.border ?? 'rgba(0,0,0,0.06)',
      ...shadow.soft,
    },
    sectionLabel: {
      ...typography.label,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: spacing.sm,
    },
    segmentedRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    segmentBtn: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border ?? 'rgba(0,0,0,0.12)',
      backgroundColor: colors.background,
      alignItems: 'center',
    },
    segmentBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    segmentText: {
      ...typography.body,
      fontWeight: '600',
      color: colors.text,
    },
    segmentTextActive: {
      color: colors.textOnPrimary,
    },
    fieldGroup: {
      marginBottom: spacing.lg,
    },
    label: {
      ...typography.label,
      color: colors.text,
      marginBottom: spacing.xs,
    },
    input: {
      ...typography.body,
      color: colors.text,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border ?? 'rgba(0,0,0,0.12)',
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    textArea: {
      minHeight: 88,
    },
    placeholder: {
      color: colors.textSecondary,
    },
    errorText: {
      ...typography.body,
      color: '#DC2626',
      marginBottom: spacing.md,
    },
    submitBtn: {
      backgroundColor: colors.primary,
      borderRadius: radius.lg,
      paddingVertical: spacing.lg,
      alignItems: 'center',
      marginTop: spacing.xs,
    },
    submitBtnPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.99 }],
    },
    submitBtnDisabled: {
      opacity: 0.6,
    },
    submitText: {
      ...typography.h3,
      color: colors.textOnPrimary,
    },
  });
}