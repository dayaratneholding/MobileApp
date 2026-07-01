import { API_URL } from '../../config/api';
import type { ApiResult } from '../../types/api';
import { getAuthToken } from '../../services/authToken';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly messages?: string[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function isHtmlResponse(text: string): boolean {
  const trimmed = text.trimStart().toLowerCase();
  return trimmed.startsWith('<!doctype') || trimmed.startsWith('<html');
}

function buildUrlEncodedBody(fields: Record<string, string | number>): string {
  return Object.entries(fields)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
    .join('&');
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    throw new ApiError('Empty response from server.');
  }

  if (isHtmlResponse(text)) {
    throw new ApiError(
      'Server returned an HTML error page. Please check your username, company, and password.',
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(
      `Unexpected server response: ${text.slice(0, 120)}`,
    );
  }
}

export async function postJson<TResponse, TBody>(
  path: string,
  body: TBody,
  auth = false,
): Promise<TResponse> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (auth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const result = await parseJson<TResponse>(response);

  if (!response.ok) {
    const apiResult = result as ApiResult<unknown>;
    throw new ApiError(
      apiResult.messages?.[0] ?? `Request failed (${response.status}).`,
      apiResult.messages ?? undefined,
    );
  }

  return result;
}

function buildMultipartBody(
  fields: Record<string, string | number>,
  boundary: string,
): string {
  const lines: string[] = [];

  Object.entries(fields).forEach(([key, value]) => {
    lines.push(`--${boundary}`);
    lines.push(`Content-Disposition: form-data; name="${key}"`);
    lines.push('');
    lines.push(String(value));
  });

  lines.push(`--${boundary}--`);
  lines.push('');

  return lines.join('\r\n');
}

export async function postMultipart<TResponse>(
  path: string,
  fields: Record<string, string | number>,
): Promise<TResponse> {
  const boundary = `----RNFormBoundary${Date.now()}`;
  const body = buildMultipartBody(fields, boundary);

  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  const result = await parseJson<TResponse>(response);

  if (!response.ok) {
    const apiResult = result as ApiResult<unknown>;
    throw new ApiError(
      apiResult.messages?.[0] ?? `Request failed (${response.status}).`,
      apiResult.messages ?? undefined,
    );
  }

  return result;
}

export async function postUrlEncoded<TResponse>(
  path: string,
  fields: Record<string, string | number>,
): Promise<TResponse> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: buildUrlEncodedBody(fields),
  });

  const result = await parseJson<TResponse>(response);

  if (!response.ok) {
    const apiResult = result as ApiResult<unknown>;
    throw new ApiError(
      apiResult.messages?.[0] ?? `Request failed (${response.status}).`,
      apiResult.messages ?? undefined,
    );
  }

  return result;
}

export async function postForm<TResponse>(
  path: string,
  fields: Record<string, string | number>,
): Promise<TResponse> {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    formData.append(key, String(value));
  });

  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/plain, */*',
    },
    body: formData,
  });

  const result = await parseJson<TResponse>(response);

  if (!response.ok) {
    const apiResult = result as ApiResult<unknown>;
    throw new ApiError(
      apiResult.messages?.[0] ?? `Request failed (${response.status}).`,
      apiResult.messages ?? undefined,
    );
  }

  return result;
}

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}
