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
