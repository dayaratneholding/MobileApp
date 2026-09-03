import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { getAttendancePaged } from '../../api/endpoints/attendance';
import { getEmployeeByEeSerialId } from '../../api/endpoints/employee';
import { getApiErrorMessage } from '../../api/client/client';
import { TextField } from '../../components/ui/TextField';
import { radius, spacing, typography, type ColorPalette, type ShadowTokens } from '../../styles/theme';
import { useTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { AuthSession } from '../../types/api';
import type { AttendanceListItem } from '../../types/attendance';
import {
  formatAttendanceDate,
  formatAttendanceTime,
} from '../../types/attendance';
import { parseUserDateFilter } from '../../utils/leaveDates';

type Props = {
  session: AuthSession;
  onBack: () => void;
};

const LAST_N = 10;
/** Fetch a larger company page so we can pick this employee's latest records. */
const FETCH_PAGE_SIZE = 100;

function sortByDateDesc(items: AttendanceListItem[]): AttendanceListItem[] {
  return [...items].sort((a, b) => {
    const aTime = a.dateIn ? new Date(a.dateIn).getTime() : 0;
    const bTime = b.dateIn ? new Date(b.dateIn).getTime() : 0;
    if (aTime !== bTime) {
      return bTime - aTime;
    }

    // Same day: prefer later time-in if comparable as string HH:MM
    const aIn = String(a.timeIn ?? '');
    const bIn = String(b.timeIn ?? '');
    return bIn.localeCompare(aIn);
  });
}

function AttendanceRecordCard({ item }: { item: AttendanceListItem }) {
  const styles = useThemedStyles(createStyles);
  const status = item.attendanceStatus?.trim() || (item.active ? 'Present' : '—');

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.cardName}>{formatAttendanceDate(item.dateIn)}</Text>
          <Text style={styles.cardMeta}>
            {item.shiftName ?? 'Shift'} · EEID {item.eeid ?? '—'}
          </Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </View>

      <View style={styles.timeRow}>
        <View style={styles.timeBox}>
          <Text style={styles.timeLabel}>In</Text>
          <Text style={styles.timeValue}>{formatAttendanceTime(item.timeIn)}</Text>
        </View>
        <View style={styles.timeBox}>
          <Text style={styles.timeLabel}>Out</Text>
          <Text style={styles.timeValue}>{formatAttendanceTime(item.timeOut)}</Text>
        </View>
      </View>

      {(item.deptName || item.sectName) && (
        <Text style={styles.deptText}>
          {[item.deptName, item.sectName].filter(Boolean).join(' · ')}
        </Text>
      )}
    </View>
  );
}

