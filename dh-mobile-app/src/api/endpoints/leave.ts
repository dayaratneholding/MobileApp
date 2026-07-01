import { getHcmJson, postHcmJson } from '../client/hcmClient';
import type {
  CreateEmployeeLeaveCommand,
  GetCalendarLeaveCountRequest,
  Int32Result,
  LeaveCountResult,
  MobileLeaveListPage,
  MobileLeavePaginatedResultResult,
  MobileLeaveQuery,
} from '../../types/leave';

type CalendarLeaveCountApiBody = GetCalendarLeaveCountRequest;

function buildCalendarLeaveCountBody(
  payload: GetCalendarLeaveCountRequest,
): CalendarLeaveCountApiBody {
  return {
    fromDate: payload.fromDate,
    toDate: payload.toDate,
    eeSerialID: payload.eeSerialID,
    isHalfDay: payload.isHalfDay,
  };
}

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

function parseLeaveCountResponse(result: unknown): number {
  const direct = coerceCount(result);
  if (direct !== null) {
    return direct;
  }

  if (!result || typeof result !== 'object') {
    const snapshot = String(result);
    console.error('[Leave] CalenderLeaveCount empty/invalid response:', snapshot);
    throw new Error(
      __DEV__
        ? `Leave count not in response: ${snapshot}`
        : 'Leave count not returned from server.',
    );
  }

  const wrapped = result as LeaveCountResult & Record<string, unknown>;

  if (wrapped.succeeded === false) {
    throw new Error(wrapped.messages?.[0] ?? 'Failed to calculate leave count.');
  }

  const candidateKeys = [
    'totalLeaveCount',
    'data',
    'leaveCount',
    'result',
    'value',
    'count',
    'calenderLeaveCount',
    'calendarLeaveCount',
  ];

  for (const key of candidateKeys) {
    const value = wrapped[key];
    const count = coerceCount(value);
    if (count !== null) {
      return count;
    }

    if (value && typeof value === 'object') {
      const nested = value as Record<string, unknown>;
      for (const nestedKey of candidateKeys) {
        const nestedCount = coerceCount(nested[nestedKey]);
        if (nestedCount !== null) {
          return nestedCount;
        }
      }
    }
  }

  const snapshot = JSON.stringify(result);
  console.error('[Leave] Unparsed CalenderLeaveCount response:', snapshot);

  throw new Error(
    __DEV__
      ? `Leave count not in response: ${snapshot.slice(0, 220)}`
      : 'Leave count not returned from server.',
  );
}

export async function getCalendarLeaveCount(
  payload: GetCalendarLeaveCountRequest,
): Promise<number> {
  const apiBody = buildCalendarLeaveCountBody(payload);

  if (__DEV__) {
    console.log('[Leave] CalenderLeaveCount request:', apiBody);
  }

  const result = await postHcmJson<
    LeaveCountResult | number | string,
    CalendarLeaveCountApiBody
  >('/LeaveAllocation/CalenderLeaveCount', apiBody);

  if (__DEV__) {
    console.log('[Leave] CalenderLeaveCount parsed response:', result);
  }

  return parseLeaveCountResponse(result);
}

export async function createLeaveEntitlement(
  payload: CreateEmployeeLeaveCommand,
): Promise<number> {
  const result = await postHcmJson<Int32Result, CreateEmployeeLeaveCommand>(
    '/LeaveEntitlements/create',
    payload,
  );

  if (!result.succeeded) {
    throw new Error(result.messages?.[0] ?? 'Failed to create leave request.');
  }

  return result.data ?? 0;
}

export async function getMobileLeaveEntries(
  query: MobileLeaveQuery,
): Promise<MobileLeaveListPage> {
  if (__DEV__) {
    console.log('[Leave] LeaveEntitlements/paged/Mobile query:', query);
  }

  const result = await getHcmJson<MobileLeavePaginatedResultResult>(
    '/LeaveEntitlements/paged/Mobile',
    query,
  );

  if (!result.succeeded) {
    throw new Error(result.messages?.[0] ?? 'Failed to load leave records.');
  }

  const page = result.data;

  return {
    items: page?.data ?? [],
    currentPage: page?.currentPage ?? 1,
    totalPages: page?.totalPages ?? 1,
    totalCount: page?.totalCount ?? 0,
    hasNextPage: page?.hasNextPage ?? false,
  };
}
