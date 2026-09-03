import { getMobileAppJson } from '../client/mobileAppClient';
import { getHcmJson } from '../client/hcmClient';
import type {
  AttendanceListItem,
  AttendanceListPage,
  AttendancePagedQuery,
  AttendanceSummary,
} from '../../types/attendance';
import { toDateKey } from '../../utils/leaveDates';

function coerceCount(value: unknown): number | null {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
}

/** Converts API late values (minutes, TimeSpan strings, or ticks) into whole minutes. */
function coerceMinutes(value: unknown): number | null {
  if (value == null) {
    return null;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const hours = coerceCount(record.hours ?? record.Hours) ?? 0;
    const minutes = coerceCount(record.minutes ?? record.Minutes) ?? 0;
    const seconds = coerceCount(record.seconds ?? record.Seconds) ?? 0;
    if (hours === 0 && minutes === 0 && seconds === 0) {
      return 0;
    }
    return Math.round(hours * 60 + minutes + seconds / 60);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const timeMatch = trimmed.match(/^(-)?(\d+):(\d{1,2})(?::(\d{1,2})(?:\.\d+)?)?$/);
    if (timeMatch) {
      const sign = timeMatch[1] ? -1 : 1;
      const hours = Number(timeMatch[2]);
      const minutes = Number(timeMatch[3]);
      const seconds = Number(timeMatch[4] ?? 0);
      return sign * Math.round(hours * 60 + minutes + seconds / 60);
    }
  }

  const numeric = coerceCount(value);
  if (numeric === null) {
    return null;
  }

  // .NET TimeSpan ticks (1 minute = 600_000_000 ticks)
  if (Math.abs(numeric) >= 600_000_000) {
    return Math.round(numeric / 600_000_000);
  }

  return Math.round(numeric);
}

function readField(
  record: Record<string, unknown>,
  keys: string[],
  coerce: (value: unknown) => number | null = coerceCount,
): number | null {
  const entries = Object.entries(record);

  for (const key of keys) {
    const exact = coerce(record[key]);
    if (exact !== null) {
      return exact;
    }

    const lowerKey = key.toLowerCase();
    const match = entries.find(([entryKey]) => entryKey.toLowerCase() === lowerKey);
    if (match) {
      const count = coerce(match[1]);
      if (count !== null) {
        return count;
      }
    }
  }

  return null;
}

function parseAttendanceSummaryResponse(result: unknown): AttendanceSummary {
  let record: Record<string, unknown> | null = null;

  if (result && typeof result === 'object') {
    const wrapped = result as Record<string, unknown>;

    if (wrapped.succeeded === false) {
      const messages = wrapped.messages as string[] | undefined;
      throw new Error(messages?.[0] ?? 'Failed to load attendance summary.');
    }

    if (wrapped.data && typeof wrapped.data === 'object') {
      record = wrapped.data as Record<string, unknown>;
    } else {
      record = wrapped;
    }
  }

  if (!record) {
    throw new Error('Attendance summary not returned from server.');
  }

  const attendanceCount = readField(record, [
    'attendanceCount',
    'attendance',
    'presentCount',
    'present',
    'attendanceDays',
    'totalAttendance',
  ]);

  // Prefer totalLateMinutes — the MobileApp API field. Some payloads also include
  // lateMinutes/lateMinute as 0 or a daily value, which previously hid the real total.
  const lateMinutes = readField(
    record,
    [
      'totalLateMinutes',
      'totalLateMinute',
      'lateMinutesTotal',
      'lateMinTotal',
      'lateMinutes',
      'lateMinute',
      'lateminutes',
      'lateMin',
    ],
    coerceMinutes,
  );

  const overtimeCount = readField(record, [
    'overtimeCount',
    'overTimeCount',
    'overtime',
    'otCount',
    'totalOvertime',
    'overTime',
  ]);

  if (attendanceCount === null && lateMinutes === null && overtimeCount === null) {
    if (__DEV__) {
      console.warn('[Attendance] Unparsed attendance summary:', record);
    }

    throw new Error('Attendance summary fields not found in response.');
  }

  return {
    attendanceCount,
    lateMinutes,
    overtimeCount,
  };
}

export async function getAttendanceSummary(
  eeSerialID: number,
): Promise<AttendanceSummary> {
  if (__DEV__) {
    console.log('[Attendance] attendance-summary request:', { eeSerialID });
  }

  const result = await getMobileAppJson<unknown>(
    `/attendance-summary/${eeSerialID}`,
  );

  const summary = parseAttendanceSummaryResponse(result);

  if (__DEV__) {
    console.log('[Attendance] attendance-summary parsed:', summary);
  }

  return summary;
}

