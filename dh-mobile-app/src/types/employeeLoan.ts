export enum EmployeeLoanType {
  EmployeeLoan = 0,
  SalaryAdvance = 1,
}

export type ApiDateOnly = string | { year: number; month: number; day: number };

export type GetEmployeeLoanDto = {
  employeeLoanSerialID: number;
  eeSerialID?: number;
  comSerialID?: number;
  loanType?: number;
  loanDescription?: string | null;
  loanAmount?: number;
  installmentAmount?: number | null;
  installments?: number | null;
  startDate?: ApiDateOnly | null;
  notes?: string | null;
};

export type GetEmployeeLoanResult = {
  succeeded?: boolean;
  messages?: string[];
  data?: GetEmployeeLoanDto;
};

export type EmployeeLoanListItem = {
  id?: number;
  employeeLoanSerialID: number;
  loanType?: number | null;
  loanDescription?: string | null;
  startDate?: string | null;
  loanAmount?: number | null;
  installments?: number | null;
  installmentAmount?: number | null;
  eeSerialID?: number;
  comSerialID?: number;
  companyName?: string | null;
  eeid?: number;
  active?: boolean;
  createdBy?: number;
  createdDate?: string;
  modifiedBy?: number | null;
  modifiedDate?: string | null;
  isDeleted?: boolean;
  balanceAmount?: number | null;
  alreadydoneInstallments?: number | null;
  remainingAmount?: number | null;
  balanceInstallments?: number | null;
  totalInstallmentAmount?: number | null;
};

export type EmployeeLoanPaginatedResult = {
  messages?: string[] | null;
  succeeded?: boolean;
  data?: EmployeeLoanListItem[] | null;
  currentPage?: number;
  totalPages?: number;
  totalCount?: number;
  pageSize?: number;
  hasNextPage?: boolean;
};

export type EmployeeLoanPaginatedResultResult = {
  succeeded?: boolean;
  messages?: string[];
  data?: EmployeeLoanPaginatedResult;
};

export type EmployeeLoanListPage = {
  items: EmployeeLoanListItem[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
};

export type EmployeeLoanQuery = {
  EESerialID?: number;
  PageNumber?: number;
  PageSize?: number;
  SortColumn?: string;
  SortDirection?: string;
  status?: boolean;
  Filter?: string;
};

export type CreateEmployeeLoanDto = {
  eeSerialID: number;
  comSerialID: number;
  loanType: EmployeeLoanType;
  loanDescription?: string | null;
  loanAmount: number;
  installmentAmount?: number | null;
  installments?: number | null;
  startDate: ApiDateOnly;
  notes?: string | null;
};

export type UpdateEmployeeLoanDto = CreateEmployeeLoanDto & {
  employeeLoanSerialID: number;
};

export type GetEmployeeLoanBalanceDto = {
  balanceInstallments?: number | null;
  balanceAmount?: number | null;
  lastpayroll?: string | null;
};

export function getLoanTypeLabel(loanType?: number | null): string {
  if (loanType === EmployeeLoanType.SalaryAdvance) {
    return 'Salary Advance';
  }

  if (loanType === EmployeeLoanType.EmployeeLoan) {
    return 'Employee Loan';
  }

  return 'Loan';
}

export function formatCurrency(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function buildEmployeeLoanFromListItem(
  item: EmployeeLoanListItem,
): GetEmployeeLoanDto {
  return {
    employeeLoanSerialID: item.employeeLoanSerialID,
    eeSerialID: item.eeSerialID,
    comSerialID: item.comSerialID,
    loanType: item.loanType ?? EmployeeLoanType.SalaryAdvance,
    loanDescription: item.loanDescription,
    loanAmount: item.loanAmount ?? 0,
    installmentAmount: item.installmentAmount,
    installments: item.installments,
    startDate: item.startDate,
    notes: null,
  };
}

export function isSalaryAdvanceRecord(item: {
  loanType?: number | null;
  loanDescription?: string | null;
}): boolean {
  if (item.loanType == null) {
    return true;
  }

  const loanType = Number(item.loanType);
  if (loanType === EmployeeLoanType.EmployeeLoan) {
    return false;
  }

  return loanType === EmployeeLoanType.SalaryAdvance;
}

export function normalizeEmployeeLoanListItem(
  item: Record<string, unknown>,
): EmployeeLoanListItem {
  return {
    id: coerceInt(item.id ?? item.employeeLoanSerialID) ?? undefined,
    employeeLoanSerialID: coerceInt(item.employeeLoanSerialID ?? item.id) ?? 0,
    loanType: coerceInt(item.loanType),
    loanDescription: typeof item.loanDescription === 'string' ? item.loanDescription : null,
    startDate: coerceDateString(item.startDate),
    loanAmount: coerceNumber(item.loanAmount),
    installments: coerceInt(item.installments),
    installmentAmount: coerceNumber(item.installmentAmount),
    eeSerialID: coerceInt(item.eeSerialID) ?? undefined,
    comSerialID: coerceInt(item.comSerialID) ?? undefined,
    companyName: typeof item.companyName === 'string' ? item.companyName : null,
    eeid: coerceInt(item.eeid) ?? undefined,
    active: typeof item.active === 'boolean' ? item.active : undefined,
    createdBy: coerceInt(item.createdBy) ?? undefined,
    createdDate: coerceDateString(item.createdDate) ?? undefined,
    modifiedBy: coerceInt(item.modifiedBy) ?? undefined,
    modifiedDate: coerceDateString(item.modifiedDate) ?? undefined,
    isDeleted: typeof item.isDeleted === 'boolean' ? item.isDeleted : undefined,
    balanceAmount: coerceNumber(item.balanceAmount),
    alreadydoneInstallments: coerceInt(item.alreadydoneInstallments),
    remainingAmount: coerceNumber(item.remainingAmount),
    balanceInstallments: coerceInt(item.balanceInstallments),
    totalInstallmentAmount: coerceInt(item.totalInstallmentAmount),
  };
}

function coerceInt(value: unknown): number | null {
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

function coerceNumber(value: unknown): number | null {
  return coerceInt(value);
}

function coerceDateString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const year = coerceInt(record.year);
    const month = coerceInt(record.month);
    const day = coerceInt(record.day);

    if (year != null && month != null && day != null) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
}
