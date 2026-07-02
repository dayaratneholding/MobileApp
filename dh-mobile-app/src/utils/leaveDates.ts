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

export function formatLeaveDate(value?: string | null): string {
  if (!value) return '—';
  const datePart = toDateInputValue(value);
  const [year, month, day] = datePart.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString();
}

export function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}
