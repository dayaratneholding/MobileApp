import { API_URL } from '../../config/api';
import { getAuthToken } from '../../services/authToken';
import { ApiError } from '../client/client';

export type CoreUser = {
  userSerialID: number;
  eeSerialID: number | null;
  userID: string;
  userName: string;
};

function readText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function asUser(raw: unknown): CoreUser | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const userID = readText(record.userID ?? record.UserID ?? record.userId ?? record.UserId);
  if (!userID) return null;

  const userName = readText(record.userName ?? record.UserName ?? record.user_name);
  const serial = record.userSerialID ?? record.UserSerialID;
  const employee = record.eeSerialID ?? record.EESerialID ?? record.eESerialID;

  return {
    userSerialID: typeof serial === 'number' ? serial : Number(serial) || 0,
    eeSerialID: typeof employee === 'number' ? employee : employee == null ? null : Number(employee) || null,
    userID,
    userName: userName || userID,
  };
}

function resultMessage(body: unknown): string {
  if (!body || typeof body !== 'object') {
    return typeof body === 'string' && body.trim() ? body.trim() : '';
  }

  const record = body as { message?: unknown; messages?: unknown; title?: unknown };
  if (typeof record.message === 'string' && record.message.trim()) return record.message.trim();
  if (Array.isArray(record.messages)) {
    const first = record.messages.find((item) => typeof item === 'string' && item.trim());
    if (typeof first === 'string') return first.trim();
  }
  if (typeof record.title === 'string' && record.title.trim()) return record.title.trim();
  return '';
}

function collectUsers(body: unknown, into: CoreUser[]) {
  if (Array.isArray(body)) {
    body.forEach((item) => {
      const user = asUser(item);
      if (user) into.push(user);
    });
    return;
  }

  if (!body || typeof body !== 'object') return;
  const record = body as Record<string, unknown>;
  if (record.succeeded === false) return;

  if (Array.isArray(record.data)) {
    collectUsers(record.data, into);
    return;
  }

  if (record.data && typeof record.data === 'object') {
    collectUsers((record.data as { data?: unknown }).data, into);
  }
}

function pageInfo(body: unknown): { hasNext: boolean; page: number } {
  if (!body || typeof body !== 'object') return { hasNext: false, page: 1 };
  const record = body as Record<string, unknown>;
  const page =
    record.data && typeof record.data === 'object'
      ? (record.data as Record<string, unknown>)
      : record;

  return {
    hasNext: page.hasNextPage === true,
    page: typeof page.currentPage === 'number' ? page.currentPage : 1,
  };
}

async function getJson(path: string): Promise<unknown> {
  const token = getAuthToken();
  const headers: Record<string, string> = { Accept: 'application/json, text/plain, */*' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { headers });
  } catch {
    throw new ApiError('Cannot reach the user list.');
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
    throw new ApiError(resultMessage(body) || `Could not load users (${response.status}).`);
  }

  const message = resultMessage(body);
  if (body && typeof body === 'object' && (body as { succeeded?: boolean }).succeeded === false) {
    throw new ApiError(message || 'Could not load users.');
  }

  return body;
}

async function loadPagedUsers(): Promise<CoreUser[]> {
  const users: CoreUser[] = [];
  let page = 1;

  while (page <= 20) {
    const body = await getJson(`/Auth/paged?PageNumber=${page}&PageSize=200`);
    const before = users.length;
    collectUsers(body, users);
    const info = pageInfo(body);
    if (!info.hasNext || users.length === before) break;
    page = info.page + 1;
  }

  return users;
}

function mergeUsers(lists: CoreUser[][]): CoreUser[] {
  const byId = new Map<string, CoreUser>();
  lists.flat().forEach((user) => {
    const key = user.userID.toLowerCase();
    if (!byId.has(key)) byId.set(key, user);
  });
  return [...byId.values()].sort((a, b) => a.userName.localeCompare(b.userName));
}

export async function getAllUsers(): Promise<CoreUser[]> {
  const [directory, everyone] = await Promise.allSettled([loadPagedUsers(), getJson('/Auth/getall')]);

  const lists: CoreUser[][] = [];
  const errors: string[] = [];

  if (directory.status === 'fulfilled') {
    lists.push(directory.value);
  } else {
    errors.push(directory.reason instanceof Error ? directory.reason.message : 'Could not load users.');
  }

  if (everyone.status === 'fulfilled') {
    const fromGetAll: CoreUser[] = [];
    collectUsers(everyone.value, fromGetAll);
    lists.push(fromGetAll);
  } else {
    errors.push(everyone.reason instanceof Error ? everyone.reason.message : 'Could not load users.');
  }

  const users = mergeUsers(lists);
  if (users.length > 0) return users;

  throw new ApiError(errors.find((message) => message.trim()) || 'Could not load users.');
}
