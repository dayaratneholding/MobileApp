import { getHcmJson, postHcmJson } from '../client/hcmClient';
import { ApiError } from '../client/client';

export type GatePassDate = {
  year: number;
  month: number;
  day: number;
  dayOfWeek: number;
};

export type GatePassTime = {
  ticks: number;
};

export type GatePassEmployeeDetail = {
  eGatePassSerialID: number;
  comSerialID: number;
  eeSerialID: number;
  fullName: string;
};

export type CreateGatePassBody = {
  eeSerialID: number;
  comSerialID: number;
  departureTime: GatePassTime;
  returnTime: GatePassTime;
  date: GatePassDate;
  vehicleNumber: string;
  reason: string;
  remark: string;
  approvedBy: number;
  approvedDate: GatePassDate | null;
  confirmedBy: number;
  confirmedDate: GatePassDate | null;
  eGatePassStatus: number;
  planDepartureDate: GatePassDate;
  planDepartureTime: GatePassTime;
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

export function dateParts(value: Date): GatePassDate {
  return {
    year: value.getFullYear(),
    month: value.getMonth() + 1,
    day: value.getDate(),
    dayOfWeek: value.getDay(),
  };
}

/** .NET TimeSpan ticks. One second is 10,000,000 ticks. */
export function timeTicks(value: Date): GatePassTime {
  const seconds = value.getHours() * 3600 + value.getMinutes() * 60 + value.getSeconds();
  return { ticks: seconds * 10_000_000 };
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

export async function createGatePass(body: CreateGatePassBody): Promise<void> {
  const result = await postHcmJson<unknown, CreateGatePassBody>('/EGatePass', body);
  if (result && typeof result === 'object' && (result as { succeeded?: boolean }).succeeded === false) {
    const messages = (result as { messages?: unknown }).messages;
    const first = Array.isArray(messages) ? messages.find((item) => typeof item === 'string') : '';
    throw new ApiError(typeof first === 'string' && first ? first : 'Gate pass was not created.');
  }
}
