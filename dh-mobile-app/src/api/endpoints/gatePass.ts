import { getHcmJson, postHcmJson, putHcmJson } from '../client/hcmClient';
import { postMobileAppJson } from '../client/mobileAppClient';
import { ApiError } from '../client/client';
import type { AuthSession } from '../../types/api';

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
  returnStatus: string;
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

function field(record: Record<string, unknown>, name: string): unknown {
  if (name in record) return record[name];
  const match = Object.keys(record).find((key) => key.toLowerCase() === name.toLowerCase());
  return match ? record[match] : undefined;
}

type ClockTime = { hours: number; minutes: number; seconds: number };

function clockFromSeconds(totalSeconds: number): ClockTime {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  return {
    hours: Math.floor(seconds / 3600) % 24,
    minutes: Math.floor(seconds / 60) % 60,
    seconds: seconds % 60,
  };
}

/** EmployeeGatePass TimeSpan: "HH:mm:ss", "d.HH:mm:ss", ticks, or { hours, minutes }. */
function parseTimeSpan(value: unknown): ClockTime | null {
  if (value == null || value === '') return null;

  if (typeof value === 'number' && Number.isFinite(value)) {
    const seconds = value > 10_000_000 ? value / 10_000_000 : value;
    return clockFromSeconds(seconds);
  }

  if (typeof value === 'string') {
    const text = value.trim();
    const span = text.match(/^(?:(\d+)\.)?(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (span) {
      return {
        hours: (Number(span[1] ?? 0) * 24 + Number(span[2])) % 24,
        minutes: Number(span[3]),
        seconds: Number(span[4] ?? 0),
      };
    }
    const clock = text.match(/T(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (clock) {
      return { hours: Number(clock[1]), minutes: Number(clock[2]), seconds: Number(clock[3] ?? 0) };
    }
    return null;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (record.hours != null || record.minutes != null || record.seconds != null) {
      return {
        hours: (readNumber(record.days) * 24 + readNumber(record.hours)) % 24,
        minutes: readNumber(record.minutes),
        seconds: readNumber(record.seconds),
      };
    }
    if (record.ticks != null) return parseTimeSpan(readNumber(record.ticks));
  }

  return null;
}

function formatClock(time: ClockTime | null): string {
  if (!time) return '—';
  return `${pad2(time.hours)}:${pad2(time.minutes)}`;
}

export function formatGatePassTime(value: unknown): string {
  return formatClock(parseTimeSpan(value));
}

export function formatGatePassDate(value: unknown): string {
  const key = apiDate(value);
  if (!key) return '—';
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString();
}

function readStatus(value: unknown): { status: number | null; name: string } {
  if (typeof value === 'number' && GATE_PASS_STATUS_NAMES[value]) {
    return { status: value, name: GATE_PASS_STATUS_NAMES[value] };
  }
  if (typeof value === 'string') {
    const numeric = Number(value);
    if (GATE_PASS_STATUS_NAMES[numeric]) {
      return { status: numeric, name: GATE_PASS_STATUS_NAMES[numeric] };
    }
    const key = value.replace(/\s+/g, '').toLowerCase();
    const match = Object.entries(GATE_PASS_STATUS_NAMES).find(
      ([, name]) => name.replace(/\s+/g, '').toLowerCase() === key,
    );
    if (match) return { status: Number(match[0]), name: match[1] };
  }
  return { status: null, name: '' };
}

function readReturnStatus(value: unknown): string {
  if (value === 1 || value === '1' || value === 'Returned') return 'Returned';
  if (
    value === 2 ||
    value === '2' ||
    value === 'DutyoffNoReturn' ||
    value === 'DutyOff' ||
    value === 'Duty Off'
  ) {
    return 'Duty Off';
  }
  return '—';
}

function readDisplayText(value: unknown): string {
  const text = readText(value);
  return text || '—';
}

function parseEmployeeGatePass(item: unknown, index: number): EmployeeGatePass {
  const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
  const employee =
    field(record, 'employee') && typeof field(record, 'employee') === 'object'
      ? (field(record, 'employee') as Record<string, unknown>)
      : {};
  const parsedStatus = readStatus(field(record, 'eGatePassStatus'));
  const statusName = readText(field(record, 'eGatePassStatusName'));
  const serial = readNumber(field(record, 'eGatePassSerialID') ?? field(record, 'id'));
  const employeeName =
    readText(field(record, 'eeidwithname')) ||
    readText(field(record, 'nameWithInitials')) ||
    readText(field(employee, 'nameWithInitials')) ||
    readText(field(employee, 'fullName')) ||
    readText(field(employee, 'callName'));

  return {
    id: readNumber(field(record, 'id')) || serial || index + 1,
    eGatePassSerialID: serial,
    eeSerialID: readNumber(field(record, 'eeSerialID')),
    eeid: readNumber(field(record, 'eeid') ?? field(employee, 'eeid')),
    employeeLabel: employeeName || '—',
    date: formatGatePassDate(field(record, 'date')),
    planDepartureDate: formatGatePassDate(field(record, 'planDepartureDate')),
    planDepartureTime: formatGatePassTime(field(record, 'planDepartureTime')),
    departureTime: formatGatePassTime(field(record, 'departureTime')),
    returnTime: formatGatePassTime(field(record, 'returnTime')),
    vehicleNumber: readDisplayText(field(record, 'vehicleNumber')),
    reason: readDisplayText(field(record, 'reason')),
    remark: readDisplayText(field(record, 'remark')),
    returnStatus: readReturnStatus(field(record, 'returnstatus')),
    status: parsedStatus.status,
    statusName: statusName || parsedStatus.name || 'Unknown',
    approvedBy: readDisplayText(field(record, 'approvedName') ?? field(record, 'approvedBy')),
    confirmedBy: readDisplayText(field(record, 'confirmName') ?? field(record, 'confirmedBy')),
  };
}

function failureMessage(record: Record<string, unknown>, fallback: string): string {
  const messages = record.messages;
  const first = Array.isArray(messages) ? messages.find((item) => typeof item === 'string') : '';
  return typeof first === 'string' && first ? first : fallback;
}

function parseEmployeeGatePassPage(result: unknown): EmployeeGatePassPage {
  if (Array.isArray(result)) {
    const rows = [...result].sort((left, right) => gatePassSortKey(right).localeCompare(gatePassSortKey(left)));
    return {
      items: rows.map(parseEmployeeGatePass),
      currentPage: 1,
      totalPages: 1,
      totalCount: rows.length,
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
  rows.sort((left, right) => gatePassSortKey(right).localeCompare(gatePassSortKey(left)));
  const page = nested ?? root;

  return {
    items: rows.map(parseEmployeeGatePass),
    currentPage: readNumber(page.currentPage) || 1,
    totalPages: readNumber(page.totalPages) || 1,
    totalCount: readNumber(page.totalCount) || rows.length,
    hasNextPage: page.hasNextPage === true,
  };
}

function gatePassSortKey(item: unknown): string {
  const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
  const serial = readNumber(field(record, 'eGatePassSerialID') ?? field(record, 'id'));
  return `${apiDate(field(record, 'date')) ?? ''}-${pad2(serial)}`;
}

function isStringToIntError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /string/i.test(message) && /int32/i.test(message);
}

export async function listEmployeeGatePasses(query: {
  eeSerialID: number;
  pageNumber?: number;
  pageSize?: number;
}): Promise<EmployeeGatePassPage> {
  const pageNumber = query.pageNumber ?? 1;
  const pageSize = query.pageSize ?? 20;

  try {
    const result = await getHcmJson<unknown>('/EGatePass/employee/paged', {
      EESerialID: query.eeSerialID,
      PageNumber: pageNumber,
      PageSize: pageSize,
      SortColumn: 'eGatePassSerialID',
      SortDirection: 'desc',
    });
    return parseEmployeeGatePassPage(result);
  } catch (error) {
    if (!isStringToIntError(error)) throw error;
  }

  const all = parseEmployeeGatePassPage(await getHcmJson<unknown>('/EGatePass'));
  const mine = all.items.filter((item) => item.eeSerialID === query.eeSerialID);
  const start = (pageNumber - 1) * pageSize;

  return {
    items: mine.slice(start, start + pageSize),
    currentPage: pageNumber,
    totalPages: Math.max(1, Math.ceil(mine.length / pageSize)),
    totalCount: mine.length,
    hasNextPage: start + pageSize < mine.length,
  };
}

export const GatePassApprovalRole = {
  HOD: 1,
  Admin: 2,
} as const;

export type GatePassAccess = {
  eeSerialID: number;
  isHod: boolean;
  isAdmin: boolean;
};

export type GatePassDecision = 'confirm' | 'approve' | 'reject';

type ApprovalMember = {
  eeSerialID: number;
  userID: number;
  role: 'hod' | 'admin' | null;
};

function asRecords(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === 'object') {
    const data = (result as { data?: unknown }).data;
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object' && Array.isArray((data as { data?: unknown }).data)) {
      return (data as { data: unknown[] }).data;
    }
  }
  return [];
}

function readRole(value: unknown): 'hod' | 'admin' | null {
  if (value === GatePassApprovalRole.HOD || value === '1' || value === 'HOD' || value === 'Hod') return 'hod';
  if (value === GatePassApprovalRole.Admin || value === '2' || value === 'Admin') return 'admin';
  if (typeof value === 'string') {
    const text = value.toLowerCase();
    if (text.includes('hod')) return 'hod';
    if (text.includes('admin')) return 'admin';
  }
  return null;
}

export async function listGatePassApprovalMembers(): Promise<ApprovalMember[]> {
  const result = await getHcmJson<unknown>('/GatePassApprovalMember');
  return asRecords(result).map((item) => {
    const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    return {
      eeSerialID: readNumber(record.eeSerialID),
      userID: readNumber(record.userID),
      role: readRole(record.role),
    };
  });
}

export function resolveGatePassAccess(
  members: ApprovalMember[],
  session: AuthSession,
): GatePassAccess {
  const eeSerialID = session.eESerialID ?? 0;
  const userID = Number(session.userID);
  const mine = members.filter(
    (member) =>
      (eeSerialID > 0 && member.eeSerialID === eeSerialID) ||
      (Number.isFinite(userID) && userID > 0 && member.userID === userID),
  );
  const memberEeSerialID = mine.find((member) => member.eeSerialID > 0)?.eeSerialID ?? eeSerialID;

  return {
    eeSerialID: memberEeSerialID,
    isHod: mine.some((member) => member.role === 'hod'),
    isAdmin: mine.some((member) => member.role === 'admin'),
  };
}

export async function listGatePassesForDecision(
  decision: 'confirm' | 'approve',
  eeSerialID: number,
): Promise<EmployeeGatePass[]> {
  const path = decision === 'confirm' ? '/ForConfirm' : '/ForApprove';
  const result = await postMobileAppJson<unknown>(path, { EESerialID: eeSerialID });
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    const record = result as Record<string, unknown>;
    if (field(record, 'eGatePassSerialID') != null || field(record, 'eeSerialID') != null) {
      return [parseEmployeeGatePass(record, 0)];
    }
  }
  return parseEmployeeGatePassPage(result).items;
}

function apiDate(value: unknown): string | null {
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const year = readNumber(field(record, 'year'));
    const month = readNumber(field(record, 'month'));
    const day = readNumber(field(record, 'day'));
    if (year > 1900 && month >= 1 && day >= 1) {
      return `${year}-${pad2(month)}-${pad2(day)}`;
    }
  }
  return null;
}

function apiTime(value: unknown): string | null {
  const time = parseTimeSpan(value);
  if (!time) return null;
  return `${pad2(time.hours)}:${pad2(time.minutes)}:${pad2(time.seconds)}`;
}

function nullableId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function nullableReturnStatus(value: unknown): number | null {
  if (value === 1 || value === '1' || value === 'Returned') return 1;
  if (value === 2 || value === '2' || value === 'DutyoffNoReturn' || value === 'DutyOff') return 2;
  return null;
}

function mapDetails(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    return {
      eGatePassSerialID: readNumber(record.eGatePassSerialID),
      comSerialID: readNumber(record.comSerialID),
      eeSerialID: readNumber(record.eeSerialID),
      fullName: readText(record.fullName),
    };
  });
}

