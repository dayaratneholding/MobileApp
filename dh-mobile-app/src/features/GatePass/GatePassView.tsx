import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getApiErrorMessage } from '../../api/client/client';
import {
  listEmployeeGatePasses,
  type EmployeeGatePass,
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

type Props = {
  session: AuthSession;
  onBack: () => void;
};

const PAGE_SIZE = 20;

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

function GatePassCard({ item }: { item: EmployeeGatePass }) {
  const styles = useThemedStyles(createStyles);
  const tone = statusStyleKey(item);
  const planTime = item.planDepartureTime === '—' ? '' : ` · ${item.planDepartureTime}`;

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
      <Detail label="Vehicle" value={item.vehicleNumber} />
      <Detail label="Reason" value={item.reason} />
      {item.remark !== '—' ? <Detail label="Remark" value={item.remark} /> : null}
      {item.approvedBy !== '—' ? <Detail label="Approved by" value={item.approvedBy} /> : null}
      {item.confirmedBy !== '—' ? <Detail label="Confirmed by" value={item.confirmedBy} /> : null}
    </View>
  );
}

export function GatePassView({ session, onBack }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const eeSerialID = session.eESerialID ?? 0;
  const [items, setItems] = useState<EmployeeGatePass[]>([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const fetchPage = useCallback(
    async (page: number, replace: boolean) => {
      if (!eeSerialID) {
        throw new Error('Employee ID not found in session. Please login again.');
      }

      const result = await listEmployeeGatePasses({
        eeSerialID,
        pageNumber: page,
        pageSize: PAGE_SIZE,
      });

      setItems((current) => (replace ? result.items : [...current, ...result.items]));
      setPageNumber(result.currentPage);
      setHasNextPage(result.hasNextPage);
    },
    [eeSerialID],
  );

  const loadInitial = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      await fetchPage(1, true);
    } catch (err) {
      setItems([]);
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  async function handleRefresh() {
    setRefreshing(true);
    setError('');
    try {
      await fetchPage(1, true);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setRefreshing(false);
    }
  }

  async function handleLoadMore() {
    if (!hasNextPage || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      await fetchPage(pageNumber + 1, false);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <View>
          <Text style={styles.title}>View GatePass</Text>
          <Text style={styles.subtitle}>
            {items.length > 0 ? `${items.length} pass${items.length === 1 ? '' : 'es'}` : 'Your gate passes'}
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
          renderItem={({ item }) => <GatePassCard item={item} />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No gate passes found.</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={styles.footerLoader} color={colors.primary} /> : undefined
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
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    emptyText: {
      ...typography.body,
      color: colors.textSecondary,
    },
    footerLoader: {
      marginVertical: spacing.md,
    },
  });
}
