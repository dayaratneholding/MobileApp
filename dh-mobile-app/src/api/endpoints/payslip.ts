import { getMobileAppJson } from '../client/mobileAppClient';
import type { PayslipData, PayslipQuery } from '../../types/payslip';

function parsePayslipResponse(result: unknown): PayslipData {
  if (!result || typeof result !== 'object') {
    throw new Error('Payslip data not returned from server.');
  }

  const record = result as Record<string, unknown> & PayslipData;

  if (record.succeeded === false) {
    throw new Error(
      (record.messages as string[] | undefined)?.[0] ??
        'Failed to load payslip.',
    );
  }

  if (record.data && typeof record.data === 'object') {
    return record.data as PayslipData;
  }

  if (record.netSalary != null || record.grossPay != null || record.empNo != null) {
    return record as PayslipData;
  }

  throw new Error('Payslip fields not found in response.');
}

export async function getPayslip(query: PayslipQuery): Promise<PayslipData> {
  const params = {
    scheme: query.scheme,
    comSerialID: query.comSerialID,
    payPeriod: query.payPeriod,
    eeid: query.eeid,
    reportType: query.reportType ?? 1,
    dataSet: query.dataSet ?? 1,
    callName: query.callName ?? '',
  };

  if (__DEV__) {
    console.log('[Payslip] request:', params);
  }

  const result = await getMobileAppJson<unknown>('/payslip', params);
  const payslip = parsePayslipResponse(result);

  if (__DEV__) {
    console.log('[Payslip] parsed:', payslip);
  }

  return payslip;
}
