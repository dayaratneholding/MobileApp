export type FaceEnrollment = {
  enrolled: boolean;
  company_id: string;
  employee_id: string;
  employee_name: string | null;
  sample_count: number;
  model: string;
  updated_at: string | null;
  message?: string;
};

export type FaceMatch = {
  matched: boolean;
  employee_id: string;
  employee_name: string | null;
  company_id: string;
  distance: number;
  threshold: number;
  confidence: number;
  model: string;
  metric: string;
  message: string;
};

export type AttendanceRecord = {
  id: number;
  company_id: string;
  employee_id: string;
  employee_name: string | null;
  attendance_date: string;
  time_in: string | null;
  time_out: string | null;
  confidence: number | null;
  distance: number | null;
  source: string;
  latitude: number | null;
  longitude: number | null;
  accuracy_meters: number | null;
  out_latitude: number | null;
  out_longitude: number | null;
  out_accuracy_meters: number | null;
  created_at: string;
  updated_at: string;
  action?: string;
  message?: string;
  threshold?: number;
};

export type PhoneLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

export type FacePhoto = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};
