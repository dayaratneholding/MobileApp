import { getHcmJson, postHcmJson, putHcmJson } from '../client/hcmClient';
import type {
  CreateEmployeeLoanDto,
  EmployeeLoanListItem,
  EmployeeLoanListPage,
  EmployeeLoanQuery,
  GetEmployeeLoanBalanceDto,
  GetEmployeeLoanDto,
  UpdateEmployeeLoanDto,
} from '../../types/employeeLoan';
import {
  EmployeeLoanType,
  isSalaryAdvanceRecord,
  normalizeEmployeeLoanListItem,
} from '../../types/employeeLoan';

function throwIfFailed(record: Record<string, unknown>, fallback: string): void {
  if (record.succeeded === false) {
    throw new Error((record.messages as string[] | undefined)?.[0] ?? fallback);
  }
}

function normalizeItems(items: unknown[]): EmployeeLoanListItem[] {
  return items
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map(normalizeEmployeeLoanListItem)
    .filter((item) => item.employeeLoanSerialID > 0)
    .filter(isSalaryAdvanceRecord);
}

function parseEmployeeLoanPage(result: unknown): EmployeeLoanListPage {
  if (!result || typeof result !== 'object') {
    throw new Error('Failed to load salary advance records.');
  }

  const record = result as Record<string, unknown>;
  throwIfFailed(record, 'Failed to load salary advance records.');

  if (Array.isArray(record.data)) {
    const items = normalizeItems(record.data);
    return {
      items,
      currentPage: Number(record.currentPage) || 1,
      totalPages: Number(record.totalPages) || 1,
      totalCount: Number(record.totalCount) ?? items.length,
      hasNextPage: Boolean(record.hasNextPage),
    };
  }

  const page = record.data;
  if (page && typeof page === 'object') {
    const pageRecord = page as Record<string, unknown>;
    throwIfFailed(pageRecord, 'Failed to load salary advance records.');

    const rawItems = Array.isArray(pageRecord.data) ? pageRecord.data : [];
    const items = normalizeItems(rawItems);

    return {
      items,
      currentPage: Number(pageRecord.currentPage) || 1,
      totalPages: Number(pageRecord.totalPages) || 1,
      totalCount: Number(pageRecord.totalCount) ?? items.length,
      hasNextPage: Boolean(pageRecord.hasNextPage),
    };
  }

  return {
    items: [],
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasNextPage: false,
  };
}

function parseMutationResponse(result: unknown, action: string): GetEmployeeLoanDto | null {
  if (typeof result === 'number') {
    return { employeeLoanSerialID: result, loanType: EmployeeLoanType.SalaryAdvance };
  }

  if (!result || typeof result !== 'object') {
    throw new Error(`Failed to ${action} salary advance.`);
  }

  const record = result as Record<string, unknown>;
  throwIfFailed(record, `Failed to ${action} salary advance.`);

  if (
    typeof record.employeeLoanSerialID === 'number' ||
    typeof record.id === 'number'
  ) {
    return normalizeEmployeeLoanListItem(record) as GetEmployeeLoanDto;
  }

  if (record.data != null) {
    if (typeof record.data === 'number') {
      return {
        employeeLoanSerialID: record.data,
        loanType: EmployeeLoanType.SalaryAdvance,
      };
    }

    if (typeof record.data === 'object') {
      return normalizeEmployeeLoanListItem(
        record.data as Record<string, unknown>,
      ) as GetEmployeeLoanDto;
    }
  }

  if (record.succeeded === true || record.succeeded == null) {
    return null;
  }

  throw new Error(`Failed to ${action} salary advance.`);
}

function buildPagedQueryAttempts(query: EmployeeLoanQuery): EmployeeLoanQuery[] {
  const base = {
    PageNumber: query.PageNumber,
    PageSize: query.PageSize,
    SortColumn: query.SortColumn ?? 'startDate',
    SortDirection: query.SortDirection ?? 'desc',
    EESerialID: query.EESerialID,
    Filter: query.Filter,
  };

  const attempts: EmployeeLoanQuery[] = [base];

  if (query.status !== undefined) {
    attempts.push({ ...base, status: query.status });
  } else {
    attempts.push({ ...base, status: true });
    attempts.push({ ...base, status: false });
  }

  return attempts;
}

