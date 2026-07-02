export enum Slot {
  ShiftStart = 1,
  ShiftEnd = 2,
  BeforeLunch = 3,
  AfterLunch = 4,
}

export const SLOT_OPTIONS: { value: Slot; label: string }[] = [
  { value: Slot.ShiftStart, label: 'Shift Start' },
  { value: Slot.ShiftEnd, label: 'Shift End' },
  { value: Slot.BeforeLunch, label: 'Before Lunch' },
  { value: Slot.AfterLunch, label: 'After Lunch' },
];

export function getSlotLabel(slot: number, slotName?: string | null): string {
  if (slotName?.trim()) {
    return slotName;
  }

  return SLOT_OPTIONS.find((option) => option.value === slot)?.label ?? `Slot ${slot}`;
}

export type CreateShortLeaveCommand = {
  eeSerialID: number;
  comSerialID: number;
  entryDate: string;
  date: string;
  slot: Slot;
  reason: string;
  leaveApprovedBy?: number | null;
};

export type UpdateShortLeaveCommand = {
  shortLeaveSerialID: number;
  eeSerialID: number;
  comSerialID: number;
  entryDate: string;
  date: string;
  slot: Slot;
  reason: string;
  leaveApprovedBy?: number | null;
  active: boolean;
};

export type GetShortLeaveEntryDto = {
  shortLeaveSerialID: number;
  eeSerialID: number;
  comSerialID: number;
  entryDate: string;
  date: string;
  slot: Slot;
  reason: string;
  leaveApprovedBy?: number | null;
  active?: boolean;
};

export function buildShortLeaveEntryFromMobile(
  item: MobileShortLeaveEntry,
  comSerialID: number,
): GetShortLeaveEntryDto {
  return {
    shortLeaveSerialID: item.shortLeaveSerialID,
    eeSerialID: item.eeSerialID,
    comSerialID,
    entryDate: item.createdDate ?? new Date().toISOString(),
    date: item.date ?? new Date().toISOString(),
    slot: item.slot as Slot,
    reason: item.reason ?? '',
    leaveApprovedBy: 0,
    active: item.active,
  };
}

export type GetShortLeaveEntryResult = {
  succeeded: boolean;
  messages?: string[] | null;
  data?: GetShortLeaveEntryDto | null;
  code?: number;
};

export type MobileShortLeaveEntry = {
  id: number;
  shortLeaveSerialID: number;
  date?: string | null;
  reason?: string | null;
  slot: number;
  slotName?: string | null;
  active: boolean;
  createdBy?: number | null;
  createdDate?: string | null;
  modifiedBy?: number | null;
  modifiedDate?: string | null;
  isDeleted: boolean;
  eeSerialID: number;
  epfNumber?: string | null;
  eeid?: number | null;
  nameWithInitials?: string | null;
  applicantName?: string | null;
};

export type MobileShortLeaveQuery = {
  status?: boolean;
  PageNumber?: number;
  PageSize?: number;
  EESerialID?: number;
  EEserialID?: number;
  ComSerialID?: number;
  DateFrom?: string;
  SortColumn?: string;
  SortDirection?: string;
  Filter?: string;
};

export type MobileShortLeavePaginatedResult = {
  messages?: string[] | null;
  succeeded: boolean;
  data?: MobileShortLeaveEntry[] | null;
  currentPage?: number;
  totalPages?: number;
  totalCount?: number;
  pageSize?: number;
  hasPreviousPage?: boolean;
  hasNextPage?: boolean;
};

export type MobileShortLeavePaginatedResultResult = {
  succeeded: boolean;
  messages?: string[] | null;
  data?: MobileShortLeavePaginatedResult | null;
  code?: number;
};

export type MobileShortLeaveListPage = {
  items: MobileShortLeaveEntry[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
};
