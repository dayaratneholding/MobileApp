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
import { getEmployeeLoanPaged } from '../../api/endpoints/employeeLoan';
import { getApiErrorMessage } from '../../api/client/client';
import { colors, radius, spacing, typography, shadow } from '../../styles/theme';
import type { AuthSession } from '../../types/api';
import type { EmployeeLoanListItem } from '../../types/employeeLoan';
import { formatCurrency } from '../../types/employeeLoan';
import { formatLeaveDate } from '../../utils/leaveDates';

type Props = {
  session: AuthSession;
  refreshKey?: number;
  onBack: () => void;
  onEditSalaryAdvance: (entry: EmployeeLoanListItem) => void;
};

const PAGE_SIZE = 10;

type StatusFilter = 'all' | 'active' | 'inactive';

function sortByStartDateDesc(items: EmployeeLoanListItem[]): EmployeeLoanListItem[] {
  return [...items].sort((a, b) => {
    const aTime = a.startDate ? new Date(a.startDate).getTime() : 0;
    const bTime = b.startDate ? new Date(b.startDate).getTime() : 0;
    return bTime - aTime;
  });
}

function SalaryAdvanceRecordCard({
  item,
  showEdit,
  onEdit,
}: {
  item: EmployeeLoanListItem;
  showEdit: boolean;
  onEdit: (entry: EmployeeLoanListItem) => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.cardName}>
            Advance #{item.employeeLoanSerialID}
          </Text>
          <Text style={styles.cardMeta}>
            {item.loanDescription ?? 'Salary Advance'}
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
        <Text style={styles.detailLabel}>Amount</Text>
        <Text style={styles.detailValue}>{formatCurrency(item.loanAmount)}</Text>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Start Date</Text>
        <Text style={styles.detailValue}>{formatLeaveDate(item.startDate)}</Text>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Installments</Text>
        <Text style={styles.detailValue}>
          {item.installments ?? '—'}
          {item.installmentAmount != null
            ? ` × ${formatCurrency(item.installmentAmount)}`
            : ''}
        </Text>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Remaining</Text>
        <Text style={[styles.detailValue, styles.remainingValue]}>
          {formatCurrency(item.remainingAmount ?? item.balanceAmount)}
        </Text>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Applied</Text>
        <Text style={styles.detailValue}>{formatLeaveDate(item.createdDate)}</Text>
      </View>

      {showEdit ? (
        <Pressable style={styles.editBtn} onPress={() => onEdit(item)}>
          <Text style={styles.editBtnText}>Edit Salary Advance</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ViewSalaryAdvanceScreen({
  session,
  refreshKey = 0,
  onBack,
  onEditSalaryAdvance,
}: Props) {
  const [items, setItems] = useState<EmployeeLoanListItem[]>([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const eeSerialID = session.eESerialID ?? undefined;

  const visibleItems = useMemo(() => {
    let filtered = items;

    if (statusFilter === 'active') {
      filtered = filtered.filter((item) => item.active === true);
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter((item) => item.active === false);
    }

    return sortByStartDateDesc(filtered);
  }, [items, statusFilter]);

  const fetchPage = useCallback(
    async (page: number, replace: boolean) => {
      if (!eeSerialID) {
        throw new Error('Employee ID not found in session. Please login again.');
      }

      const result = await getEmployeeLoanPaged({
        PageNumber: page,
        PageSize: PAGE_SIZE,
        EESerialID: eeSerialID,
        SortColumn: 'startDate',
        SortDirection: 'desc',
        status:
          statusFilter === 'all'
            ? undefined
            : statusFilter === 'active',
      });

      setItems((current) => {
        const merged = replace ? result.items : [...current, ...result.items];
        return sortByStartDateDesc(merged);
      });
      setPageNumber(result.currentPage);
      setHasNextPage(result.hasNextPage);
    },
    [eeSerialID, statusFilter],
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
        <Text style={styles.headerTitle}>View Salary Advance</Text>
        <Text style={styles.headerSubtitle}>
          {visibleItems.length > 0
            ? `${visibleItems.length} salary advance record(s)`
            : 'Your salary advance history'}
        </Text>
      </LinearGradient>

      <View style={styles.filters}>
        <View style={styles.toolbar}>
          <Pressable
            style={[styles.filterChip, statusFilter === 'all' && styles.filterChipActive]}
            onPress={() => setStatusFilter('all')}
          >
            <Text
              style={[
                styles.filterChipText,
                statusFilter === 'all' && styles.filterChipTextActive,
              ]}
            >
              All
            </Text>
          </Pressable>
          <Pressable
            style={[styles.filterChip, statusFilter === 'active' && styles.filterChipActive]}
            onPress={() => setStatusFilter('active')}
          >
            <Text
              style={[
                styles.filterChipText,
                statusFilter === 'active' && styles.filterChipTextActive,
              ]}
            >
              Active
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.filterChip,
              statusFilter === 'inactive' && styles.filterChipActive,
            ]}
            onPress={() => setStatusFilter('inactive')}
          >
            <Text
              style={[
                styles.filterChipText,
                statusFilter === 'inactive' && styles.filterChipTextActive,
              ]}
            >
              Inactive
            </Text>
          </Pressable>
        </View>
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
            String(item.id ?? item.employeeLoanSerialID)
          }
          renderItem={({ item }) => (
            <SalaryAdvanceRecordCard
              item={item}
              showEdit={!item.active}
              onEdit={onEditSalaryAdvance}
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
              <Text style={styles.emptyText}>No salary advance records found.</Text>
              <Text style={styles.emptyHint}>
                {statusFilter === 'all'
                  ? 'Request a salary advance from Salary Advance home.'
                  : `No ${statusFilter} salary advance records for your account.`}
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
    paddingBottom: spacing.sm,
  },
  toolbar: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.textOnPrimary,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxxl,
  },
  listContent: {
    padding: spacing.xl,
    paddingTop: spacing.sm,
    flexGrow: 1,
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
    marginRight: spacing.md,
  },
  cardName: {
    ...typography.title,
    color: colors.text,
  },
  cardMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  statusActive: {
    backgroundColor: '#DCFCE7',
  },
  statusInactive: {
    backgroundColor: '#F3F4F6',
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600',
  },
  statusTextActive: {
    color: colors.success,
  },
  statusTextInactive: {
    color: colors.textMuted,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  detailLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  detailValue: {
    ...typography.title,
    color: colors.text,
  },
  remainingValue: {
    color: colors.primary,
  },
  editBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: '#FEE2E2',
  },
  editBtnText: {
    ...typography.label,
    color: colors.danger,
  },
  emptyText: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
  },
  emptyHint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  footerLoader: {
    marginVertical: spacing.lg,
  },
});