async function fetchEmployeeLoanPage(
  query: EmployeeLoanQuery,
): Promise<EmployeeLoanListPage> {
  const result = await getHcmJson<unknown>('/EmployeeLoan/paged', query);
  return parseEmployeeLoanPage(result);
}

export async function getEmployeeLoanPaged(
  query: EmployeeLoanQuery,
): Promise<EmployeeLoanListPage> {
  if (__DEV__) {
    console.log('[EmployeeLoan] paged query:', query);
  }

  const attempts = buildPagedQueryAttempts(query);
  let lastResult: EmployeeLoanListPage = {
    items: [],
    currentPage: query.PageNumber ?? 1,
    totalPages: 1,
    totalCount: 0,
    hasNextPage: false,
  };

  for (const attemptQuery of attempts) {
    try {
      const page = await fetchEmployeeLoanPage(attemptQuery);
      lastResult = page;

      if (__DEV__) {
        console.log('[EmployeeLoan] paged attempt:', {
          query: attemptQuery,
          totalCount: page.totalCount,
          items: page.items.length,
        });
      }

      if (page.items.length > 0 || page.totalCount > 0) {
        return page;
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('[EmployeeLoan] paged attempt failed:', attemptQuery, error);
      }
    }
  }

  return lastResult;
}

export async function getEmployeeLoanById(id: number): Promise<GetEmployeeLoanDto> {
  if (__DEV__) {
    console.log('[EmployeeLoan] GET id:', id);
  }

  const result = await getHcmJson<unknown>(`/EmployeeLoan/${id}`);
  const parsed = parseMutationResponse(result, 'load');

  if (!parsed) {
    throw new Error('Salary advance record not found.');
  }

  return parsed;
}

export async function createEmployeeLoan(
  payload: CreateEmployeeLoanDto,
): Promise<GetEmployeeLoanDto | null> {
  if (__DEV__) {
    console.log('[EmployeeLoan] POST payload:', payload);
  }

  try {
    const result = await postHcmJson<unknown, CreateEmployeeLoanDto>(
      '/EmployeeLoan',
      payload,
    );
    const parsed = parseMutationResponse(result, 'create');

    if (__DEV__) {
      console.log('[EmployeeLoan] POST parsed:', parsed);
    }

    return parsed;
  } catch (error) {
    const startDate = payload.startDate;
    if (startDate && typeof startDate === 'object' && 'year' in startDate) {
      const { year, month, day } = startDate;
      const stringPayload = {
        ...payload,
        startDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      };

      if (__DEV__) {
        console.log('[EmployeeLoan] POST retry with string date:', stringPayload);
      }

      const result = await postHcmJson<unknown, CreateEmployeeLoanDto>(
        '/EmployeeLoan',
        stringPayload,
      );
      return parseMutationResponse(result, 'create');
    }

    throw error;
  }
}

export async function updateEmployeeLoan(
  payload: UpdateEmployeeLoanDto,
): Promise<GetEmployeeLoanDto | null> {
  if (__DEV__) {
    console.log('[EmployeeLoan] PUT payload:', payload);
  }

  try {
    const result = await putHcmJson<unknown, UpdateEmployeeLoanDto>(
      '/EmployeeLoan',
      payload,
    );
    return parseMutationResponse(result, 'update');
  } catch (error) {
    const startDate = payload.startDate;
    if (startDate && typeof startDate === 'object' && 'year' in startDate) {
      const { year, month, day } = startDate;
      const stringPayload = {
        ...payload,
        startDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      };

      if (__DEV__) {
        console.log('[EmployeeLoan] PUT retry with string date:', stringPayload);
      }

      const result = await putHcmJson<unknown, UpdateEmployeeLoanDto>(
        '/EmployeeLoan',
        stringPayload,
      );
      return parseMutationResponse(result, 'update');
    }

    throw error;
  }
}

export async function getEmployeeLoanBalance(
  employeeLoanSerialID: number,
): Promise<GetEmployeeLoanBalanceDto> {
  if (__DEV__) {
    console.log('[EmployeeLoan] balance id:', employeeLoanSerialID);
  }

  const result = await getHcmJson<
    GetEmployeeLoanBalanceDto | { succeeded?: boolean; data?: GetEmployeeLoanBalanceDto }
  >('/EmployeeLoan/balance', { employeeLoanSerialID });

  if (result && typeof result === 'object' && 'data' in result && result.data) {
    return result.data;
  }

  return result as GetEmployeeLoanBalanceDto;
}
