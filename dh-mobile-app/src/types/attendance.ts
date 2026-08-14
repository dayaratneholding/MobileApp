export type AttendanceSummary = {
  attendanceCount: number | null;
  lateMinutes: number | null;
  overtimeCount: number | null;
};

export type AttendanceListItem = {
  id?: number;
  attendanceSerialID?: number;
  eeSerialID?: number;
  eeid?: number;
  callName?: string | null;
  fullName?: string | null;
  nameWithInitials?: string | null;
  nic?: string | null;
  shiftSerialID?: number | null;
  shiftName?: string | null;
  timeIn?: string | number | { hours?: number; minutes?: number; seconds?: number } | null;
  timeOut?: string | number | { hours?: number; minutes?: number; seconds?: number } | null;
  dateIn?: string | null;
  dateOut?: string | null;
  deptName?: string | null;
  sectName?: string | null;
  active?: boolean;
  attendanceStatus?: string | null;
  createdDate?: string | null;
};

export type AttendanceListPage = {
  items: AttendanceListItem[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
};

export type AttendancePagedQuery = {
  ComSerialID: number;
  PageNumber?: number;
  PageSize?: number;
  SortColumn?: string;
  SortDirection?: string;
  status?: boolean;
  Filter?: string;
  EESerialID?: number;
  EEID?: number;
};

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatAttendanceTime(
  value?: AttendanceListItem['timeIn'],
): string {
  if (value == null) {
    return '—';
  }

  if (typeof value === 'string') {
    const match = value.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (match) {
      return `${pad2(Number(match[1]))}:${match[2]}`;
    }

    // TimeSpan as "HH:MM:SS" or total ticks/string
    if (/^\d+$/.test(value)) {
      const totalSeconds = Number(value);
      if (!Number.isNaN(totalSeconds)) {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        return `${pad2(hours)}:${pad2(minutes)}`;
      }
    }

    return value;
  }

  if (typeof value === 'number') {
    // Treat as total seconds or ticks in 100ns — prefer seconds if small.
    const totalSeconds =
      value > 86400 * 1000 ? Math.floor(value / 10_000_000) : Math.floor(value);
    const hours = Math.floor(totalSeconds / 3600) % 24;
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${pad2(hours)}:${pad2(minutes)}`;
  }

  if (typeof value === 'object') {
    const hours = Number(value.hours ?? 0);
    const minutes = Number(value.minutes ?? 0);
    return `${pad2(hours)}:${pad2(minutes)}`;
  }

  return '—';
}

export function formatAttendanceDate(value?: string | null): string {
  if (!value) {
    return '—';
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return value;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
