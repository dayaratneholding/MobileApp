import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { getApiErrorMessage } from '../../api/client/client';
import { getEmployeeByEeSerialId, listCompanyEmployees } from '../../api/endpoints/employee';
import {
  createGatePass,
  dateOnly,
  listCompanyVehicles,
  timeSpan,
  type CompanyVehicle,
} from '../../api/endpoints/gatePass';
import type { EmployeeDetails } from '../../types/payslip';
import {
  radius,
  spacing,
  typography,
  type ColorPalette,
  type ShadowTokens,
} from '../../styles/theme';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { AuthSession } from '../../types/api';

export const ReturnStatus = {
  Returned: 1,
  DutyoffNoReturn: 2,
} as const;

export type ReturnStatusValue = (typeof ReturnStatus)[keyof typeof ReturnStatus];

export const RETURN_STATUS_OPTIONS: { label: string; value: ReturnStatusValue }[] = [
  { label: 'Returned', value: ReturnStatus.Returned },
  { label: 'Duty Off (No Return)', value: ReturnStatus.DutyoffNoReturn },
];

export const EGatePassStatus = {
  Pending: 1,
  Approved: 2,
  Confirmed: 3,
  Departed: 4,
  Returned: 5,
  DutyOff: 6,
  Rejected: 7,
} as const;

type ExtraEmployee = {
  eeSerialID: number;
  eeid: number;
  fullName: string;
};

type Props = {
  session?: AuthSession;
  onBack?: () => void;
  onSubmit?: () => Promise<void> | void;
};

