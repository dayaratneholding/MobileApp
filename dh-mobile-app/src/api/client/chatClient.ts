import { resolveChatBase } from '../../config/serviceHosts';
import { getAuthToken } from '../../services/authToken';
import { ApiError } from './client';

let chatUserId = '';
let chatCompanyId = '';

/** The chat API reads these on every request, the same way the hub does. */
export function setChatIdentity(userID: string, comSerialID: number) {
  chatUserId = userID.trim();
  chatCompanyId = String(comSerialID);
}

function withIdentity(path: string): string {
  const [pathname, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  if (chatUserId) params.set('userID', chatUserId);
  if (chatCompanyId) params.set('comSerialID', chatCompanyId);
  const next = params.toString();
  return next ? `${pathname}?${next}` : pathname;
}

function errorMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const record = body as { message?: string; title?: string; messages?: unknown };
    if (record.message) return record.message;
    if (Array.isArray(record.messages)) {
      const first = record.messages.find((item) => typeof item === 'string' && item.trim());
      if (typeof first === 'string') return first;
    }
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

  const base = await resolveChatBase();
  let response: Response;
  try {
    response = await fetch(`${base}${withIdentity(path)}`, {
      ...init,
      headers,
    });
  } catch {
    throw new ApiError(`Cannot reach the chat server (${base}). The phone could not resolve the chat address.`);
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
