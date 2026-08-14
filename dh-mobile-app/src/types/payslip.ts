export type EmployeeDetails = {
  eeSerialID: number;
  eeid: number;
  comSerialID: number;
  scheme?: number | null;
  nameWithInitials?: string | null;
  callName?: string | null;
  fullName?: string | null;
  desigName?: string | null;
  deptName?: string | null;
  basicSalary?: number | null;
  bankAccNo?: string | null;
  bankName?: string | null;
};

export type PayrollPeriodItem = {
  payPeriodSerialID?: number;
  payPeriod: string;
  payScheme?: number | null;
  paySchemeName?: string | null;
  payrollStart?: string | null;
  payrollEnd?: string | null;
  status?: string | null;
};

export type PayslipData = {
  empSalSerialID?: number;
  empNo?: number;
  nameWithInitials?: string;
  desigName?: string;
  deptName?: string;
  basicSalary?: number;
  noPayDays?: number;
  noPayAmount?: number;
  lateHours?: number;
  lateMinuteAmount?: number;
  totalForEPF?: number;
  oT1_5Hours?: number;
  oT2Hours?: number;
  oT2_5Hours?: number;
  oT3Hours?: number;
  totalOT?: number;
  attendaceAllowance?: number;
  grossPay?: number;
  payeTax?: number;
  epF8?: number;
  stampFee?: number;
  netSalary?: number;
  salaryToBank?: number;
  epF12?: number;
  etF3?: number;
  payPeriod?: string;
  companyName?: string;
  scheme?: number;
  bankAccNo?: string;
  bankName?: string;
  payMonth?: string;
  arrears?: number;
  dayPay?: number;
  workdays?: number;
  leaveCount?: number;
  travellingAndFuel_Amount?: number;
  living_Amount?: number;
  special_Amount?: number;
  otherEmol_Amount?: number;
  salaryAdvance_Amount?: number;
  mobile_Amount?: number;
  loan_Amount?: number;
  otherDeduct_Amount?: number;
};

export type PayslipQuery = {
  scheme: number;
  comSerialID: number;
  payPeriod: string;
  eeid: number;
  reportType?: number;
  dataSet?: number;
  callName?: string;
};

export function formatMoney(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
