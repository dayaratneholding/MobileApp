import { HCM_API_URL } from '../../config/api';
import type { ApiResult } from '../../types/api';
import { getAuthToken } from '../../services/authToken';
import { ApiError } from './client';

function logHcm(
  path: string,
  details: Record<string, unknown>,
) {
  if (__DEV__) {
    console.log(`[HCM] ${path}`, details);
  }
}

async function parseJson<T>(
  response: Response,
  path: string,
): Promise<{ parsed: T; raw: string }> {
  const text = await response.text();
  if (!text) {
    throw new ApiError('Empty response from HCM server.');
  }

  const trimmed = text.trimStart().toLowerCase();
  if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html')) {
    throw new ApiError('HCM server returned an HTML error page.');
  }

  try {
    return { parsed: JSON.parse(text) as T, raw: text };
  } catch {
    const asNumber = Number(text);
    if (!Number.isNaN(asNumber)) {
      logHcm(path, { note: 'Parsed plain-text number response', raw: text });
      return { parsed: asNumber as T, raw: text };
    }

    throw new ApiError(`Unexpected HCM response: ${text.slice(0, 120)}`);
  }
}

export async function postHcmJson<TResponse, TBody>(
  path: string,
  body: TBody,
): Promise<TResponse> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${HCM_API_URL}${path}`;
  const requestBody = JSON.stringify(body);

  logHcm(path, {
    url,
    hasToken: Boolean(token),
    request: body,
  });

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: requestBody,
    });
  } catch (err) {
    logHcm(path, { networkError: String(err) });
    throw new ApiError(
      `Cannot reach HCM server (${HCM_API_URL}). Check that the server is online and reachable from your network.`,
    );
  }

  const { parsed: result, raw } = await parseJson<TResponse>(response, path);

  logHcm(path, {
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
        : `HCM request failed (${response.status}).`;
    throw new ApiError(
      apiResult.messages?.[0] ?? fallback,
      apiResult.messages ?? undefined,
    );
  }

  return result;
}

export async function putHcmJson<TResponse, TBody>(
  path: string,
  body: TBody,
): Promise<TResponse> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${HCM_API_URL}${path}`;
  const requestBody = JSON.stringify(body);

  logHcm(path, {
    url,
    hasToken: Boolean(token),
    request: body,
  });

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'PUT',
      headers,
      body: requestBody,
    });
  } catch (err) {
    logHcm(path, { networkError: String(err) });
    throw new ApiError(
      `Cannot reach HCM server (${HCM_API_URL}). Check that the server is online and reachable from your network.`,
    );
  }

  const { parsed: result, raw } = await parseJson<TResponse>(response, path);

  logHcm(path, {
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
        : `HCM request failed (${response.status}).`;
    throw new ApiError(
      apiResult.messages?.[0] ?? fallback,
      apiResult.messages ?? undefined,
    );
  }

  return result;
}

function buildQueryString(
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const pairs: string[] = [];

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    pairs.push(
      `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    );
  });

  return pairs.length > 0 ? `?${pairs.join('&')}` : '';
}

export async function getHcmJson<TResponse>(
  path: string,
  query?: Record<string, string | number | boolean | undefined | null>,
): Promise<TResponse> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const queryString = query ? buildQueryString(query) : '';
  const url = `${HCM_API_URL}${path}${queryString}`;

  logHcm(path, {
    url,
    hasToken: Boolean(token),
    query,
  });

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers,
    });
  } catch (err) {
    logHcm(path, { networkError: String(err) });
    throw new ApiError(
      `Cannot reach HCM server (${HCM_API_URL}). Check that the server is online and reachable from your network.`,
    );
  }

  const { parsed: result, raw } = await parseJson<TResponse>(response, path);

  logHcm(path, {
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
        : `HCM request failed (${response.status}).`;
    throw new ApiError(
      apiResult.messages?.[0] ?? fallback,
      apiResult.messages ?? undefined,
    );
  }

  return result;
}
