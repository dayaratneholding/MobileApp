import { getHcmJson, postHcmJson, putHcmJson } from '../client/hcmClient';
import type {
  CreateEmployeeLeaveCommand,
  GetCalendarLeaveCountRequest,
  GetLeaveCalculationRequest,
  GetLeaveEntryDto,
  GetLeaveEntryResult,
  GetShortLeaveCountRequest,
  Int32Result,
  LeaveBalanceItem,
  LeaveBalanceSummary,
  LeaveYearBalanceItem,
  YearLeaveAllocationSummary,
  LeaveCountResult,
  MobileLeaveListPage,
  MobileLeavePaginatedResultResult,
  MobileLeaveQuery,
  UpdateEmployeeLeaveEntryCommand,
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

function readObjectField(
  record: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const count = coerceCount(record[key]);
    if (count !== null) {
      return count;
    }
  }

  return null;
}

function parseEntitlementBalance(
  result: unknown,
  entitlementKeys: string[],
  takenKeys: string[],
): LeaveBalanceItem | null {
  if (!result || typeof result !== 'object') {
    return null;
  }

  const record = result as Record<string, unknown>;
  const total = readObjectField(record, entitlementKeys);
  const taken = readObjectField(record, takenKeys);

  if (total === null || taken === null) {
    return null;
  }

  return {
    taken,
    remaining: Math.max(0, total - taken),
    total,
  };
}

function parseAnnualLeaveResponse(result: unknown): LeaveBalanceItem | null {
  return parseEntitlementBalance(result, ['annualLeaveEntitlement'], ['annualLeaveTaken']);
}

function parseCasualLeaveResponse(result: unknown): LeaveBalanceItem | null {
  return parseEntitlementBalance(
    result,
    ['casssualLEave', 'casualLeave', 'casualLEave'],
    ['cassualLeavetaken', 'casualLeaveTaken', 'casualLeavetaken'],
  );
}

function parseShortLeaveResponse(result: unknown): number | null {
  if (!result || typeof result !== 'object') {
    return coerceCount(result);
  }

  const record = result as Record<string, unknown>;
  return readObjectField(record, ['shortleavecount', 'shortLeaveCount', 'count']);
}

async function postLeaveAllocationAnnual(
  body: GetLeaveCalculationRequest,
): Promise<LeaveBalanceItem | null> {
  try {
    if (__DEV__) {
      console.log('[Leave] /LeaveAllocation/AnnualLeave request:', body);
    }

    const result = await postHcmJson<unknown, GetLeaveCalculationRequest>(
      '/LeaveAllocation/AnnualLeave',
      body,
    );

    if (__DEV__) {
      console.log('[Leave] /LeaveAllocation/AnnualLeave response:', result);
    }

    return parseAnnualLeaveResponse(result);
  } catch (error) {
    if (__DEV__) {
      console.warn('[Leave] /LeaveAllocation/AnnualLeave failed:', error);
    }
    return null;
  }
}

async function postLeaveAllocationCasual(
  body: GetLeaveCalculationRequest,
): Promise<LeaveBalanceItem | null> {
  try {
    if (__DEV__) {
      console.log('[Leave] /LeaveAllocation/Casual request:', body);
    }

    const result = await postHcmJson<unknown, GetLeaveCalculationRequest>(
      '/LeaveAllocation/Casual',
      body,
    );

    if (__DEV__) {
      console.log('[Leave] /LeaveAllocation/Casual response:', result);
    }

    return parseCasualLeaveResponse(result);
  } catch (error) {
    if (__DEV__) {
      console.warn('[Leave] /LeaveAllocation/Casual failed:', error);
    }
    return null;
  }
}

async function postLeaveAllocationShortLeave(
  body: GetShortLeaveCountRequest,
): Promise<number | null> {
  try {
    if (__DEV__) {
      console.log('[Leave] /LeaveAllocation/ShortLeave request:', body);
    }

    const result = await postHcmJson<unknown, GetShortLeaveCountRequest>(
      '/LeaveAllocation/ShortLeave',
      body,
    );

    if (__DEV__) {
      console.log('[Leave] /LeaveAllocation/ShortLeave response:', result);
    }

    return parseShortLeaveResponse(result);
  } catch (error) {
    if (__DEV__) {
      console.warn('[Leave] /LeaveAllocation/ShortLeave failed:', error);
    }
    return null;
  }
}

function parseYearLeaveBalance(
  result: unknown,
  entitlementKeys: string[],
  takenKeys: string[],
): LeaveYearBalanceItem | null {
  if (!result || typeof result !== 'object') {
    return null;
  }

  const record = result as Record<string, unknown>;
  let taken = readObjectField(record, takenKeys);
  let entitlement = readObjectField(record, entitlementKeys);

  if (taken === null || entitlement === null) {
    for (const [key, value] of Object.entries(record)) {
      const count = coerceCount(value);
      if (count === null) {
        continue;
      }

      const lowerKey = key.toLowerCase();
      if (taken === null && lowerKey.includes('taken')) {
        taken = count;
      }
      if (
        entitlement === null &&
        (lowerKey.includes('entitlement') ||
          lowerKey.includes('leave') ||
          lowerKey.includes('allowed')) &&
        !lowerKey.includes('taken')
      ) {
        entitlement = count;
      }
    }
  }

  if (taken === null && entitlement === null) {
    return null;
  }

  return { taken, entitlement };
}

