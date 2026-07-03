import { getMobileAppJson } from '../client/mobileAppClient';
import type { AttendanceSummary } from '../../types/attendance';

function coerceCount(value: unknown): number | null {
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

function readField(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const count = coerceCount(record[key]);
    if (count !== null) {
      return count;
    }
  }

  return null;
}

function parseAttendanceSummaryResponse(result: unknown): AttendanceSummary {
  let record: Record<string, unknown> | null = null;

  if (result && typeof result === 'object') {
    const wrapped = result as Record<string, unknown>;

    if (wrapped.succeeded === false) {
      const messages = wrapped.messages as string[] | undefined;
      throw new Error(messages?.[0] ?? 'Failed to load attendance summary.');
    }

    if (wrapped.data && typeof wrapped.data === 'object') {
      record = wrapped.data as Record<string, unknown>;
    } else {
      record = wrapped;
    }
  }

  if (!record) {
    throw new Error('Attendance summary not returned from server.');
  }

  const attendanceCount = readField(record, [
    'attendanceCount',
    'attendance',
    'presentCount',
    'present',
    'attendanceDays',
    'totalAttendance',
  ]);

  const lateMinutes = readField(record, [
    'lateMinutes',
    'lateMinute',
    'lateminutes',
    'totalLateMinutes',
    'lateMin',
  ]);

  const overtimeCount = readField(record, [
    'overtimeCount',
    'overTimeCount',
    'overtime',
    'otCount',
    'totalOvertime',
    'overTime',
  ]);

  if (attendanceCount === null && lateMinutes === null && overtimeCount === null) {
    if (__DEV__) {
      console.warn('[Attendance] Unparsed attendance summary:', record);
    }

    throw new Error('Attendance summary fields not found in response.');
  }

  return {
    attendanceCount,
    lateMinutes,
    overtimeCount,
  };
}

export async function getAttendanceSummary(
  eeSerialID: number,
): Promise<AttendanceSummary> {
  if (__DEV__) {
    console.log('[Attendance] attendance-summary request:', { eeSerialID });
  }

  const result = await getMobileAppJson<unknown>(
    `/attendance-summary/${eeSerialID}`,
  );

  const summary = parseAttendanceSummaryResponse(result);

  if (__DEV__) {
    console.log('[Attendance] attendance-summary parsed:', summary);
  }

  return summary;
}