function unwrapGatePass(result: unknown): Record<string, unknown> {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new ApiError('Gate pass was not found.');
  }
  const root = result as Record<string, unknown>;
  if (root.succeeded === false) {
    throw new ApiError(failureMessage(root, 'Gate pass was not found.'));
  }
  if (field(root, 'eGatePassSerialID') != null || field(root, 'eeSerialID') != null) return root;
  if (root.data && typeof root.data === 'object' && !Array.isArray(root.data)) {
    return root.data as Record<string, unknown>;
  }
  return root;
}

export async function decideGatePass(input: {
  eGatePassSerialID: number;
  actorEeSerialID: number;
  decision: GatePassDecision;
}): Promise<void> {
  const current = unwrapGatePass(await getHcmJson<unknown>(`/EGatePass/${input.eGatePassSerialID}`));
  const today = dateOnly(new Date());
  const status = input.decision === 'confirm' ? 3 : input.decision === 'approve' ? 2 : 7;
  const date = apiDate(field(current, 'date')) ?? apiDate(field(current, 'planDepartureDate')) ?? today;
  const details = field(current, 'employeeGatePassDetail');
  const body: Record<string, unknown> = {
    eGatePassSerialID: readNumber(field(current, 'eGatePassSerialID')) || input.eGatePassSerialID,
    eeSerialID: readNumber(field(current, 'eeSerialID')),
    comSerialID: readNumber(field(current, 'comSerialID')),
    departureTime: apiTime(field(current, 'departureTime')),
    returnTime: apiTime(field(current, 'returnTime')),
    date,
    vehicleNumber: readText(field(current, 'vehicleNumber')) || null,
    reason: readText(field(current, 'reason')) || null,
    remark: readText(field(current, 'remark')) || null,
    approvedBy: input.decision === 'approve' ? input.actorEeSerialID : nullableId(field(current, 'approvedBy')),
    approvedDate: input.decision === 'approve' ? today : apiDate(field(current, 'approvedDate')),
    confirmedBy: input.decision === 'confirm' ? input.actorEeSerialID : nullableId(field(current, 'confirmedBy')),
    confirmedDate: input.decision === 'confirm' ? today : apiDate(field(current, 'confirmedDate')),
    eGatePassStatus: status,
    planDepartureDate: apiDate(field(current, 'planDepartureDate')),
    planDepartureTime: apiTime(field(current, 'planDepartureTime')),
    returnstatus: nullableReturnStatus(field(current, 'returnstatus')),
    mnuSerialID: readNumber(field(current, 'mnuSerialID')),
  };
  if (Array.isArray(details)) body.employeeGatePassDetail = mapDetails(details);

  const result = await putHcmJson<unknown, Record<string, unknown>>('/EGatePass/update', body);

  if (result && typeof result === 'object' && (result as { succeeded?: boolean }).succeeded === false) {
    throw new ApiError(failureMessage(result as Record<string, unknown>, 'Gate pass was not updated.'));
  }
}

export async function createGatePass(body: CreateGatePassBody): Promise<void> {
  const result = await postHcmJson<unknown, CreateGatePassBody>('/EGatePass', body);
  if (result && typeof result === 'object' && (result as { succeeded?: boolean }).succeeded === false) {
    const messages = (result as { messages?: unknown }).messages;
    const first = Array.isArray(messages) ? messages.find((item) => typeof item === 'string') : '';
    throw new ApiError(typeof first === 'string' && first ? first : 'Gate pass was not created.');
  }
}
