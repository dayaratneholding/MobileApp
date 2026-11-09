import { FACE_API_KEY, FACE_API_URL } from '../../config/api';
import type { AttendanceRecord, FaceEnrollment, FaceMatch, FacePhoto, PhoneLocation } from '../../types/face';
import { ApiError } from '../client/client';

function faceHeaders(): Record<string, string> {
  return {
    Accept: 'application/json',
    'X-API-Key': FACE_API_KEY,
  };
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function errorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: string } | undefined;
    if (first?.msg) {
      return first.msg;
    }
  }

  return fallback;
}

async function requestFace<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${FACE_API_URL}${path}`, {
      ...init,
      headers: {
        ...faceHeaders(),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(
      `Cannot reach the face service at ${FACE_API_URL}. Start the Python API and confirm this phone can open that address.`,
    );
  }

  const payload = await readBody(response);
  if (!response.ok) {
    const fallback =
      response.status === 401
        ? 'Face service rejected the API key.'
        : `Face service request failed (${response.status}).`;
    throw new ApiError(errorMessage(payload, fallback));
  }

  return payload as T;
}

function photoForm(photo: FacePhoto, fields: Record<string, string>): FormData {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value === '') {
      return;
    }
    form.append(key, value);
  });
  form.append('image', {
    uri: photo.uri,
    name: photo.fileName ?? 'face.jpg',
    type: photo.mimeType ?? 'image/jpeg',
  } as unknown as Blob);

  return form;
}

export function getFaceEnrollment(
  companyId: number,
  employeeId: number,
): Promise<FaceEnrollment> {
  return requestFace<FaceEnrollment>(`/api/v1/faces/${companyId}/${employeeId}`);
}

export function enrollFace(input: {
  photo: FacePhoto;
  companyId: number;
  employeeId: number;
  employeeName: string;
  replace?: boolean;
}): Promise<FaceEnrollment> {
  return requestFace<FaceEnrollment>('/api/v1/faces/enroll', {
    method: 'POST',
    body: photoForm(input.photo, {
      company_id: String(input.companyId),
      employee_id: String(input.employeeId),
      employee_name: input.employeeName,
      replace: input.replace === false ? 'false' : 'true',
    }),
  });
}

export function markFaceAttendance(input: {
  photo: FacePhoto;
  companyId: number;
  punchedAt: string;
  location: PhoneLocation;
}): Promise<AttendanceRecord> {
  return requestFace<AttendanceRecord>('/api/v1/attendance/mark', {
    method: 'POST',
    body: photoForm(input.photo, {
      company_id: String(input.companyId),
      punched_at: input.punchedAt,
      latitude: String(input.location.latitude),
      longitude: String(input.location.longitude),
      ...(input.location.accuracy == null
        ? {}
        : { accuracy_meters: String(input.location.accuracy) }),
    }),
  });
}

export async function getFaceAttendance(input: {
  companyId: number;
  employeeId: number;
  attendanceDate: string;
}): Promise<AttendanceRecord[]> {
  const result = await requestFace<{ records: AttendanceRecord[] }>(
    `/api/v1/attendance?company_id=${input.companyId}&employee_id=${input.employeeId}&attendance_date=${input.attendanceDate}`,
  );
  return result.records ?? [];
}

export function verifyFace(input: {
  photo: FacePhoto;
  companyId: number;
  employeeId: number;
}): Promise<FaceMatch> {
  return requestFace<FaceMatch>('/api/v1/faces/verify', {
    method: 'POST',
    body: photoForm(input.photo, {
      company_id: String(input.companyId),
      employee_id: String(input.employeeId),
    }),
  });
}
