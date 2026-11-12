import { chatRequest } from '../client/chatClient';
import type { ChatMessage, GroupSummary, SendMessageInput } from '../../types/chat';

export function listGroups(): Promise<GroupSummary[]> {
  return chatRequest<GroupSummary[]>('/groups');
}

export function createGroup(name: string, memberUserIds: string[]): Promise<GroupSummary> {
  return chatRequest<GroupSummary>('/groups', {
    method: 'POST',
    body: JSON.stringify({ name, memberUserIds }),
  });
}

export type GroupMember = {
  userID: string;
  userName: string;
};

function readMemberText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function parseGroupMembers(body: unknown): GroupMember[] {
  const source = Array.isArray(body)
    ? body
    : body && typeof body === 'object'
      ? ((body as { members?: unknown; data?: unknown; items?: unknown }).members ??
        (body as { data?: unknown }).data ??
        (body as { items?: unknown }).items)
      : null;
  if (!Array.isArray(source)) return [];

  const members: GroupMember[] = [];
  for (const item of source) {
    if (typeof item === 'string' && item.trim()) {
      members.push({ userID: item.trim(), userName: item.trim() });
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const userID = readMemberText(
      record.userID ?? record.UserID ?? record.userId ?? record.UserId ?? record.id ?? record.Id,
    );
    if (!userID) continue;
    const userName = readMemberText(
      record.userName ?? record.UserName ?? record.name ?? record.Name,
    );
    members.push({ userID, userName: userName || userID });
  }
  return members;
}

export async function listGroupMembers(groupId: string): Promise<GroupMember[]> {
  try {
    const body = await chatRequest<unknown>(`/groups/${groupId}/members`);
    return parseGroupMembers(body);
  } catch {
    return [];
  }
}

export function addGroupMember(groupId: string, userId: string): Promise<void> {
  return chatRequest<void>(`/groups/${groupId}/members`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

export function listMessages(
  groupId: string,
  before?: string,
  limit = 50,
): Promise<ChatMessage[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (before) {
    params.set('before', before);
  }

  return chatRequest<ChatMessage[]>(`/groups/${groupId}/messages?${params.toString()}`);
}

export function sendMessage(groupId: string, message: SendMessageInput): Promise<ChatMessage> {
  return chatRequest<ChatMessage>(`/groups/${groupId}/messages`, {
    method: 'POST',
    body: JSON.stringify(message),
  });
}

export function deleteMessage(groupId: string, messageId: string): Promise<void> {
  return chatRequest<void>(`/groups/${groupId}/messages/${messageId}`, {
    method: 'DELETE',
  });
}

export function registerChatDevice(platform: string, pushToken: string): Promise<void> {
  return chatRequest<void>('/devices', {
    method: 'POST',
    body: JSON.stringify({ platform, pushToken }),
  });
}

export function unregisterChatDevice(pushToken: string): Promise<void> {
  const params = new URLSearchParams({ pushToken });
  return chatRequest<void>(`/devices?${params.toString()}`, { method: 'DELETE' });
}

export function markGroupRead(groupId: string, messageId: string): Promise<void> {
  return chatRequest<void>(`/groups/${groupId}/read`, {
    method: 'POST',
    body: JSON.stringify({ messageId }),
  });
}
