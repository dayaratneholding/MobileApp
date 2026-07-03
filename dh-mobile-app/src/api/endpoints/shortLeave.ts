import { getHcmJson, postHcmJson, putHcmJson } from '../client/hcmClient';
import type { Int32Result } from '../../types/leave';
import type {
  CreateShortLeaveCommand,
  GetShortLeaveEntryDto,
  GetShortLeaveEntryResult,
  MobileShortLeaveListPage,
  MobileShortLeavePaginatedResultResult,
  MobileShortLeaveQuery,
  UpdateShortLeaveCommand,
} from '../../types/shortLeave';

const SHORT_LEAVE_LIST_PATHS = [
  '/ShortLeave/paged/Mobile',
  '/ShortLeave/paged',
] as const;

function parseShortLeaveEntryResponse(
  result: GetShortLeaveEntryDto | GetShortLeaveEntryResult,
): GetShortLeaveEntryDto {
  if (
    'shortLeaveSerialID' in result &&
    typeof result.shortLeaveSerialID === 'number'
  ) {
    return result;
  }

  const wrapped = result as GetShortLeaveEntryResult;
  if (wrapped.succeeded === false) {
    throw new Error(wrapped.messages?.[0] ?? 'Failed to load short leave record.');
  }

  if (!wrapped.data) {
    throw new Error('Short leave record not found.');
  }

  return wrapped.data;
}

function parseShortLeavePage(
  result: MobileShortLeavePaginatedResultResult,
): MobileShortLeaveListPage {
  if (!result.succeeded) {
    throw new Error(result.messages?.[0] ?? 'Failed to load short leave records.');
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

function buildShortLeaveQueryAttempts(
  query: MobileShortLeaveQuery,
  comSerialID?: number,
): MobileShortLeaveQuery[] {
  const eeSerialID = query.EESerialID ?? query.EEserialID;
  const companyId = comSerialID ?? query.ComSerialID;
  const base = {
    PageNumber: query.PageNumber,
    PageSize: query.PageSize,
    SortColumn: query.SortColumn ?? 'date',
    SortDirection: query.SortDirection ?? 'desc',
    DateFrom: query.DateFrom,
  };

  const attempts: MobileShortLeaveQuery[] = [];

  if (eeSerialID != null) {
    attempts.push({
      ...base,
      EESerialID: eeSerialID,
      ComSerialID: companyId,
    });
    attempts.push({
      ...base,
      EEserialID: eeSerialID,
      ComSerialID: companyId,
    });
    attempts.push({
      ...base,
      EESerialID: eeSerialID,
      ComSerialID: companyId,
      status: query.status,
    });
    attempts.push({
      ...base,
      EESerialID: eeSerialID,
    });
    attempts.push({
      ...base,
      EESerialID: eeSerialID,
      status: query.status,
    });
  }

  if (companyId != null) {
    attempts.push({
      ...base,
      ComSerialID: companyId,
      status: query.status,
    });
  }

  return attempts;
}

async function fetchShortLeaveFromPath(
  path: string,
  query: MobileShortLeaveQuery,
): Promise<MobileShortLeaveListPage> {
  if (__DEV__) {
    console.log(`[ShortLeave] ${path} query:`, query);
  }

  const result = await getHcmJson<MobileShortLeavePaginatedResultResult>(
    path,
    query,
  );

  const page = parseShortLeavePage(result);

  if (__DEV__) {
    console.log(`[ShortLeave] ${path} result:`, {
      totalCount: page.totalCount,
      items: page.items.length,
    });
  }

  return page;
}

export async function getMobileShortLeaveEntries(
  query: MobileShortLeaveQuery,
  comSerialID?: number,
): Promise<MobileShortLeaveListPage> {
  const attempts = buildShortLeaveQueryAttempts(query, comSerialID);
  let lastResult: MobileShortLeaveListPage = {
    items: [],
    currentPage: query.PageNumber ?? 1,
    totalPages: 1,
    totalCount: 0,
    hasNextPage: false,
  };

  for (const path of SHORT_LEAVE_LIST_PATHS) {
    for (const attemptQuery of attempts) {
      try {
        const page = await fetchShortLeaveFromPath(path, attemptQuery);
        lastResult = page;

        if (page.totalCount > 0 || page.items.length > 0) {
          return page;
        }
      } catch (error) {
        if (__DEV__) {
          console.warn(`[ShortLeave] ${path} failed:`, error);
        }
      }
    }
  }

  return lastResult;
}

export async function getShortLeaveById(
  id: number,
  alternateId?: number,
): Promise<GetShortLeaveEntryDto> {
  const ids = Array.from(
    new Set([id, alternateId].filter((value): value is number => value != null)),
  );

  let lastError: unknown;

  for (const tryId of ids) {
    try {
      if (__DEV__) {
        console.log('[ShortLeave] ShortLeave GET id:', tryId);
      }

      const result = await getHcmJson<GetShortLeaveEntryDto | GetShortLeaveEntryResult>(
        `/ShortLeave/${tryId}`,
      );

      return parseShortLeaveEntryResponse(result);
    } catch (error) {
      lastError = error;
      if (__DEV__) {
        console.warn('[ShortLeave] GET failed for id', tryId, error);
      }
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error('Short leave record not found.');
}

export async function createShortLeave(
  payload: CreateShortLeaveCommand,
): Promise<number> {
  if (__DEV__) {
    console.log('[ShortLeave] ShortLeave/create payload:', payload);
  }

  const result = await postHcmJson<Int32Result, CreateShortLeaveCommand>(
    '/ShortLeave/create',
    payload,
  );

  if (!result.succeeded) {
    throw new Error(result.messages?.[0] ?? 'Failed to create short leave request.');
  }

  return result.data ?? 0;
}

export async function updateShortLeave(
  payload: UpdateShortLeaveCommand,
): Promise<void> {
  if (__DEV__) {
    console.log('[ShortLeave] ShortLeave/update payload:', payload);
  }

  const result = await putHcmJson<Int32Result, UpdateShortLeaveCommand>(
    '/ShortLeave/update',
    payload,
  );

  if (!result.succeeded) {
    throw new Error(result.messages?.[0] ?? 'Failed to update short leave request.');
  }
}
