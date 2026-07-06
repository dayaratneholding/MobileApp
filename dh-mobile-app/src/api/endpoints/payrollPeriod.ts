import { getHcmJson } from '../client/hcmClient';
import type { PayrollPeriodItem } from '../../types/payslip';

type PayrollPeriodPaginatedResult = {
  succeeded?: boolean;
  messages?: string[];
  data?: {
    data?: PayrollPeriodItem[];
    currentPage?: number;
    totalPages?: number;
    totalCount?: number;
    hasNextPage?: boolean;
  };
};

function normalizePayrollPeriod(item: Record<string, unknown>): PayrollPeriodItem | null {
  const payPeriod =
    typeof item.payPeriod === 'string' ? item.payPeriod.trim() : '';

  if (!payPeriod) {
    return null;
  }

  return {
    payPeriodSerialID:
      item.payPeriodSerialID != null
        ? Number(item.payPeriodSerialID)
        : item.id != null
          ? Number(item.id)
          : undefined,
    payPeriod,
    payScheme: item.payScheme != null ? Number(item.payScheme) : null,
    paySchemeName:
      typeof item.paySchemeName === 'string' ? item.paySchemeName : null,
    payrollStart:
      typeof item.payrollStart === 'string' ? item.payrollStart : null,
    payrollEnd: typeof item.payrollEnd === 'string' ? item.payrollEnd : null,
    status: typeof item.status === 'string' ? item.status : null,
  };
}

function parsePayrollPeriodPage(result: unknown): PayrollPeriodItem[] {
  if (!result || typeof result !== 'object') {
    return [];
  }

  const record = result as Record<string, unknown>;

  if (record.succeeded === false) {
    throw new Error(
      (record.messages as string[] | undefined)?.[0] ??
        'Failed to load payroll periods.',
    );
  }

  let rawItems: unknown[] = [];

  if (Array.isArray(record.data)) {
    rawItems = record.data;
  } else if (record.data && typeof record.data === 'object') {
    const page = record.data as Record<string, unknown>;
    if (Array.isArray(page.data)) {
      rawItems = page.data;
    }
  }

  return rawItems
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map(normalizePayrollPeriod)
    .filter((item): item is PayrollPeriodItem => item != null);
}

function sortPayrollPeriods(items: PayrollPeriodItem[]): PayrollPeriodItem[] {
  return [...items].sort((a, b) => {
    const aTime = a.payrollStart ? new Date(a.payrollStart).getTime() : 0;
    const bTime = b.payrollStart ? new Date(b.payrollStart).getTime() : 0;
    if (aTime !== bTime) {
      return bTime - aTime;
    }

    return b.payPeriod.localeCompare(a.payPeriod);
  });
}

function filterByScheme(
  items: PayrollPeriodItem[],
  payScheme?: number | null,
): PayrollPeriodItem[] {
  if (payScheme == null) {
    return items;
  }

  const filtered = items.filter((item) => Number(item.payScheme) === payScheme);
  return filtered.length > 0 ? filtered : items;
}

export async function getPayrollPeriods(
  comSerialID: number,
  payScheme?: number | null,
): Promise<PayrollPeriodItem[]> {
  if (__DEV__) {
    console.log('[PayrollPeriod] paged query:', { comSerialID, payScheme });
  }

  const attempts = [
    {
      ComSerialID: comSerialID,
      PageNumber: 1,
      PageSize: 100,
      SortColumn: 'payPeriod',
      SortDirection: 'desc',
    },
    {
      ComSerialID: comSerialID,
      PageNumber: 1,
      PageSize: 100,
      status: true,
    },
  ];

  let lastItems: PayrollPeriodItem[] = [];

  for (const query of attempts) {
    try {
      const result = await getHcmJson<PayrollPeriodPaginatedResult>(
        '/PayrollPeriod/paged',
        query,
      );
      const items = filterByScheme(parsePayrollPeriodPage(result), payScheme);
      lastItems = sortPayrollPeriods(items);

      if (__DEV__) {
        console.log('[PayrollPeriod] attempt result:', {
          query,
          count: lastItems.length,
        });
      }

      if (lastItems.length > 0) {
        return lastItems;
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('[PayrollPeriod] attempt failed:', query, error);
      }
    }
  }

  return lastItems;
}

export async function getEmployeePayrollPeriods(
  eeSerialID: number,
): Promise<PayrollPeriodItem[]> {
  if (__DEV__) {
    console.log('[PayrollPeriod] EmployeeWise:', eeSerialID);
  }

  try {
    const result = await getHcmJson<unknown>(
      `/PayrollPeriod/EmployeeWise/${eeSerialID}`,
    );

    if (Array.isArray(result)) {
      return sortPayrollPeriods(
        result
          .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
          .map(normalizePayrollPeriod)
          .filter((item): item is PayrollPeriodItem => item != null),
      );
    }

    return sortPayrollPeriods(parsePayrollPeriodPage(result));
  } catch (error) {
    if (__DEV__) {
      console.warn('[PayrollPeriod] EmployeeWise failed:', error);
    }
    return [];
  }
}