export function ViewAttendanceScreen({ session, onBack }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [allItems, setAllItems] = useState<AttendanceListItem[]>([]);
  const [eeid, setEeid] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [appliedDate, setAppliedDate] = useState<string | null>(null);

  const eeSerialID = session.eESerialID ?? undefined;
  const dateFilterHint = dateFilter.trim()
    ? parseUserDateFilter(dateFilter)
      ? null
      : 'Use YYYY-MM-DD (e.g. 2026-07-24)'
    : null;

  const visibleItems = useMemo(() => {
    const sorted = sortByDateDesc(allItems);

    if (appliedDate) {
      // Date filter: only that day
      return sorted.filter((item) => item.dateIn === appliedDate);
    }

    // Default: last 10 attendance records
    return sorted.slice(0, LAST_N);
  }, [allItems, appliedDate]);

  const ensureEeid = useCallback(async (): Promise<number | null> => {
    if (eeid != null) {
      return eeid;
    }

    if (!eeSerialID) {
      return null;
    }

    try {
      const employee = await getEmployeeByEeSerialId(eeSerialID);
      setEeid(employee.eeid);
      return employee.eeid;
    } catch (err) {
      if (__DEV__) {
        console.warn('[Attendance] Could not resolve EEID:', err);
      }
      return null;
    }
  }, [eeSerialID, eeid]);

  const loadAttendance = useCallback(async () => {
    if (!eeSerialID) {
      throw new Error('Employee ID not found in session. Please login again.');
    }

    const resolvedEeid = await ensureEeid();

    // Walk a few pages until we have enough employee records for "last 10"
    // (company-wide paging may not put this employee on page 1).
    const collected: AttendanceListItem[] = [];
    const seen = new Set<string>();
    let page = 1;
    let hasNext = true;

    while (hasNext && page <= 5 && collected.length < 40) {
      const result = await getAttendancePaged({
        ComSerialID: session.comSerialID,
        PageNumber: page,
        PageSize: FETCH_PAGE_SIZE,
        SortColumn: 'dateIn',
        SortDirection: 'desc',
        Filter: resolvedEeid != null ? String(resolvedEeid) : undefined,
        eeid: resolvedEeid ?? undefined,
        eeSerialID,
        EESerialID: eeSerialID,
        EEID: resolvedEeid ?? undefined,
      });

      for (const item of result.items) {
        const key = String(
          item.attendanceSerialID ??
            item.id ??
            `${item.dateIn}-${item.timeIn}-${item.eeid}`,
        );
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        collected.push(item);
      }

      hasNext = result.hasNextPage;
      page += 1;

      // Enough for last 10 after sort
      if (collected.length >= LAST_N * 3) {
        break;
      }
    }

    setAllItems(sortByDateDesc(collected));
  }, [eeSerialID, ensureEeid, session.comSerialID]);

  const loadInitial = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      await loadAttendance();
    } catch (err) {
      setError(getApiErrorMessage(err));
      setAllItems([]);
    } finally {
      setLoading(false);
    }
  }, [loadAttendance]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  const handleApplyDateFilter = () => {
    const trimmed = dateFilter.trim();
    if (!trimmed) {
      setAppliedDate(null);
      setError('');
      return;
    }

    const parsed = parseUserDateFilter(trimmed);
    if (!parsed) {
      setError('Please enter a valid date as YYYY-MM-DD (e.g. 2026-07-24).');
      return;
    }

    setError('');
    setDateFilter(parsed);
    setAppliedDate(parsed);
  };

  const handleClearDateFilter = () => {
    setDateFilter('');
    setAppliedDate(null);
    setError('');
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setError('');
    try {
      await loadAttendance();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setRefreshing(false);
    }
  };

  const subtitle = appliedDate
    ? `Date: ${appliedDate}${visibleItems.length ? ` · ${visibleItems.length} record(s)` : ''}`
    : `Last ${LAST_N} records${eeid != null ? ` · EEID ${eeid}` : ''}`;

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
        <Text style={styles.headerTitle}>My Attendance</Text>
        <Text style={styles.headerSubtitle}>{subtitle}</Text>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={styles.filters}>
          <TextField
            label="Filter by Date"
            placeholder="YYYY-MM-DD"
            value={dateFilter}
            onChangeText={setDateFilter}
            onSubmitEditing={handleApplyDateFilter}
            returnKeyType="search"
          />
          {dateFilterHint ? (
            <Text style={styles.filterHint}>{dateFilterHint}</Text>
          ) : appliedDate ? (
            <Text style={styles.filterApplied}>
              Showing only {appliedDate}
            </Text>
          ) : (
            <Text style={styles.filterHintMuted}>
              Showing last {LAST_N} attendance records. Enter a date to filter.
            </Text>
          )}
          <View style={styles.filterActions}>
            <Pressable style={styles.filterBtn} onPress={handleApplyDateFilter}>
              <Text style={styles.filterBtnText}>Apply</Text>
            </Pressable>
            {appliedDate ? (
              <Pressable
                style={[styles.filterBtn, styles.filterBtnClear]}
                onPress={handleClearDateFilter}
              >
                <Text style={[styles.filterBtnText, styles.filterBtnClearText]}>
                  Clear
                </Text>
              </Pressable>
            ) : null}
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
            keyExtractor={(item, index) =>
              String(item.attendanceSerialID ?? item.id ?? `${item.dateIn}-${index}`)
            }
            renderItem={({ item }) => <AttendanceRecordCard item={item} />}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[colors.primary]}
              />
            }
            ListEmptyComponent={
              <View style={styles.centered}>
                <Text style={styles.emptyText}>
                  {appliedDate
                    ? `No attendance on ${appliedDate}.`
                    : 'No attendance records found.'}
                </Text>
                <Text style={styles.emptyHint}>
                  {appliedDate
                    ? 'Try another date, or Clear to see last 10 records.'
                    : 'Pull down to refresh.'}
                </Text>
              </View>
            }
          />
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

function createStyles(colors: ColorPalette, shadow: ShadowTokens) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
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
  filterHint: {
    ...typography.caption,
    color: colors.danger,
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
  },
  filterHintMuted: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
  },
  filterApplied: {
    ...typography.caption,
    color: colors.success,
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
  },
  filterActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  filterBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  filterBtnClear: {
    backgroundColor: colors.inputBg,
  },
  filterBtnText: {
    ...typography.label,
    color: colors.textOnPrimary,
  },
  filterBtnClearText: {
    color: colors.textSecondary,
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
    backgroundColor: colors.tintSuccess,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.success,
  },
  timeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  timeBox: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  timeLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  timeValue: {
    ...typography.h3,
    color: colors.text,
    marginTop: 2,
  },
  deptText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.md,
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
  });
}
