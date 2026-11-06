import { CHAT_API_URL } from '../../config/api';
import { getAuthToken } from '../../services/authToken';
import { ApiError } from './client';

function errorMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const record = body as { message?: string; title?: string };
    if (record.message) return record.message;
    if (record.title) return record.title;
  }

  if (typeof body === 'string' && body.trim()) {
    return body.slice(0, 180);
  }

  return `Chat request failed (${status}).`;
}

export async function chatRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${CHAT_API_URL}${path}`, {
      ...init,
      headers,
    });
  } catch {
    throw new ApiError(`Cannot reach the chat server (${CHAT_API_URL}).`);
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    throw new ApiError(errorMessage(body, response.status));
  }

  return body as T;
}
