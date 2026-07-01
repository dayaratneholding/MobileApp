export enum LeaveType {
  Annual = 1,
  Casual = 2,
  Medical = 3,
  Maternity = 4,
  LieuLeave = 5,
  DutyLeave = 6,
  NoPayAuthorized = 7,
  NoPayUnauthorized = 8,
  VotingLeave = 9,
  Other = 10,
  FestivalLeave = 11,
}

export enum ReasonType {
  AnnualLeave = 1,
  Personal = 2,
  SickSelf = 3,
  SickFamily = 4,
  ExamStudy = 5,
  Wedding = 6,
  Funeral = 7,
  Other = 8,
}

export enum HalfDay {
  None = 0,
  MorningHalfday = 1,
  AfternoonHalfday = 2,
}

export enum LeaveStatus {
  Pending = 1,
  Approved = 2,
  Taken = 3,
  Cancelled = 4,
}

export type CreateEmployeeLeaveCommand = {
  eeSerialID: number;
  comSerialID: number;
  entryDate: string;
  leaveType: LeaveType;
  leaveCount: number;
  dateFrom: string;
  dateTo: string;
  reason: ReasonType;
  leaveApprovedBy: number;
  cancelNotes?: string | null;
  halfDayId?: HalfDay;
  leaveStatus?: LeaveStatus;
  cancelLeave?: boolean | null;
};

export type Int32Result = {
  succeeded: boolean;
  messages?: string[] | null;
  data?: number;
  code?: number;
};

export type GetCalendarLeaveCountRequest = {
  fromDate: string;
  toDate: string;
  eeSerialID: number;
  isHalfDay: boolean;
};

export type LeaveCountResult = {
  succeeded: boolean;
  messages?: string[] | null;
  data?: number;
  code?: number;
};

export type MobileLeaveQuery = {
  status?: boolean;
  PageNumber?: number;
  PageSize?: number;
  EESerialID?: number;
  DateFrom?: string;
  SortColumn?: string;
  SortDirection?: string;
};

export type MobileLeaveEntry = {
  id: number;
  empLeaveSerialID: number;
  eeSerialID: number;
  dateFrom?: string | null;
  dateTo?: string | null;
  leaveType: number;
  leaveTypeName?: string | null;
  leaveCount?: number | null;
  reason: number;
  reasonName?: string | null;
  active: boolean;
  createdBy?: number | null;
  createdDate?: string | null;
  modifiedBy?: number | null;
  modifiedDate?: string | null;
  isDeleted: boolean;
  epfNumber?: string | null;
  applicantName?: string | null;
  image?: string | null;
};

export type MobileLeavePaginatedResult = {
  messages?: string[] | null;
  succeeded: boolean;
  data?: MobileLeaveEntry[] | null;
  currentPage?: number;
  totalPages?: number;
  totalCount?: number;
  pageSize?: number;
  hasPreviousPage?: boolean;
  hasNextPage?: boolean;
};

export type MobileLeavePaginatedResultResult = {
  succeeded: boolean;
  messages?: string[] | null;
  data?: MobileLeavePaginatedResult | null;
  code?: number;
};

export type MobileLeaveListPage = {
  items: MobileLeaveEntry[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
};

export const LEAVE_TYPE_OPTIONS = [
  { value: LeaveType.Annual, label: 'Annual' },
  { value: LeaveType.Casual, label: 'Casual' },
  { value: LeaveType.Medical, label: 'Medical' },
  { value: LeaveType.Maternity, label: 'Maternity' },
  { value: LeaveType.LieuLeave, label: 'Lieu Leave' },
  { value: LeaveType.DutyLeave, label: 'Duty Leave' },
  { value: LeaveType.NoPayAuthorized, label: 'No Pay (Authorized)' },
  { value: LeaveType.NoPayUnauthorized, label: 'No Pay (Unauthorized)' },
  { value: LeaveType.VotingLeave, label: 'Voting Leave' },
  { value: LeaveType.Other, label: 'Other' },
  { value: LeaveType.FestivalLeave, label: 'Festival Leave' },
];

export const REASON_OPTIONS = [
  { value: ReasonType.AnnualLeave, label: 'Annual Leave' },
  { value: ReasonType.Personal, label: 'Personal' },
  { value: ReasonType.SickSelf, label: 'Sick (Self)' },
  { value: ReasonType.SickFamily, label: 'Sick (Family)' },
  { value: ReasonType.ExamStudy, label: 'Exam / Study' },
  { value: ReasonType.Wedding, label: 'Wedding' },
  { value: ReasonType.Funeral, label: 'Funeral' },
  { value: ReasonType.Other, label: 'Other' },
];

export const HALF_DAY_OPTIONS = [
  { value: HalfDay.None, label: 'Full Day' },
  { value: HalfDay.MorningHalfday, label: 'Morning Half' },
  { value: HalfDay.AfternoonHalfday, label: 'Afternoon Half' },
];
