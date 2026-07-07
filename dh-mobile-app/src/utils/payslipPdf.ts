import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { PayslipData } from '../types/payslip';
import { formatMoney } from '../types/payslip';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function moneyRow(label: string, value?: number | null): string {
  if (value == null || value === 0) {
    return '';
  }

  return `
    <tr>
      <td class="label">${escapeHtml(label)}</td>
      <td class="amount">${escapeHtml(formatMoney(value))}</td>
    </tr>
  `;
}

export function buildPayslipHtml(payslip: PayslipData): string {
  const payPeriod = payslip.payPeriod ?? 'Payslip';
  const companyName = payslip.companyName ?? '—';
  const employeeName = payslip.nameWithInitials ?? '—';
  const designation = payslip.desigName ?? '—';
  const department = payslip.deptName ?? '—';
  const empNo = payslip.empNo != null ? String(payslip.empNo) : '—';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            font-family: Arial, Helvetica, sans-serif;
            color: #111827;
            margin: 24px;
            font-size: 12px;
          }
          .header {
            border-bottom: 2px solid #4F46E5;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .company {
            font-size: 18px;
            font-weight: 700;
          }
          .period {
            font-size: 16px;
            color: #4F46E5;
            margin-top: 4px;
            font-weight: 700;
          }
          .employee {
            margin-bottom: 16px;
          }
          .employee h2 {
            margin: 0 0 4px;
            font-size: 16px;
          }
          .meta {
            color: #6B7280;
            margin: 2px 0;
          }
          .stats {
            display: flex;
            gap: 12px;
            margin-bottom: 16px;
          }
          .stat {
            flex: 1;
            background: #F3F4F6;
            border-radius: 8px;
            padding: 10px;
          }
          .stat-value {
            font-size: 14px;
            font-weight: 700;
          }
          .stat-label {
            color: #6B7280;
            margin-top: 2px;
          }
          h3 {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #6B7280;
            margin: 18px 0 8px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          td {
            padding: 6px 0;
            vertical-align: top;
          }
          .label {
            color: #6B7280;
          }
          .amount {
            text-align: right;
            font-weight: 600;
          }
          .total-row td {
            border-top: 1px solid #E5E7EB;
            padding-top: 10px;
            font-weight: 700;
            font-size: 13px;
          }
          .net-box {
            background: #FEF3C7;
            border-radius: 10px;
            padding: 16px;
            margin-top: 18px;
          }
          .net-label {
            color: #6B7280;
            font-size: 11px;
          }
          .net-value {
            font-size: 24px;
            font-weight: 700;
            margin-top: 4px;
          }
          .bank {
            color: #6B7280;
            margin-top: 6px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company">${escapeHtml(companyName)}</div>
          <div class="period">${escapeHtml(payPeriod)}</div>
        </div>

        <div class="employee">
          <h2>${escapeHtml(employeeName)}</h2>
          <div class="meta">EPF ${escapeHtml(empNo)} · ${escapeHtml(designation)}</div>
          <div class="meta">${escapeHtml(department)}</div>
        </div>

        <div class="stats">
          <div class="stat">
            <div class="stat-value">${escapeHtml(String(payslip.workdays ?? '—'))}</div>
            <div class="stat-label">Work days</div>
          </div>
          <div class="stat">
            <div class="stat-value">${escapeHtml(String(payslip.leaveCount ?? '—'))}</div>
            <div class="stat-label">Leave</div>
          </div>
          <div class="stat">
            <div class="stat-value">${escapeHtml(formatMoney(payslip.dayPay))}</div>
            <div class="stat-label">Day pay</div>
          </div>
        </div>

        <h3>Earnings</h3>
        <table>
          ${moneyRow('Basic salary', payslip.basicSalary)}
          ${moneyRow('Travelling & fuel', payslip.travellingAndFuel_Amount)}
          ${moneyRow('Living allowance', payslip.living_Amount)}
          ${moneyRow('Special allowance', payslip.special_Amount)}
          ${moneyRow('Other emoluments', payslip.otherEmol_Amount)}
          ${moneyRow('Overtime', payslip.totalOT)}
          ${moneyRow('Attendance allowance', payslip.attendaceAllowance)}
          ${moneyRow('Arrears', payslip.arrears)}
          <tr class="total-row">
            <td>Gross pay</td>
            <td class="amount">${escapeHtml(formatMoney(payslip.grossPay))}</td>
          </tr>
        </table>

        <h3>Deductions</h3>
        <table>
          ${moneyRow('No pay', payslip.noPayAmount)}
          ${moneyRow('Late minutes', payslip.lateMinuteAmount)}
          ${moneyRow('PAYE tax', payslip.payeTax)}
          ${moneyRow('EPF 8%', payslip.epF8)}
          ${moneyRow('Stamp fee', payslip.stampFee)}
          ${moneyRow('Salary advance', payslip.salaryAdvance_Amount)}
          ${moneyRow('Loan', payslip.loan_Amount)}
          ${moneyRow('Mobile', payslip.mobile_Amount)}
          ${moneyRow('Other deductions', payslip.otherDeduct_Amount)}
        </table>

        <div class="net-box">
          <div class="net-label">Net salary</div>
          <div class="net-value">${escapeHtml(formatMoney(payslip.netSalary))}</div>
          <div class="bank">To bank: ${escapeHtml(formatMoney(payslip.salaryToBank))}</div>
          <div class="bank">${escapeHtml(payslip.bankName ?? '—')} · ${escapeHtml(payslip.bankAccNo ?? '—')}</div>
        </div>

        <h3>Employer contributions</h3>
        <table>
          ${moneyRow('EPF 12%', payslip.epF12)}
          ${moneyRow('ETF 3%', payslip.etF3)}
          ${moneyRow('Total for EPF', payslip.totalForEPF)}
        </table>
      </body>
    </html>
  `;
}

function buildPayslipFilename(payslip: PayslipData): string {
  const period = (payslip.payPeriod ?? 'payslip').replace(/[\\/]/g, '-');
  const empNo = payslip.empNo != null ? String(payslip.empNo) : 'employee';
  return `Payslip_${period}_${empNo}.pdf`;
}

export async function downloadPayslipPdf(payslip: PayslipData): Promise<void> {
  const html = buildPayslipHtml(payslip);
  const { uri } = await Print.printToFileAsync({ html });

  const filename = buildPayslipFilename(payslip);
  const destination = `${FileSystem.cacheDirectory}${filename}`;

  await FileSystem.copyAsync({
    from: uri,
    to: destination,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device.');
  }

  await Sharing.shareAsync(destination, {
    mimeType: 'application/pdf',
    dialogTitle: 'Download payslip',
    UTI: 'com.adobe.pdf',
  });

  if (__DEV__) {
    console.log('[Payslip] PDF ready:', {
      destination,
      platform: Platform.OS,
    });
  }
}
