import { MOBILE_APP_API_URL } from '../../config/api';
import type { ApiResult } from '../../types/api';
import { getAuthToken } from '../../services/authToken';
import { ApiError } from './client';

function logMobileApp(path: string, details: Record<string, unknown>) {
  if (__DEV__) {
    console.log(`[MobileApp] ${path}`, details);
  }
}

async function parseJson<T>(
  response: Response,
  path: string,
): Promise<{ parsed: T; raw: string }> {
  const text = await response.text();
  if (!text) {
    throw new ApiError('Empty response from MobileApp server.');
  }

  const trimmed = text.trimStart().toLowerCase();
  if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html')) {
    throw new ApiError('MobileApp server returned an HTML error page.');
  }

  try {
    return { parsed: JSON.parse(text) as T, raw: text };
  } catch {
    throw new ApiError(`Unexpected MobileApp response: ${text.slice(0, 120)}`);
  }
}

export async function getMobileAppJson<TResponse>(path: string): Promise<TResponse> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${MOBILE_APP_API_URL}${path}`;

  logMobileApp(path, {
    url,
    hasToken: Boolean(token),
  });

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers,
    });
  } catch (err) {
    logMobileApp(path, { networkError: String(err) });
    throw new ApiError(
      `Cannot reach MobileApp server (${MOBILE_APP_API_URL}). Check that the server is online.`,
    );
  }

  const { parsed: result, raw } = await parseJson<TResponse>(response, path);

  logMobileApp(path, {
    status: response.status,
    ok: response.ok,
    response: result,
    raw: raw.slice(0, 500),
  });

  if (!response.ok) {
    const apiResult = result as ApiResult<unknown>;
    const fallback =
      response.status === 401
        ? 'Session expired or not authorized. Please log in again.'
        : `MobileApp request failed (${response.status}).`;
    throw new ApiError(apiResult.messages?.[0] ?? fallback, apiResult.messages ?? undefined);
  }

  return result;
}
