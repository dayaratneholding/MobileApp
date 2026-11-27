import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getApiErrorMessage } from '../../api/client/client';
import {
  decideGatePass,
  listGatePassApprovalMembers,
  listGatePassesForDecision,
  resolveGatePassAccess,
  type EmployeeGatePass,
  type GatePassDecision,
} from '../../api/endpoints/gatePass';
import {
  radius,
  spacing,
  typography,
  type ColorPalette,
  type ShadowTokens,
} from '../../styles/theme';
import { useTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { AuthSession } from '../../types/api';

type Mode = 'confirm' | 'approve';

type Props = {
  session: AuthSession;
  mode: Mode;
  onBack: () => void;
};

function statusStyleKey(item: EmployeeGatePass): 'pending' | 'ok' | 'bad' | 'neutral' {
  const name = item.statusName.toLowerCase();
  if (item.status === 7 || name.includes('reject')) return 'bad';
  if (item.status === 1 || name.includes('pending')) return 'pending';
  if (
    item.status === 2 ||
    item.status === 3 ||
    item.status === 5 ||
    name.includes('approv') ||
    name.includes('confirm') ||
    name.includes('return')
  ) {
    return 'ok';
  }
  return 'neutral';
}

function Detail({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function GatePassCard({
  item,
  mode,
  busy,
  onConfirm,
  onReject,
}: {
  item: EmployeeGatePass;
  mode: Mode;
  busy: boolean;
  onConfirm: (item: EmployeeGatePass) => void;
  onReject: (item: EmployeeGatePass) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const tone = statusStyleKey(item);
  const planTime = item.planDepartureTime === '—' ? '' : ` · ${item.planDepartureTime}`;
  const acceptLabel = mode === 'confirm' ? 'Confirm' : 'Approve';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.cardTitle}>{item.date}</Text>
          <Text style={styles.cardMeta}>
            {item.employeeLabel !== '—'
              ? item.employeeLabel
              : item.eeid
                ? `EEID ${item.eeid}`
                : `Pass #${item.eGatePassSerialID || item.id}`}
          </Text>
        </View>
        <View style={[styles.badge, styles[`badge_${tone}`]]}>
          <Text style={[styles.badgeText, styles[`badgeText_${tone}`]]}>{item.statusName}</Text>
        </View>
      </View>

      <Detail label="Plan" value={`${item.planDepartureDate}${planTime}`} />
      <Detail label="Departure" value={item.departureTime} />
      <Detail label="Return" value={item.returnTime} />
      <Detail label="Return status" value={item.returnStatus} />
      <Detail label="Vehicle" value={item.vehicleNumber} />
      <Detail label="Reason" value={item.reason} />
      {item.remark !== '—' ? <Detail label="Remark" value={item.remark} /> : null}

      <View style={styles.actions}>
        <Pressable
          style={[styles.rejectBtn, busy && styles.btnDisabled]}
          disabled={busy}
          onPress={() => onReject(item)}
        >
          <Text style={styles.rejectText}>Reject</Text>
        </Pressable>
        <Pressable
          style={[styles.acceptBtn, busy && styles.btnDisabled]}
          disabled={busy}
          onPress={() => onConfirm(item)}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.acceptText}>{acceptLabel}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

export function ConfirmGatePassScreen({ session, mode, onBack }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [items, setItems] = useState<EmployeeGatePass[]>([]);
  const [actorEeSerialID, setActorEeSerialID] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(0);
  const [error, setError] = useState('');

  const title = mode === 'confirm' ? 'Confirm GatePass' : 'Approve GatePass';

  const load = useCallback(async () => {
    const members = await listGatePassApprovalMembers();
    const access = resolveGatePassAccess(members, session);
    const allowed = mode === 'confirm' ? access.isHod : access.isAdmin;
    if (!allowed || !access.eeSerialID) {
      setActorEeSerialID(0);
      setItems([]);
      throw new Error(
        mode === 'confirm'
          ? 'Only a gate pass HOD can confirm these requests.'
          : 'Only a gate pass admin can approve these requests.',
      );
    }

    setActorEeSerialID(access.eeSerialID);
    const passes = await listGatePassesForDecision(mode, access.eeSerialID);
    setItems(passes);
  }, [mode, session]);

  const loadInitial = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      await load();
    } catch (err) {
      setItems([]);
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  async function handleRefresh() {
    setRefreshing(true);
    setError('');
    try {
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setRefreshing(false);
    }
  }

  async function applyDecision(item: EmployeeGatePass, decision: GatePassDecision) {
    if (!item.eGatePassSerialID || !actorEeSerialID) return;
    setBusyId(item.eGatePassSerialID);
    setError('');
    try {
      await decideGatePass({
        eGatePassSerialID: item.eGatePassSerialID,
        actorEeSerialID,
        decision,
      });
      setItems((current) => current.filter((pass) => pass.eGatePassSerialID !== item.eGatePassSerialID));
      const done =
        decision === 'reject' ? 'rejected' : decision === 'confirm' ? 'confirmed' : 'approved';
      Alert.alert('Gate pass updated', `The gate pass was ${done}.`);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusyId(0);
    }
  }

  function handleReject(item: EmployeeGatePass) {
    Alert.alert('Reject gate pass', 'Are you sure you want to reject this gate pass?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: () => {
          void applyDecision(item, 'reject');
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            {items.length > 0
              ? `${items.length} waiting`
              : mode === 'confirm'
                ? 'Passes waiting for confirmation'
                : 'Passes waiting for approval'}
          </Text>
        </View>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.eGatePassSerialID || item.id)}
          renderItem={({ item }) => (
            <GatePassCard
              item={item}
              mode={mode}
              busy={busyId === item.eGatePassSerialID}
              onConfirm={(pass) => {
                void applyDecision(pass, mode);
              }}
              onReject={handleReject}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>
                {error ? 'Nothing to show.' : 'No gate passes are waiting.'}
              </Text>
            </View>
          }
        />
      )}
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
      ...typography.h3,
      color: colors.textOnPrimary,
    },
    subtitle: {
      ...typography.caption,
      color: colors.textOnPrimary,
      opacity: 0.85,
    },
    errorText: {
      ...typography.caption,
      color: colors.danger,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
    },
    listContent: {
      padding: spacing.lg,
      paddingBottom: spacing.xxxl,
      flexGrow: 1,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      ...shadow.soft,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    cardTitleBlock: {
      flex: 1,
      marginRight: spacing.sm,
    },
    cardTitle: {
      ...typography.title,
      color: colors.text,
    },
    cardMeta: {
      ...typography.caption,
      color: colors.textMuted,
      marginTop: spacing.xs,
    },
    badge: {
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    badge_pending: { backgroundColor: colors.tintWarning },
    badge_ok: { backgroundColor: colors.tintSuccess },
    badge_bad: { backgroundColor: colors.tintDanger },
    badge_neutral: { backgroundColor: colors.tintNeutral },
    badgeText: {
      ...typography.caption,
      fontWeight: '600',
    },
    badgeText_pending: { color: colors.warning },
    badgeText_ok: { color: colors.success },
    badgeText_bad: { color: colors.danger },
    badgeText_neutral: { color: colors.textSecondary },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingVertical: spacing.xs,
      gap: spacing.md,
    },
    detailLabel: {
      ...typography.caption,
      color: colors.textMuted,
      width: 92,
    },
    detailValue: {
      ...typography.caption,
      color: colors.text,
      flex: 1,
      textAlign: 'right',
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    rejectBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.danger,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      alignItems: 'center',
    },
    rejectText: {
      ...typography.label,
      color: colors.danger,
    },
    acceptBtn: {
      flex: 1,
      backgroundColor: colors.success,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      alignItems: 'center',
    },
    acceptText: {
      ...typography.label,
      color: colors.textOnPrimary,
    },
    btnDisabled: {
      opacity: 0.6,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    emptyText: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });
}
