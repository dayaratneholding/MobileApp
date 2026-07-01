import axios from 'axios';
import { API_URL } from '../../config/api';
import type { ApiResult, LoginData } from '../../types/api';
import { ApiError } from './client';

export type LoginFields = {
  UserID: string;
  ComSerialID: number;
  Password: string;
};

function isHtmlResponse(text: string): boolean {
  const trimmed = text.trimStart().toLowerCase();
  return trimmed.startsWith('<!doctype') || trimmed.startsWith('<html');
}

function parseLoginResponse(text: string): ApiResult<LoginData> {
  if (!text) {
    throw new ApiError('Empty response from server.');
  }

  if (isHtmlResponse(text)) {
    throw new ApiError(
      'Server returned an HTML error page. Please check your username, company, and password.',
    );
  }

  try {
    return JSON.parse(text) as ApiResult<LoginData>;
  } catch {
    throw new ApiError(`Unexpected server response: ${text.slice(0, 120)}`);
  }
}

function buildUrlEncodedBody(fields: LoginFields): string {
  return [
    `UserID=${encodeURIComponent(fields.UserID)}`,
    `ComSerialID=${encodeURIComponent(String(fields.ComSerialID))}`,
    `Password=${encodeURIComponent(fields.Password)}`,
  ].join('&');
}

async function tryMultipartLogin(
  url: string,
  fields: LoginFields,
): Promise<ApiResult<LoginData>> {
  const form = new FormData();
  form.append('UserID', fields.UserID);
  form.append('ComSerialID', String(fields.ComSerialID));
  form.append('Password', fields.Password);

  const response = await axios.post<string>(url, form, {
    headers: {
      Accept: 'application/json, text/plain, */*',
    },
    timeout: 30000,
    transformResponse: [(data) => data],
    responseType: 'text',
  });

  return parseLoginResponse(response.data);
}

async function tryUrlEncodedLogin(
  url: string,
  fields: LoginFields,
): Promise<ApiResult<LoginData>> {
  const response = await axios.post<string>(url, buildUrlEncodedBody(fields), {
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeout: 30000,
    transformResponse: [(data) => data],
    responseType: 'text',
  });

  return parseLoginResponse(response.data);
}

export async function postLogin(
  fields: LoginFields,
): Promise<ApiResult<LoginData>> {
  const url = `${API_URL}/Auth/login`;
  const attempts = [
    () => tryMultipartLogin(url, fields),
    () => tryUrlEncodedLogin(url, fields),
  ];

  let lastError: unknown;

  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof ApiError) {
    throw lastError;
  }

  throw new ApiError('Login request failed. Please try again.');
}
