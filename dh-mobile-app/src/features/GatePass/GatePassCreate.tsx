import React, { useState } from 'react';
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

  const [passType, setPassType] = useState<GatePassType>('EXIT');
  const [purpose, setPurpose] = useState('');
  const [destination, setDestination] = useState('');
  const [vehicleOrItem, setVehicleOrItem] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!purpose.trim()) {
      setError('Please enter the reason or purpose for this gate pass.');
      return;
    }
    if (!destination.trim()) {
      setError('Please enter the destination or location.');
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
          <Text style={styles.sectionLabel}>Pass Type</Text>
          <View style={styles.segmentedRow}>
            {(['EXIT', 'ENTRY'] as const).map((type) => {
              const active = passType === type;
              return (
                <Pressable
                  key={type}
                  onPress={() => setPassType(type)}
                  style={[
                    styles.segmentBtn,
                    active && styles.segmentBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      active && styles.segmentTextActive,
                    ]}
                  >
                    {type === 'EXIT' ? 'Exit Pass' : 'Entry Pass'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Purpose *</Text>
            <TextInput
              value={purpose}
              onChangeText={setPurpose}
              placeholder="e.g. Official visit, material dispatch, personal"
              placeholderTextColor={styles.placeholder.color}
              style={styles.input}
            />
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