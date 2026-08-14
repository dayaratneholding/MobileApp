import { getHcmJson } from '../client/hcmClient';
import type { EmployeeDetails } from '../../types/payslip';

type GetEmployeeDto = EmployeeDetails & Record<string, unknown>;

type GetEmployeeDtoResult = {
  succeeded?: boolean;
  messages?: string[];
  data?: GetEmployeeDto;
};

function parseEmployee(record: Record<string, unknown>): EmployeeDetails {
  const eeSerialID = Number(record.eeSerialID ?? record.eESerialID);
  const eeid = Number(record.eeid ?? record.EEID);
  const comSerialID = Number(record.comSerialID ?? record.ComSerialID);

  if (!eeSerialID || !eeid || !comSerialID) {
    throw new Error('Employee details are incomplete.');
  }

  return {
    eeSerialID,
    eeid,
    comSerialID,
    scheme: record.scheme != null ? Number(record.scheme) : null,
    nameWithInitials:
      typeof record.nameWithInitials === 'string' ? record.nameWithInitials : null,
    callName: typeof record.callName === 'string' ? record.callName : null,
    fullName: typeof record.fullName === 'string' ? record.fullName : null,
    desigName: typeof record.desigName === 'string' ? record.desigName : null,
    deptName: typeof record.deptName === 'string' ? record.deptName : null,
    basicSalary:
      record.basicSalary != null ? Number(record.basicSalary) : null,
    bankAccNo: typeof record.bankAccNo === 'string' ? record.bankAccNo : null,
    bankName: typeof record.bankName === 'string' ? record.bankName : null,
  };
}

function parseEmployeeResponse(result: unknown): EmployeeDetails {
  if (!result || typeof result !== 'object') {
    throw new Error('Employee details not returned from server.');
  }

  const record = result as Record<string, unknown>;

  if (record.succeeded === false) {
    throw new Error(
      (record.messages as string[] | undefined)?.[0] ??
        'Failed to load employee details.',
    );
  }

  if (record.eeSerialID != null || record.eeid != null) {
    return parseEmployee(record);
  }

  if (record.data && typeof record.data === 'object') {
    return parseEmployee(record.data as Record<string, unknown>);
  }

  throw new Error('Employee details not found.');
}

function pickEmployeeForCompany(
  employees: EmployeeDetails[],
  comSerialID?: number,
): EmployeeDetails {
  if (employees.length === 0) {
    throw new Error('Employee not found for this EEID.');
  }

  if (comSerialID != null) {
    const match = employees.find((item) => item.comSerialID === comSerialID);
    if (match) {
      return match;
    }
  }

  return employees[0];
}

export async function getEmployeeByEeSerialId(
  eeSerialID: number,
): Promise<EmployeeDetails> {
  if (__DEV__) {
    console.log('[Employee] GET by eeSerialID:', eeSerialID);
  }

  const result = await getHcmJson<GetEmployeeDtoResult | GetEmployeeDto>(
    `/Employees/${eeSerialID}`,
  );

  return parseEmployeeResponse(result);
}

export async function getEmployeeByEeid(
  eeid: number,
  comSerialID?: number,
): Promise<EmployeeDetails> {
  if (__DEV__) {
    console.log('[Employee] GET by eeid:', { eeid, comSerialID });
  }

  const result = await getHcmJson<GetEmployeeDto[] | GetEmployeeDtoResult>(
    `/Employees/GetEmployeesByEEID/${eeid}`,
  );

  if (Array.isArray(result)) {
    const employees = result.map((item) =>
      parseEmployee(item as Record<string, unknown>),
    );
    return pickEmployeeForCompany(employees, comSerialID);
  }

  return parseEmployeeResponse(result);
}
