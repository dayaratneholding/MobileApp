import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { registerChatDevice } from '../api/endpoints/chat';
import { messagePreview, parseChatMessage } from '../features/chat/chatModel';
import type { ChatMessage } from '../types/chat';

const PROJECT_ID = '1e73c65b-5f74-4b12-a303-2012f9018f35';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let activeGroupId: string | null = null;
let notificationsReady = false;
let registeredPushToken: string | null = null;
let pendingGroupId: string | null = null;
const openedListeners = new Set<(groupId: string) => void>();

function readGroupId(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const groupId = (data as { groupId?: unknown }).groupId;
  return typeof groupId === 'string' && groupId.trim() ? groupId : null;
}

function rememberOpenedGroup(data: unknown) {
  const groupId = readGroupId(data);
  if (!groupId) return;
  pendingGroupId = groupId;
  openedListeners.forEach((listener) => listener(groupId));
}

export function setActiveChatGroup(groupId: string | null) {
  activeGroupId = groupId;
}

export function subscribeOpenedChat(listener: (groupId: string) => void) {
  openedListeners.add(listener);
  if (pendingGroupId) listener(pendingGroupId);
  return () => {
    openedListeners.delete(listener);
  };
}

export function peekPendingChatGroup() {
  return pendingGroupId;
}

export function clearPendingChatGroup() {
  pendingGroupId = null;
}

Notifications.addNotificationResponseReceivedListener((response) => {
  rememberOpenedGroup(response.notification.request.content.data);
});

Notifications.getLastNotificationResponseAsync()
  .then((response) => {
    if (response) rememberOpenedGroup(response.notification.request.content.data);
  })
  .catch(() => undefined);

export function getRegisteredPushToken() {
  return registeredPushToken;
}

export async function prepareChatNotifications(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('chat', {
      name: 'Messages',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  notificationsReady = status === 'granted';
  if (!notificationsReady) return;

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    registeredPushToken = token.data;
    await registerChatDevice(Platform.OS, token.data);
  } catch {
    registeredPushToken = null;
  }
}

export async function notifyIncomingMessage(
  raw: unknown,
  currentUserId: string,
  groupName?: string,
): Promise<ChatMessage | null> {
  const message = parseChatMessage(raw);
  if (!message || message.deletedAt) return message;
  if (message.senderId.trim().toLowerCase() === currentUserId.trim().toLowerCase()) return message;
  if (activeGroupId === message.groupId) return message;
  if (!notificationsReady) return message;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: groupName || 'New message',
      body: `${message.senderId}: ${messagePreview(message)}`,
      sound: 'default',
      data: { groupId: message.groupId },
    },
    trigger: Platform.OS === 'android' ? { channelId: 'chat' } : null,
  });

  return message;
}
