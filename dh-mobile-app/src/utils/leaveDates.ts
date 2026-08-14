export function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toDateInputValue(value?: string | null): string {
  if (!value) return todayDateString();
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : todayDateString();
}

export function toApiDateTime(dateValue: string): string {
  const match = dateValue.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) {
    return dateValue;
  }
  return `${match[1]}T00:00:00`;
}

export function toApiDateOnly(dateValue: string): string {
  const match = dateValue.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : dateValue;
}

export function toApiDateOnlyObject(dateValue: string): {
  year: number;
  month: number;
  day: number;
} {
  const dateOnly = toApiDateOnly(dateValue);
  const [year, month, day] = dateOnly.split('-').map(Number);
  return { year, month, day };
}

export function formatLeaveDate(value?: string | null): string {
  if (!value) return '—';
  const datePart = toDateInputValue(value);
  const [year, month, day] = datePart.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString();
}

export function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Normalize many date shapes to local YYYY-MM-DD for reliable filtering.
 */
export function toDateKey(value?: unknown): string | null {
  if (value == null || value === '') {
    return null;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const year = Number(record.year);
    const month = Number(record.month);
    const day = Number(record.day);
    if (
      Number.isInteger(year) &&
      Number.isInteger(month) &&
      Number.isInteger(day) &&
      year > 1900 &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31
    ) {
      return `${year}-${pad2(month)}-${pad2(day)}`;
    }
  }

  if (typeof value === 'number' && !Number.isNaN(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
    }
    return null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  // YYYY-MM-DD or ISO starting with that
  const isoPrefix = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoPrefix) {
    // Pure date (no time) — keep as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    // Has time / timezone — use local calendar day
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
    }

    return `${isoPrefix[1]}-${isoPrefix[2]}-${isoPrefix[3]}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${pad2(Number(dmy[2]))}-${pad2(Number(dmy[1]))}`;
  }

  // MM/DD/YYYY (US) — only if first part > 12 can't be day-first; prefer DMY for this app
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
  }

  return null;
}

/**
 * Parse user-typed filter text into YYYY-MM-DD when possible.
 */
export function parseUserDateFilter(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return toDateKey(trimmed);
}
