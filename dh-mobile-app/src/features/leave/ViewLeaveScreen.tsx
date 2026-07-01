import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { getMobileLeaveEntries } from '../../api/endpoints/leave';
import { getApiErrorMessage } from '../../api/client/client';
import { TextField } from '../../components/ui/TextField';
import { colors, radius, spacing, typography, shadow } from '../../styles/theme';
import type { AuthSession } from '../../types/api';
import type { MobileLeaveEntry } from '../../types/leave';

type Props = {
  session: AuthSession;
  refreshKey?: number;
  onBack: () => void;
  onEditLeave: (leaveId: number) => void;
};

const PAGE_SIZE = 10;

function formatDate(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

function matchesDateFrom(item: MobileLeaveEntry, dateFromFilter: string): boolean {
  if (!dateFromFilter) return true;
  if (!item.dateFrom) return false;
  return item.dateFrom.slice(0, 10) === dateFromFilter;
}

function sortByDateFromDesc(items: MobileLeaveEntry[]): MobileLeaveEntry[] {
  return [...items].sort((a, b) => {
    const aTime = a.dateFrom ? new Date(a.dateFrom).getTime() : 0;
    const bTime = b.dateFrom ? new Date(b.dateFrom).getTime() : 0;
    return bTime - aTime;
  });
}

function LeaveRecordCard({
  item,
  showEdit,
  onEdit,
}: {
  item: MobileLeaveEntry;
  showEdit: boolean;
  onEdit: (leaveId: number) => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.cardName}>
            {item.leaveTypeName ?? `Leave #${item.empLeaveSerialID}`}
          </Text>
          <Text style={styles.cardMeta}>
            {item.applicantName ?? '—'} · EPF {item.epfNumber ?? '—'}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            item.active ? styles.statusActive : styles.statusInactive,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              item.active ? styles.statusTextActive : styles.statusTextInactive,
            ]}
          >
            {item.active ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>From</Text>
        <Text style={styles.detailValue}>{formatDate(item.dateFrom)}</Text>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>To</Text>
        <Text style={styles.detailValue}>{formatDate(item.dateTo)}</Text>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Days</Text>
        <Text style={styles.detailValue}>
          {item.leaveCount != null ? item.leaveCount.toFixed(1) : '—'}
        </Text>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Reason</Text>
        <Text style={styles.detailValue}>{item.reasonName ?? '—'}</Text>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Applied</Text>
        <Text style={styles.detailValue}>{formatDate(item.createdDate)}</Text>
      </View>

      {showEdit ? (
        <Pressable
          style={styles.editBtn}
          onPress={() => onEdit(item.id)}
        >
          <Text style={styles.editBtnText}>Edit Leave</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ViewLeaveScreen({
  session,
  refreshKey = 0,
  onBack,
  onEditLeave,
}: Props) {
  const [items, setItems] = useState<MobileLeaveEntry[]>([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [dateFromFilter, setDateFromFilter] = useState('');

  const eeSerialID = session.eESerialID ?? undefined;
  const apiDateFrom =
    dateFromFilter && isValidDateString(dateFromFilter) ? dateFromFilter : undefined;

  const visibleItems = useMemo(() => {
    const filtered = apiDateFrom
      ? items.filter((item) => matchesDateFrom(item, apiDateFrom))
      : items;
    return sortByDateFromDesc(filtered);
  }, [apiDateFrom, items]);

  const fetchPage = useCallback(
    async (page: number, replace: boolean) => {
      if (!eeSerialID) {
        throw new Error('Employee ID not found in session. Please login again.');
      }

      const result = await getMobileLeaveEntries({
        status: activeOnly,
        PageNumber: page,
        PageSize: PAGE_SIZE,
        EESerialID: eeSerialID,
        DateFrom: apiDateFrom,
        SortColumn: 'dateFrom',
        SortDirection: 'desc',
      });

      setItems((current) => {
        const merged = replace ? result.items : [...current, ...result.items];
        return sortByDateFromDesc(merged);
      });
      setPageNumber(result.currentPage);
      setHasNextPage(result.hasNextPage);
      setTotalCount(result.totalCount);
    },
    [activeOnly, apiDateFrom, eeSerialID],
  );

  const loadInitial = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      await fetchPage(1, true);
    } catch (err) {
      setError(getApiErrorMessage(err));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial, refreshKey]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError('');
    try {
      await fetchPage(1, true);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setRefreshing(false);
    }
  };

  const handleLoadMore = async () => {
    if (!hasNextPage || loadingMore || loading) {
      return;
    }

    setLoadingMore(true);
    setError('');
    try {
      await fetchPage(pageNumber + 1, false);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Pressable style={styles.backBtn} onPress={onBack} hitSlop={8}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>View Leave</Text>
        <Text style={styles.headerSubtitle}>
          {totalCount > 0 ? `${totalCount} leave record(s)` : 'Your leave history'}
        </Text>
      </LinearGradient>

      <View style={styles.filters}>
        <View style={styles.toolbar}>
          <Pressable
            style={[styles.filterChip, activeOnly && styles.filterChipActive]}
            onPress={() => setActiveOnly(true)}
          >
            <Text
              style={[
                styles.filterChipText,
                activeOnly && styles.filterChipTextActive,
              ]}
            >
              Active
            </Text>
          </Pressable>
          <Pressable
            style={[styles.filterChip, !activeOnly && styles.filterChipActive]}
            onPress={() => setActiveOnly(false)}
          >
            <Text
              style={[
                styles.filterChipText,
                !activeOnly && styles.filterChipTextActive,
              ]}
            >
              Inactive
            </Text>
          </Pressable>
        </View>

        <TextField
          label="Filter by Date From"
          placeholder="YYYY-MM-DD"
          value={dateFromFilter}
          onChangeText={setDateFromFilter}
        />
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={visibleItems}
          keyExtractor={(item) => String(item.id ?? item.empLeaveSerialID)}
          renderItem={({ item }) => (
            <LeaveRecordCard
              item={item}
              showEdit={!activeOnly}
              onEdit={onEditLeave}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No leave records found.</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                style={styles.footerLoader}
                color={colors.primary}
              />
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: spacing.xxxl + spacing.md,
    paddingBottom: spacing.xl,
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
  filters: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  toolbar: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  filterChip: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  filterChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: colors.primary,
  },
  filterChipText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.primary,
  },
  listContent: {
    padding: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.soft,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  cardTitleBlock: {
    flex: 1,
    marginRight: spacing.sm,
  },
  cardName: {
    ...typography.title,
    color: colors.text,
  },
  cardMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  statusBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  statusActive: {
    backgroundColor: '#DCFCE7',
  },
  statusInactive: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600',
  },
  statusTextActive: {
    color: colors.success,
  },
  statusTextInactive: {
    color: colors.danger,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  detailLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  detailValue: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
    maxWidth: '60%',
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
    color: colors.textMuted,
    textAlign: 'center',
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  footerLoader: {
    marginVertical: spacing.lg,
  },
  editBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  editBtnText: {
    ...typography.label,
    color: colors.textOnPrimary,
  },
});
