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

export function setActiveChatGroup(groupId: string | null) {
  activeGroupId = groupId;
}

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
    trigger: null,
  });

  return message;
}