function formatTime24(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatDateYMD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function GatePassCreate({ session, onBack, onSubmit }: Props) {
  const styles = useThemedStyles(createStyles);
  const eeSerialID = session?.eESerialID ?? 0;
  const comSerialID = session?.comSerialID ?? 0;

  const [mainName, setMainName] = useState(session?.userName || 'You');
  const [eeid, setEeid] = useState('');
  const [planDate, setPlanDate] = useState<Date>(new Date());
  const [planDateText, setPlanDateText] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [departureTime, setDepartureTime] = useState<Date>(new Date());
  const [departureText, setDepartureText] = useState('');
  const [showDeparturePicker, setShowDeparturePicker] = useState(false);
  const [planTime, setPlanTime] = useState<Date>(new Date());
  const [planTimeText, setPlanTimeText] = useState('');
  const [showPlanPicker, setShowPlanPicker] = useState(false);
  const [returnTime, setReturnTime] = useState<Date>(new Date());
  const [returnText, setReturnText] = useState('');
  const [showReturnPicker, setShowReturnPicker] = useState(false);
  const [returnstatus, setReturnstatus] = useState<ReturnStatusValue | ''>('');
  const [vehicles, setVehicles] = useState<CompanyVehicle[]>([]);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [reason, setReason] = useState('');
  const [remark, setRemark] = useState('');
  const [employees, setEmployees] = useState<EmployeeDetails[]>([]);
  const [peopleQuery, setPeopleQuery] = useState('');
  const [extras, setExtras] = useState<ExtraEmployee[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!eeSerialID) return;
    let active = true;
    getEmployeeByEeSerialId(eeSerialID)
      .then((employee) => {
        if (!active) return;
        setEeid(String(employee.eeid));
        setMainName(employee.fullName || employee.callName || employee.nameWithInitials || session?.userName || 'You');
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [eeSerialID, session?.userName]);

  useEffect(() => {
    let active = true;
    setLoadingVehicles(true);
    listCompanyVehicles()
      .then((list) => {
        if (active) setVehicles(list);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoadingVehicles(false);
      });
    if (!comSerialID) return;
    listCompanyEmployees(comSerialID)
      .then((list) => {
        if (active) setEmployees(list);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [comSerialID]);

  const chosenIds = new Set([eeSerialID, ...extras.map((person) => person.eeSerialID)]);
  const eeidQuery = peopleQuery.replace(/\D/g, '');
  const matches = eeidQuery
    ? employees
        .filter((employee) => {
          if (chosenIds.has(employee.eeSerialID)) return false;
          return String(employee.eeid).startsWith(eeidQuery);
        })
        .slice(0, 12)
    : [];

  function pickDate(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (event.type === 'set' && selected) {
      setPlanDate(selected);
      setPlanDateText(formatDateYMD(selected));
    }
  }

  function pickDeparture(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowDeparturePicker(false);
    if (event.type === 'set' && selected) {
      setDepartureTime(selected);
      setDepartureText(formatTime24(selected));
    }
  }

  function pickPlanTime(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowPlanPicker(false);
    if (event.type === 'set' && selected) {
      setPlanTime(selected);
      setPlanTimeText(formatTime24(selected));
    }
  }

  function pickReturn(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowReturnPicker(false);
    if (event.type === 'set' && selected) {
      setReturnTime(selected);
      setReturnText(formatTime24(selected));
    }
  }

  function addEmployee(employee: EmployeeDetails) {
    if (chosenIds.has(employee.eeSerialID)) return;
    const fullName = employee.fullName || employee.callName || employee.nameWithInitials || String(employee.eeid);
    setExtras((current) => [
      ...current,
      { eeSerialID: employee.eeSerialID, eeid: employee.eeid, fullName },
    ]);
    setPeopleQuery('');
  }

  async function handleSubmit() {
    if (!eeSerialID || !comSerialID) {
      setError('Restart the app and sign in again.');
      return;
    }
    if (!planDateText || !departureText || !planTimeText || !returnstatus) {
      setError('Enter the date, departure time, plan time, and return status.');
      return;
    }
    if (returnstatus === ReturnStatus.Returned && !returnText) {
      setError('Enter the return time.');
      return;
    }
    if (!reason.trim()) {
      setError('Enter the reason for this gate pass.');
      return;
    }

    const details = [
      {
        eGatePassSerialID: 0,
        comSerialID,
        eeSerialID,
        fullName: mainName,
      },
      ...extras.map((person) => ({
        eGatePassSerialID: 0,
        comSerialID,
        eeSerialID: person.eeSerialID,
        fullName: person.fullName,
      })),
    ];

    setError('');
    setSubmitting(true);
    try {
      await createGatePass({
        eeSerialID,
        comSerialID,
        departureTime: timeSpan(departureTime),
        returnTime: returnText ? timeSpan(returnTime) : '00:00:00',
        date: dateOnly(planDate),
        vehicleNumber,
        reason: reason.trim(),
        remark: remark.trim(),
        approvedBy: 0,
        approvedDate: null,
        confirmedBy: 0,
        confirmedDate: null,
        eGatePassStatus: EGatePassStatus.Pending,
        planDepartureDate: dateOnly(planDate),
        planDepartureTime: timeSpan(planTime),
        returnstatus,
        employeeGatePassDetail: details,
        mnuSerialID: 0,
      });
      Alert.alert('Gate pass created', 'The request was sent.');
      await onSubmit?.();
    } catch (err) {
      setError(getApiErrorMessage(err));
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
        {onBack ? (
          <Pressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
        ) : null}
        <Text style={styles.title}>Create GatePass</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Main employee</Text>
            <TextInput value={eeid ? `${mainName} · ${eeid}` : mainName} style={styles.input} editable={false} />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Date</Text>
            <Pressable onPress={() => setShowDatePicker(true)}>
              <TextInput
                value={planDateText}
                placeholder="Select date"
                placeholderTextColor={styles.placeholder.color}
                style={styles.input}
                editable={false}
                pointerEvents="none"
              />
            </Pressable>
            {showDatePicker ? (
              <DateTimePicker value={planDate} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={pickDate} />
            ) : null}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Departure time</Text>
            <Pressable onPress={() => setShowDeparturePicker(true)}>
              <TextInput
                value={departureText}
                placeholder="Select departure time"
                placeholderTextColor={styles.placeholder.color}
                style={styles.input}
                editable={false}
                pointerEvents="none"
              />
            </Pressable>
            {showDeparturePicker ? (
              <DateTimePicker value={departureTime} mode="time" is24Hour display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={pickDeparture} />
            ) : null}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Plan departure time</Text>
            <Pressable onPress={() => setShowPlanPicker(true)}>
              <TextInput
                value={planTimeText}
                placeholder="Select plan time"
                placeholderTextColor={styles.placeholder.color}
                style={styles.input}
                editable={false}
                pointerEvents="none"
              />
            </Pressable>
            {showPlanPicker ? (
              <DateTimePicker value={planTime} mode="time" is24Hour display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={pickPlanTime} />
            ) : null}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Return status</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={returnstatus}
                onValueChange={(itemValue) => setReturnstatus(itemValue as ReturnStatusValue | '')}
                style={styles.picker}
                dropdownIconColor={styles.picker.color}
              >
                <Picker.Item label="Select return status..." value="" color={styles.placeholder.color} />
                {RETURN_STATUS_OPTIONS.map((opt) => (
                  <Picker.Item key={opt.value} label={opt.label} value={opt.value} color={styles.picker.color} />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Return time</Text>
            <Pressable onPress={() => setShowReturnPicker(true)}>
              <TextInput
                value={returnText}
                placeholder="Select return time"
                placeholderTextColor={styles.placeholder.color}
                style={styles.input}
                editable={false}
                pointerEvents="none"
              />
            </Pressable>
            {showReturnPicker ? (
              <DateTimePicker value={returnTime} mode="time" is24Hour display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={pickReturn} />
            ) : null}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Vehicle number</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={vehicleNumber}
                onValueChange={(itemValue) => setVehicleNumber(String(itemValue))}
                style={styles.picker}
                dropdownIconColor={styles.picker.color}
              >
                <Picker.Item
                  label={loadingVehicles ? 'Loading vehicles...' : 'Select vehicle number...'}
                  value=""
                  color={styles.placeholder.color}
                />
                {vehicles.map((vehicle) => (
                  <Picker.Item
                    key={vehicle.comVehicleSerialID || vehicle.vehicleNumber}
                    label={vehicle.vehicleDesc ? `${vehicle.vehicleNumber} (${vehicle.vehicleDesc})` : vehicle.vehicleNumber}
                    value={vehicle.vehicleNumber}
                    color={styles.picker.color}
                  />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Reason</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Why is this gate pass needed?"
              placeholderTextColor={styles.placeholder.color}
              style={styles.input}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Remark</Text>
            <TextInput
              value={remark}
              onChangeText={setRemark}
              placeholder="Optional note"
              placeholderTextColor={styles.placeholder.color}
              style={styles.input}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Other employees</Text>
            <Text style={styles.hint}>The main employee is included. Enter an EEID to see employees, then add them.</Text>
            <View style={styles.memberRow}>
              <Text style={styles.memberName}>{mainName}</Text>
              <Text style={styles.memberMark}>Main</Text>
            </View>
            {extras.map((person) => (
              <View key={person.eeSerialID} style={styles.memberRow}>
                <Text style={styles.memberName}>EEID {person.eeid}</Text>
                <Pressable onPress={() => setExtras((current) => current.filter((item) => item.eeSerialID !== person.eeSerialID))} hitSlop={8}>
                  <Text style={styles.memberRemove}>Remove</Text>
                </Pressable>
              </View>
            ))}
            <TextInput
              value={peopleQuery}
              onChangeText={(value) => setPeopleQuery(value.replace(/\D/g, ''))}
              placeholder="Enter EEID"
              placeholderTextColor={styles.placeholder.color}
              style={styles.input}
              keyboardType="number-pad"
            />
            {matches.map((employee) => (
              <Pressable key={employee.eeSerialID} style={styles.matchRow} onPress={() => addEmployee(employee)}>
                <View style={styles.memberText}>
                  <Text style={styles.memberName}>EEID {employee.eeid}</Text>
                  <Text style={styles.hint}>
                    {employee.fullName || employee.callName || employee.nameWithInitials || 'Employee'}
                  </Text>
                </View>
                <Text style={styles.memberMark}>Add</Text>
              </Pressable>
            ))}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={({ pressed }) => [
              styles.submitBtn,
              submitting && styles.submitBtnDisabled,
              pressed && !submitting && styles.submitBtnPressed,
            ]}
          >
            <Text style={styles.submitText}>{submitting ? 'Submitting...' : 'Submit GatePass'}</Text>
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
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.xl,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.soft,
    },
    fieldGroup: {
      marginBottom: spacing.lg,
    },
    label: {
      ...typography.label,
      color: colors.text,
      marginBottom: spacing.xs,
    },
    hint: {
      ...typography.caption,
      color: colors.textSecondary,
      marginBottom: spacing.sm,
    },
    input: {
      ...typography.body,
      color: colors.text,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    pickerContainer: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      height: Platform.OS === 'android' ? 52 : undefined,
      justifyContent: 'center',
      overflow: 'hidden',
    },
    picker: {
      color: colors.text,
      backgroundColor: colors.background,
      width: '100%',
    },
    placeholder: {
      color: colors.textSecondary,
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    matchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
    },
    memberName: {
      ...typography.label,
      color: colors.text,
      flex: 1,
    },
    memberText: {
      flex: 1,
    },
    memberMark: {
      ...typography.caption,
      color: colors.primary,
      fontWeight: '700',
    },
    memberRemove: {
      ...typography.caption,
      color: colors.danger,
      fontWeight: '700',
    },
    errorText: {
      ...typography.body,
      color: colors.danger,
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
