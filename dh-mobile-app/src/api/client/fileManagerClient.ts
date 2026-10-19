import { FILE_MANAGER_API_URL } from '../../config/api';
import { getAuthToken } from '../../services/authToken';
import { ApiError } from './client';

export type FileUploadResultItem = {
  name: string;
  path: string;
  sizeBytes: number;
  extension: string;
  isImage: boolean;
  modifiedUtc: string;
  viewUrl: string;
  downloadUrl: string;
};

export type FileUploadResponse = {
  uploaded: FileUploadResultItem[];
  errors: string[];
};

export type UploadFilePart = {
  uri: string;
  name: string;
  type: string;
};

function logFm(path: string, details: Record<string, unknown>) {
  if (__DEV__) {
    console.log(`[FileManager] ${path}`, details);
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  const trimmed = text.trimStart().toLowerCase();
  if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html')) {
    throw new ApiError('File Manager returned an HTML error page.');
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(`Unexpected File Manager response: ${text.slice(0, 120)}`);
  }
}

function isAlreadyExistsError(status: number, body: unknown): boolean {
  const msg = String(
    (body as { message?: string })?.message ??
      (typeof body === 'string' ? body : '') ??
      '',
  ).toLowerCase();

  return (
    status === 409 ||
    ((status === 400 || status === 403) &&
      (msg.includes('exist') || msg.includes('already')))
  );
}

/**
 * Step 1 — create folder
 * POST /api/folders  body: { path }
 */
export async function createFolder(folderPath: string): Promise<unknown> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${FILE_MANAGER_API_URL}folders`;
  const body = { path: folderPath };

  logFm('folders', { url, body, hasToken: Boolean(token) });

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch (err) {
    logFm('folders', { networkError: String(err) });
    throw new ApiError(
      `Cannot reach File Manager (${FILE_MANAGER_API_URL}). Check that the server is online.`,
    );
  }

  const result = await parseJson<unknown>(response);
  logFm('folders', { status: response.status, ok: response.ok, result });

  if (!response.ok && !isAlreadyExistsError(response.status, result)) {
    const message =
      (result as { message?: string })?.message ||
      `Create folder failed (${response.status}).`;
    throw new ApiError(message);
  }

  return result;
}

/**
 * Step 2 — upload files
 * POST /api/files/upload
 * multipart: path, overwrite, files
 */
export async function uploadFiles(
  path: string,
  files: UploadFilePart[],
  overwrite = true,
): Promise<FileUploadResponse> {
  const token = getAuthToken();
  const formData = new FormData();

  formData.append('path', path || '');
  formData.append('overwrite', String(!!overwrite));

  files.forEach((file) => {
    formData.append('files', {
      uri: file.uri,
      name: file.name,
      type: file.type || 'application/octet-stream',
    } as unknown as Blob);
  });

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${FILE_MANAGER_API_URL}files/upload`;
  logFm('files/upload', {
    url,
    path,
    overwrite,
    fileNames: files.map((f) => f.name),
    hasToken: Boolean(token),
  });

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });
  } catch (err) {
    logFm('files/upload', { networkError: String(err) });
    throw new ApiError(
      `Cannot reach File Manager (${FILE_MANAGER_API_URL}). Check that the server is online.`,
    );
  }

  const result = await parseJson<FileUploadResponse>(response);
  logFm('files/upload', { status: response.status, ok: response.ok, result });

  if (!response.ok) {
    const message =
      (result as unknown as { message?: string })?.message ||
      result?.errors?.[0] ||
      `File upload failed (${response.status}).`;
    throw new ApiError(message);
  }

  if (result?.errors?.length && !result.uploaded?.length) {
    throw new ApiError(result.errors[0] || 'File upload failed.');
  }

  return result;
}
