import type { ChatMessage, MessageType } from '../../types/chat';

export function createMessageId(): string {
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function readString(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string') return value;
  }
  return '';
}

function readNullableString(record: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string') return value;
    if (value === null) return null;
  }
  return null;
}

const MESSAGE_TYPES: MessageType[] = ['Text', 'Image', 'Audio', 'Video', 'File'];

export function parseChatMessage(raw: unknown): ChatMessage | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const id = readString(record, 'id', 'Id');
  const groupId = readString(record, 'groupId', 'GroupId');
  if (!id || !groupId) return null;

  const typeValue = readString(record, 'type', 'Type');
  const type = MESSAGE_TYPES.find((item) => item.toLowerCase() === typeValue.toLowerCase()) ?? 'Text';

  return {
    id,
    groupId,
    senderId: readString(record, 'senderId', 'SenderId'),
    type,
    body: readNullableString(record, 'body', 'Body'),
    fileUrl: readNullableString(record, 'fileUrl', 'FileUrl'),
    fileName: readNullableString(record, 'fileName', 'FileName'),
    size: typeof record.size === 'number' ? record.size : typeof record.Size === 'number' ? record.Size : null,
    duration:
      typeof record.duration === 'number'
        ? record.duration
        : typeof record.Duration === 'number'
          ? record.Duration
          : null,
    createdAt: readString(record, 'createdAt', 'CreatedAt'),
    editedAt: readNullableString(record, 'editedAt', 'EditedAt'),
    deletedAt: readNullableString(record, 'deletedAt', 'DeletedAt'),
  };
}

export function messagePreview(message: ChatMessage): string {
  if (message.deletedAt) return 'Message deleted';
  if (message.type === 'Text') return message.body?.trim() || 'Message';
  if (message.type === 'Image') return 'Photo';
  if (message.type === 'Audio') return 'Voice note';
  if (message.type === 'Video') return 'Video';
  return message.fileName || 'File';
}

export function formatChatTime(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function sortMessages(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function upsertMessage(messages: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  const index = messages.findIndex((item) => item.id === incoming.id);
  if (index === -1) {
    return sortMessages([...messages, incoming]);
  }

  const next = messages.slice();
  next[index] = incoming;
  return sortMessages(next);
}
