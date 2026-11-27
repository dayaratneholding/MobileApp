import { getHcmJson, postHcmJson } from '../client/hcmClient';
import { ApiError } from '../client/client';

export type GatePassEmployeeDetail = {
  eGatePassSerialID: number;
  comSerialID: number;
  eeSerialID: number;
  fullName: string;
};

export type CreateGatePassBody = {
  eeSerialID: number;
  comSerialID: number;
  departureTime: string;
  returnTime: string;
  date: string;
  vehicleNumber: string;
  reason: string;
  remark: string;
  approvedBy: number;
  approvedDate: string | null;
  confirmedBy: number;
  confirmedDate: string | null;
  eGatePassStatus: number;
  planDepartureDate: string;
  planDepartureTime: string;
  returnstatus: number;
  employeeGatePassDetail: GatePassEmployeeDetail[];
  mnuSerialID: number;
};

export type CompanyVehicle = {
  comVehicleSerialID: number;
  vehicleNumber: string;
  vehicleDesc?: string;
  active?: boolean;
};

function readText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

/** HCM DateOnly. System.Text.Json accepts "yyyy-MM-dd", not a year/month/day object. */
export function dateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** HCM TimeSpan. System.Text.Json accepts "HH:mm:ss", not a ticks object. */
export function timeSpan(value: Date): string {
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  const seconds = String(value.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

export async function listCompanyVehicles(): Promise<CompanyVehicle[]> {
  const result = await getHcmJson<unknown>('/CompanyVehicle');
  const source = Array.isArray(result)
    ? result
    : result && typeof result === 'object' && Array.isArray((result as { data?: unknown }).data)
      ? (result as { data: unknown[] }).data
      : [];

  const vehicles: CompanyVehicle[] = [];
  for (const item of source) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const vehicleNumber = readText(record.vehicleNumber ?? record[' ']);
    if (!vehicleNumber || record.active === false) continue;
    const description = readText(record.vehicleDesc);
    vehicles.push({
      comVehicleSerialID: Number(record.comVehicleSerialID) || 0,
      vehicleNumber,
      vehicleDesc: description || undefined,
      active: true,
    });
  }
  return vehicles;
}

export type EmployeeGatePass = {
  id: number;
  eGatePassSerialID: number;
  eeSerialID: number;
  eeid: number;
  employeeLabel: string;
  date: string;
  planDepartureDate: string;
  planDepartureTime: string;
  departureTime: string;
  returnTime: string;
  vehicleNumber: string;
  reason: string;
  remark: string;
  status: number | null;
  statusName: string;
  approvedBy: string;
  confirmedBy: string;
};

export type EmployeeGatePassPage = {
  items: EmployeeGatePass[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
};

const GATE_PASS_STATUS_NAMES: Record<number, string> = {
  1: 'Pending',
  2: 'Approved',
  3: 'Confirmed',
  4: 'Departed',
  5: 'Returned',
  6: 'Duty Off',
  7: 'Rejected',
};

function readNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatGatePassTime(value: unknown): string {
  if (typeof value === 'string') {
    const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
    if (!match) return value.trim() || '—';
    const formatted = `${pad2(Number(match[1]))}:${match[2]}`;
    return formatted === '00:00' ? '—' : formatted;
  }

  if (!value || typeof value !== 'object') return '—';
  const record = value as Record<string, unknown>;

  if (record.hours != null || record.minutes != null) {
    const formatted = `${pad2(readNumber(record.hours))}:${pad2(readNumber(record.minutes))}`;
    return formatted === '00:00' ? '—' : formatted;
  }

  if (record.ticks != null) {
    const totalMinutes = Math.floor(readNumber(record.ticks) / 600_000_000);
    const formatted = `${pad2(Math.floor(totalMinutes / 60) % 24)}:${pad2(totalMinutes % 60)}`;
    return formatted === '00:00' ? '—' : formatted;
  }

  return '—';
}

export function formatGatePassDate(value: unknown): string {
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return value.trim() || '—';
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString();
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const year = readNumber(record.year);
    const month = readNumber(record.month);
    const day = readNumber(record.day);
    if (year > 1900 && month >= 1 && day >= 1) {
      return new Date(year, month - 1, day).toLocaleDateString();
    }
  }

  return '—';
}

function readDisplayText(value: unknown): string {
  const text = readText(value);
  return text || '—';
}

function parseEmployeeGatePass(item: unknown, index: number): EmployeeGatePass {
  const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
  const status = record.eGatePassStatus == null ? null : readNumber(record.eGatePassStatus);
  const statusName = readText(record.eGatePassStatusName);
  const serial = readNumber(record.eGatePassSerialID || record.id);

  return {
    id: readNumber(record.id) || serial || index + 1,
    eGatePassSerialID: serial,
    eeSerialID: readNumber(record.eeSerialID),
    eeid: readNumber(record.eeid),
    employeeLabel: readDisplayText(record.eeidwithname),
    date: formatGatePassDate(record.date),
    planDepartureDate: formatGatePassDate(record.planDepartureDate),
    planDepartureTime: formatGatePassTime(record.planDepartureTime),
    departureTime: formatGatePassTime(record.departureTime),
    returnTime: formatGatePassTime(record.returnTime),
    vehicleNumber: readDisplayText(record.vehicleNumber),
    reason: readDisplayText(record.reason),
    remark: readDisplayText(record.remark),
    status,
    statusName: statusName || (status != null ? GATE_PASS_STATUS_NAMES[status] : '') || 'Unknown',
    approvedBy: readDisplayText(record.approvedName ?? record.approvedBy),
    confirmedBy: readDisplayText(record.confirmName ?? record.confirmedBy),
  };
}

function failureMessage(record: Record<string, unknown>, fallback: string): string {
  const messages = record.messages;
  const first = Array.isArray(messages) ? messages.find((item) => typeof item === 'string') : '';
  return typeof first === 'string' && first ? first : fallback;
}

function parseEmployeeGatePassPage(result: unknown): EmployeeGatePassPage {
  if (Array.isArray(result)) {
    return {
      items: result.map(parseEmployeeGatePass),
      currentPage: 1,
      totalPages: 1,
      totalCount: result.length,
      hasNextPage: false,
    };
  }

  const root = result && typeof result === 'object' ? (result as Record<string, unknown>) : {};
  if (root.succeeded === false) {
    throw new ApiError(failureMessage(root, 'Could not load gate passes.'));
  }

  const nested =
    root.data && typeof root.data === 'object' && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : null;

  if (nested?.succeeded === false) {
    throw new ApiError(failureMessage(nested, 'Could not load gate passes.'));
  }

  const rows = Array.isArray(nested?.data)
    ? nested.data
    : Array.isArray(root.data)
      ? root.data
      : [];
  const page = nested ?? root;

  return {
    items: rows.map(parseEmployeeGatePass),
    currentPage: readNumber(page.currentPage) || 1,
    totalPages: readNumber(page.totalPages) || 1,
    totalCount: readNumber(page.totalCount) || rows.length,
    hasNextPage: page.hasNextPage === true,
  };
}

export async function listEmployeeGatePasses(query: {
  eeSerialID: number;
  pageNumber?: number;
  pageSize?: number;
}): Promise<EmployeeGatePassPage> {
  const result = await getHcmJson<unknown>('/EGatePass/employee/paged', {
    EESerialID: query.eeSerialID,
    PageNumber: query.pageNumber ?? 1,
    PageSize: query.pageSize ?? 20,
    SortColumn: 'date',
    SortDirection: 'desc',
  });
  return parseEmployeeGatePassPage(result);
}

export async function createGatePass(body: CreateGatePassBody): Promise<void> {
  const result = await postHcmJson<unknown, CreateGatePassBody>('/EGatePass', body);
  if (result && typeof result === 'object' && (result as { succeeded?: boolean }).succeeded === false) {
    const messages = (result as { messages?: unknown }).messages;
    const first = Array.isArray(messages) ? messages.find((item) => typeof item === 'string') : '';
    throw new ApiError(typeof first === 'string' && first ? first : 'Gate pass was not created.');
  }
}
