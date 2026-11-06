export type MessageType = 'Text' | 'Image' | 'Audio' | 'Video' | 'File';

export type GroupSummary = {
  id: string;
  name: string;
  photoUrl?: string | null;
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  unreadCount: number;
};

export type ChatMessage = {
  id: string;
  groupId: string;
  senderId: string;
  type: MessageType;
  body?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  size?: number | null;
  duration?: number | null;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
};

export type SendMessageInput = {
  id: string;
  type: MessageType;
  body?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  size?: number | null;
  duration?: number | null;
};
