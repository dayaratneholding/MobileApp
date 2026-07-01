import { API_URL } from '../../config/api';
import type { ApiResult, LoginData } from '../../types/api';
import { ApiError } from './client';

export type LoginFields = {
  UserID: string;
  ComSerialID: number;
  Password: string;
};

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

function isHtmlResponse(text: string): boolean {
  const trimmed = text.trimStart().toLowerCase();
  return trimmed.startsWith('<!doctype') || trimmed.startsWith('<html');
}

function firewallBlockedMessage(status: number): string {
  return [
    `Login blocked by server firewall (HTTP ${status}).`,
    'Your username/password are likely correct.',
    'The server allows company list (JSON) but blocks login (form data) from mobile.',
    'Please ask your backend/IT team to whitelist:',
    '/api/v1/core/Auth/login for mobile apps',
    'OR add a JSON login endpoint for mobile.',
  ].join('\n');
}

function parseLoginResponse(text: string, status: number): ApiResult<LoginData> {
  if (!text) {
    throw new ApiError(`Empty response from server (HTTP ${status}).`);
  }

  if (status === 403 && isHtmlResponse(text)) {
    throw new ApiError(firewallBlockedMessage(status));
  }

  if (isHtmlResponse(text)) {
    throw new ApiError(
      `Server returned HTML instead of JSON (HTTP ${status}).`,
    );
  }

  try {
    return JSON.parse(text) as ApiResult<LoginData>;
  } catch {
    throw new ApiError(
      `Unexpected server response (HTTP ${status}): ${text.slice(0, 100)}`,
    );
  }
}

function buildUrlEncodedBody(fields: LoginFields): string {
  return [
    `UserID=${encodeURIComponent(fields.UserID)}`,
    `ComSerialID=${encodeURIComponent(String(fields.ComSerialID))}`,
    `Password=${encodeURIComponent(fields.Password)}`,
  ].join('&');
}

function applyCommonHeaders(xhr: XMLHttpRequest) {
  xhr.setRequestHeader('Accept', 'application/json, text/plain, */*');
  xhr.setRequestHeader('User-Agent', BROWSER_USER_AGENT);
  xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
}

function xhrPost(
  url: string,
  body: string | FormData,
  contentType?: string,
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    applyCommonHeaders(xhr);
    if (contentType) {
      xhr.setRequestHeader('Content-Type', contentType);
    }
    xhr.timeout = 30000;

    xhr.onload = () => {
      resolve({
        status: xhr.status,
        text: xhr.responseText ?? '',
      });
    };

    xhr.onerror = () => {
      reject(
        new ApiError(
          `Network error (HTTP ${xhr.status || 0}). Phone cannot reach server.`,
        ),
      );
    };

    xhr.ontimeout = () => {
      reject(new ApiError('Login request timed out. Check your Wi-Fi connection.'));
    };

    xhr.send(body);
  });
}

async function tryUrlEncodedLogin(
  url: string,
  fields: LoginFields,
): Promise<ApiResult<LoginData>> {
  const body = buildUrlEncodedBody(fields);

  if (__DEV__) {
    console.log('[Login] XHR urlencoded ->', url);
    console.log('[Login] UserID:', fields.UserID, 'ComSerialID:', fields.ComSerialID);
  }

  const { status, text } = await xhrPost(
    url,
    body,
    'application/x-www-form-urlencoded',
  );

  if (__DEV__) {
    console.log('[Login] Response status:', status);
    console.log('[Login] Response preview:', text.slice(0, 200));
  }

  return parseLoginResponse(text, status);
}

async function tryMultipartLogin(
  url: string,
  fields: LoginFields,
): Promise<ApiResult<LoginData>> {
  const form = new FormData();
  form.append('UserID', fields.UserID);
  form.append('ComSerialID', String(fields.ComSerialID));
  form.append('Password', fields.Password);

  if (__DEV__) {
    console.log('[Login] XHR multipart ->', url);
  }

  const { status, text } = await xhrPost(url, form);
  return parseLoginResponse(text, status);
}

export async function postLogin(
  fields: LoginFields,
): Promise<ApiResult<LoginData>> {
  const url = `${API_URL}/Auth/login`;

  try {
    return await tryUrlEncodedLogin(url, fields);
  } catch (error) {
    if (error instanceof ApiError && error.message.includes('firewall')) {
      throw error;
    }
  }

  try {
    return await tryMultipartLogin(url, fields);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('Login request failed. Please try again.');
  }
}