async function postLeaveAllocationYearBalance(
  path: string,
  body: GetLeaveCalculationRequest,
  entitlementKeys: string[],
  takenKeys: string[],
): Promise<LeaveYearBalanceItem | null> {
  try {
    if (__DEV__) {
      console.log(`[Leave] ${path} request:`, body);
    }

    const result = await postHcmJson<unknown, GetLeaveCalculationRequest>(
      path,
      body,
    );

    if (__DEV__) {
      console.log(`[Leave] ${path} response:`, result);
    }

    return parseYearLeaveBalance(result, entitlementKeys, takenKeys);
  } catch (error) {
    if (__DEV__) {
      console.warn(`[Leave] ${path} failed:`, error);
    }
    return null;
  }
}

export async function fetchYearLeaveAllocationBalances(
  eeSerialID: number,
  comSerialID: number,
): Promise<YearLeaveAllocationSummary> {
  const body: GetLeaveCalculationRequest = { eeSerialID, comSerialID };
  const year = new Date().getFullYear();

  const [
    annual,
    casual,
    medical,
    noPayAuthorized,
    noPayUnauthorized,
  ] = await Promise.all([
    postLeaveAllocationYearBalance(
      '/LeaveAllocation/AnnualLeave',
      body,
      ['annualLeaveEntitlement', 'annual'],
      ['annualLeaveTaken'],
    ),
    postLeaveAllocationYearBalance(
      '/LeaveAllocation/Casual',
      body,
      ['casssualLEave', 'casualLeave', 'casualLEave', 'casual'],
      ['cassualLeavetaken', 'casualLeaveTaken', 'casualLeavetaken'],
    ),
    postLeaveAllocationYearBalance(
      '/LeaveAllocation/MedicalLeave',
      body,
      ['medicalLeaveEntitlement', 'medicalLeave', 'medical'],
      ['medicalLeaveTaken', 'medicalLeavetaken'],
    ),
    postLeaveAllocationYearBalance(
      '/LeaveAllocation/NoPayAuthorized',
      body,
      ['noPayAuthorizedEntitlement', 'noPayAuthorizedLeave', 'noPayAuthorized'],
      ['noPayAuthorizedTaken', 'noPayAuthorizedLeavetaken'],
    ),
    postLeaveAllocationYearBalance(
      '/LeaveAllocation/NoPayUnauthorized',
      body,
      [
        'noPayUnauthorizedEntitlement',
        'noPayUnauthorizedLeave',
        'noPayUnauthorized',
      ],
      ['noPayUnauthorizedTaken', 'noPayUnauthorizedLeavetaken'],
    ),
  ]);

  const summary: YearLeaveAllocationSummary = {
    year,
    annual,
    casual,
    medical,
    noPayAuthorized,
    noPayUnauthorized,
  };

  if (
    annual === null &&
    casual === null &&
    medical === null &&
    noPayAuthorized === null &&
    noPayUnauthorized === null
  ) {
    throw new Error('Could not load leave allocation balances for this year.');
  }

  if (__DEV__) {
    console.log('[Leave] Year allocation summary:', summary);
  }

  return summary;
}

export async function fetchLeaveBalances(
  eeSerialID: number,
  comSerialID: number,
): Promise<LeaveBalanceSummary> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const employeeBody: GetLeaveCalculationRequest = { eeSerialID, comSerialID };
  const shortLeaveBody: GetShortLeaveCountRequest = {
    eeSerialID,
    year,
    month,
    ComSerialID: comSerialID,
  };

  const [annual, casual, shortLeaveThisMonth] = await Promise.all([
    postLeaveAllocationAnnual(employeeBody),
    postLeaveAllocationCasual(employeeBody),
    postLeaveAllocationShortLeave(shortLeaveBody),
  ]);

  const summary: LeaveBalanceSummary = {
    annual,
    casual,
    shortLeaveThisMonth,
  };

  if (annual === null && casual === null && shortLeaveThisMonth === null) {
    throw new Error('Could not load leave balances from server.');
  }

  if (__DEV__) {
    console.log('[Leave] Balance summary:', summary);
  }

  return summary;
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

function parseLeaveEntryResponse(
  result: GetLeaveEntryDto | GetLeaveEntryResult,
): GetLeaveEntryDto {
  if ('empLeaveSerialID' in result && typeof result.empLeaveSerialID === 'number') {
    return result;
  }

  const wrapped = result as GetLeaveEntryResult;
  if (wrapped.succeeded === false) {
    throw new Error(wrapped.messages?.[0] ?? 'Failed to load leave record.');
  }

  if (!wrapped.data) {
    throw new Error('Leave record not found.');
  }

  return wrapped.data;
}

export async function getLeaveEntitlementById(
  id: number,
): Promise<GetLeaveEntryDto> {
  if (__DEV__) {
    console.log('[Leave] LeaveEntitlements GET id:', id);
  }

  const result = await getHcmJson<GetLeaveEntryDto | GetLeaveEntryResult>(
    `/LeaveEntitlements/${id}`,
  );

  return parseLeaveEntryResponse(result);
}

export async function updateLeaveEntitlement(
  payload: UpdateEmployeeLeaveEntryCommand,
): Promise<void> {
  if (__DEV__) {
    console.log('[Leave] LeaveEntitlements/update payload:', payload);
  }

  const result = await putHcmJson<Int32Result, UpdateEmployeeLeaveEntryCommand>(
    '/LeaveEntitlements/update',
    payload,
  );

  if (!result.succeeded) {
    throw new Error(result.messages?.[0] ?? 'Failed to update leave request.');
  }
}