function normalizeAttendanceItem(item: Record<string, unknown>): AttendanceListItem {
  return {
    id: coerceCount(item.id) ?? undefined,
    attendanceSerialID: coerceCount(item.attendanceSerialID) ?? undefined,
    eeSerialID: coerceCount(item.eeSerialID ?? item.eESerialID) ?? undefined,
    eeid: coerceCount(item.eeid ?? item.EEID) ?? undefined,
    callName: typeof item.callName === 'string' ? item.callName : null,
    fullName: typeof item.fullName === 'string' ? item.fullName : null,
    nameWithInitials:
      typeof item.nameWithInitials === 'string' ? item.nameWithInitials : null,
    nic: typeof item.nic === 'string' ? item.nic : null,
    shiftSerialID: coerceCount(item.shiftSerialID),
    shiftName: typeof item.shiftName === 'string' ? item.shiftName : null,
    timeIn: (item.timeIn as AttendanceListItem['timeIn']) ?? null,
    timeOut: (item.timeOut as AttendanceListItem['timeOut']) ?? null,
    dateIn: toDateKey(item.dateIn),
    dateOut: toDateKey(item.dateOut),
    deptName: typeof item.deptName === 'string' ? item.deptName : null,
    sectName: typeof item.sectName === 'string' ? item.sectName : null,
    active: typeof item.active === 'boolean' ? item.active : undefined,
    attendanceStatus:
      typeof item.attendanceStatus === 'string' ? item.attendanceStatus : null,
    createdDate: typeof item.createdDate === 'string' ? item.createdDate : null,
  };
}

function parseAttendancePage(result: unknown): AttendanceListPage {
  if (!result || typeof result !== 'object') {
    throw new Error('Failed to load attendance records.');
  }

  const record = result as Record<string, unknown>;

  if (record.succeeded === false) {
    throw new Error(
      (record.messages as string[] | undefined)?.[0] ??
        'Failed to load attendance records.',
    );
  }

  let page = record;
  if (record.data && typeof record.data === 'object' && !Array.isArray(record.data)) {
    page = record.data as Record<string, unknown>;
  }

  const rawItems = Array.isArray(page.data)
    ? page.data
    : Array.isArray(record.data)
      ? record.data
      : [];

  const items = rawItems
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map(normalizeAttendanceItem);

  return {
    items,
    currentPage: Number(page.currentPage) || 1,
    totalPages: Number(page.totalPages) || 1,
    totalCount: Number(page.totalCount) || items.length,
    hasNextPage: Boolean(page.hasNextPage),
  };
}

function matchesEmployee(
  item: AttendanceListItem,
  eeid?: number,
  eeSerialID?: number,
): boolean {
  if (eeid != null && item.eeid != null) {
    return Number(item.eeid) === Number(eeid);
  }

  if (eeSerialID != null && item.eeSerialID != null) {
    return Number(item.eeSerialID) === Number(eeSerialID);
  }

  return true;
}

export async function getAttendancePaged(
  query: AttendancePagedQuery & { eeid?: number; eeSerialID?: number },
): Promise<AttendanceListPage> {
  const attempts: AttendancePagedQuery[] = [
    {
      ComSerialID: query.ComSerialID,
      PageNumber: query.PageNumber ?? 1,
      PageSize: query.PageSize ?? 20,
      SortColumn: query.SortColumn ?? 'dateIn',
      SortDirection: query.SortDirection ?? 'desc',
      Filter: query.Filter ?? (query.eeid != null ? String(query.eeid) : undefined),
      EESerialID: query.EESerialID ?? query.eeSerialID,
      EEID: query.EEID ?? query.eeid,
      status: query.status,
    },
    {
      ComSerialID: query.ComSerialID,
      PageNumber: query.PageNumber ?? 1,
      PageSize: query.PageSize ?? 50,
      SortColumn: 'dateIn',
      SortDirection: 'desc',
      Filter: query.eeid != null ? String(query.eeid) : undefined,
    },
    {
      ComSerialID: query.ComSerialID,
      PageNumber: query.PageNumber ?? 1,
      PageSize: query.PageSize ?? 50,
      SortColumn: 'dateIn',
      SortDirection: 'desc',
    },
  ];

  let lastPage: AttendanceListPage = {
    items: [],
    currentPage: query.PageNumber ?? 1,
    totalPages: 1,
    totalCount: 0,
    hasNextPage: false,
  };

  for (const attempt of attempts) {
    try {
      if (__DEV__) {
        console.log('[Attendance] paged query:', attempt);
      }

      const result = await getHcmJson<unknown>('/Attendance/paged', attempt);
      const page = parseAttendancePage(result);

      const filtered = page.items.filter((item) =>
        matchesEmployee(item, query.eeid, query.eeSerialID),
      );

      if (__DEV__) {
        console.log('[Attendance] paged result:', {
          totalCount: page.totalCount,
          items: page.items.length,
          filtered: filtered.length,
        });
      }

      lastPage = {
        ...page,
        items: filtered,
        totalCount: filtered.length > 0 ? filtered.length : page.totalCount,
      };

      if (filtered.length > 0 || page.totalCount === 0) {
        return lastPage;
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('[Attendance] paged attempt failed:', attempt, error);
      }
    }
  }

  return lastPage;
}
