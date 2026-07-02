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
import { getMobileShortLeaveEntries } from '../../api/endpoints/shortLeave';
import { getApiErrorMessage } from '../../api/client/client';
import { TextField } from '../../components/ui/TextField';
import { colors, radius, spacing, typography, shadow } from '../../styles/theme';
import type { AuthSession } from '../../types/api';
import type { MobileShortLeaveEntry } from '../../types/shortLeave';
import { getSlotLabel } from '../../types/shortLeave';
import {
  formatLeaveDate,
  isValidDateString,
} from '../../utils/leaveDates';

type Props = {
  session: AuthSession;
  refreshKey?: number;
  onBack: () => void;
  onEditShortLeave: (entry: MobileShortLeaveEntry) => void;
};

const PAGE_SIZE = 10;

function matchesDateFilter(item: MobileShortLeaveEntry, dateFilter: string): boolean {
  if (!dateFilter) return true;
  if (!item.date) return false;
  return item.date.slice(0, 10) === dateFilter;
}

function sortByDateDesc(items: MobileShortLeaveEntry[]): MobileShortLeaveEntry[] {
  return [...items].sort((a, b) => {
    const aTime = a.date ? new Date(a.date).getTime() : 0;
    const bTime = b.date ? new Date(b.date).getTime() : 0;
    return bTime - aTime;
  });
}

function ShortLeaveRecordCard({
  item,
  showEdit,
  onEdit,
}: {
  item: MobileShortLeaveEntry;
  showEdit: boolean;
  onEdit: (entry: MobileShortLeaveEntry) => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.cardName}>Short Leave #{item.shortLeaveSerialID}</Text>
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
        <Text style={styles.detailLabel}>Date</Text>
        <Text style={styles.detailValue}>{formatLeaveDate(item.date)}</Text>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Slot</Text>
        <Text style={styles.detailValue}>
          {getSlotLabel(item.slot, item.slotName)}
        </Text>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Reason</Text>
        <Text style={styles.detailValue}>{item.reason ?? '—'}</Text>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Applied</Text>
        <Text style={styles.detailValue}>{formatLeaveDate(item.createdDate)}</Text>
      </View>

      {showEdit ? (
        <Pressable
          style={styles.editBtn}
          onPress={() => onEdit(item)}
        >
          <Text style={styles.editBtnText}>Edit Short Leave</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ViewShortLeaveScreen({
  session,
  refreshKey = 0,
  onBack,
  onEditShortLeave,
}: Props) {
  const [items, setItems] = useState<MobileShortLeaveEntry[]>([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [dateFilter, setDateFilter] = useState('');

  const eeSerialID = session.eESerialID ?? undefined;
  const apiDateFrom =
    dateFilter && isValidDateString(dateFilter) ? dateFilter : undefined;

  const visibleItems = useMemo(() => {
    let filtered = items.filter((item) => item.active === activeOnly);

    if (apiDateFrom) {
      filtered = filtered.filter((item) => matchesDateFilter(item, apiDateFrom));
    }

    return sortByDateDesc(filtered);
  }, [activeOnly, apiDateFrom, items]);

  const fetchPage = useCallback(
    async (page: number, replace: boolean) => {
      if (!eeSerialID) {
        throw new Error('Employee ID not found in session. Please login again.');
      }

      const result = await getMobileShortLeaveEntries(
        {
          PageNumber: page,
          PageSize: PAGE_SIZE,
          EESerialID: eeSerialID,
          DateFrom: apiDateFrom,
        },
        session.comSerialID,
      );

      setItems((current) => {
        const merged = replace ? result.items : [...current, ...result.items];
        return sortByDateDesc(merged);
      });
      setPageNumber(result.currentPage);
      setHasNextPage(result.hasNextPage);
    },
    [apiDateFrom, eeSerialID, session.comSerialID],
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
        <Text style={styles.headerTitle}>View Short Leave</Text>
        <Text style={styles.headerSubtitle}>
          {visibleItems.length > 0
            ? `${visibleItems.length} ${activeOnly ? 'active' : 'inactive'} short leave record(s)`
            : `Your ${activeOnly ? 'active' : 'inactive'} short leave history`}
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
          label="Filter by Date"
          placeholder="YYYY-MM-DD"
          value={dateFilter}
          onChangeText={setDateFilter}
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
          keyExtractor={(item) =>
            String(item.id ?? item.shortLeaveSerialID)
          }
          renderItem={({ item }) => (
            <ShortLeaveRecordCard
              item={item}
              showEdit={!item.active}
              onEdit={onEditShortLeave}
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
              <Text style={styles.emptyText}>No short leave records found.</Text>
              <Text style={styles.emptyHint}>
                {activeOnly
                  ? 'Try the Inactive tab, or add a short leave from Leave Management.'
                  : 'No inactive short leave records for your account.'}
              </Text>
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
  emptyHint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 18,
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
