import * as FileSystem from 'expo-file-system/legacy';
import { FACE_API_KEY, FACE_API_URL } from '../../config/api';
import type { AttendanceRecord, FaceEnrollment, FaceMatch, FacePhoto, PhoneLocation } from '../../types/face';
import { ApiError } from '../client/client';
import { localFileForUpload } from '../client/fileManagerClient';

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
      `Cannot reach the face service at ${FACE_API_URL}. The phone could not open that address.`,
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

async function uploadFace<T>(
  path: string,
  photo: FacePhoto,
  fields: Record<string, string>,
): Promise<T> {
  const fileName = photo.fileName?.trim() || 'face.jpg';
  const copied = await localFileForUpload(photo.uri, fileName);
  const fileUri = copied.startsWith('/') ? `file://${copied}` : copied;
  const parameters: Record<string, string> = {};
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== '') {
      parameters[key] = value;
    }
  });

  let result: FileSystem.FileSystemUploadResult;
  try {
    result = await FileSystem.uploadAsync(`${FACE_API_URL}${path}`, fileUri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'image',
      mimeType: photo.mimeType || 'image/jpeg',
      parameters,
      headers: faceHeaders(),
    });
  } catch {
    throw new ApiError(
      `Cannot reach the face service at ${FACE_API_URL}. The phone could not open that address.`,
    );
  }

  let payload: unknown = null;
  if (result.body) {
    try {
      payload = JSON.parse(result.body) as unknown;
    } catch {
      payload = result.body;
    }
  }

  if (result.status < 200 || result.status >= 300) {
    const fallback =
      result.status === 401
        ? 'Face service rejected the API key.'
        : `Face service request failed (${result.status}).`;
    throw new ApiError(errorMessage(payload, fallback));
  }

  return payload as T;
}

export function getFaceEnrollment(
  companyId: number,
  employeeId: number,
): Promise<FaceEnrollment> {
  return requestFace<FaceEnrollment>(`/api/v1/faces/${companyId}/${employeeId}`);
}

export async function enrollFace(input: {
  photo: FacePhoto;
  companyId: number;
  employeeId: number;
  employeeName: string;
  replace?: boolean;
}): Promise<FaceEnrollment> {
  return uploadFace<FaceEnrollment>('/api/v1/faces/enroll', input.photo, {
    company_id: String(input.companyId),
    employee_id: String(input.employeeId),
    employee_name: input.employeeName,
    replace: input.replace === false ? 'false' : 'true',
  });
}

export async function markFaceAttendance(input: {
  photo: FacePhoto;
  companyId: number;
  punchedAt: string;
  location: PhoneLocation;
}): Promise<AttendanceRecord> {
  return uploadFace<AttendanceRecord>('/api/v1/attendance/mark', input.photo, {
    company_id: String(input.companyId),
    punched_at: input.punchedAt,
    latitude: String(input.location.latitude),
    longitude: String(input.location.longitude),
    ...(input.location.accuracy == null
      ? {}
      : { accuracy_meters: String(input.location.accuracy) }),
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

export async function verifyFace(input: {
  photo: FacePhoto;
  companyId: number;
  employeeId: number;
}): Promise<FaceMatch> {
  return uploadFace<FaceMatch>('/api/v1/faces/verify', input.photo, {
    company_id: String(input.companyId),
    employee_id: String(input.employeeId),
  });
}
