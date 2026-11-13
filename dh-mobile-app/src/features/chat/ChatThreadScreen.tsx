import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import type { HubConnection } from '@microsoft/signalr';
import {
  absoluteFileUrl,
  createFolder,
  downloadSharedFile,
  localFileForUpload,
  uploadFiles,
  viewSharedFile,
} from '../../api/client/fileManagerClient';
import { getApiErrorMessage } from '../../api/client/client';
import {
  deleteMessage,
  listGroupMembers,
  listMessages,
  markGroupRead,
  sendMessage,
  setMessageReaction,
  type GroupMember,
} from '../../api/endpoints/chat';
import { getAllUsers } from '../../api/endpoints/users';
import { ensureChatHub } from '../../services/chatHub';
import {
  radius,
  spacing,
  type ShadowTokens,
  typography,
  type ColorPalette,
} from '../../styles/theme';
import { useTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { ChatMessage, GroupSummary, MessageType } from '../../types/chat';
import {
  createMessageId,
  mentionQuery,
  messagePreview,
  parseChatInstant,
  parseChatMessage,
  parseMessageReactions,
  sortMessages,
  splitMentionParts,
  upsertMessage,
} from './chatModel';
import { REACTION_EMOJIS, reactionGroups, type ReactionEmoji } from './messageReactions';

type Props = {
  group: GroupSummary;
  currentUserId: string;
  comSerialID: number;
  canDeleteMessages: boolean;
  onBack: () => void;
};

type LocalMessage = ChatMessage & {
  status?: 'sending' | 'failed';
};

function isMine(senderId: string, userId: string): boolean {
  return senderId.trim().toLowerCase() === userId.trim().toLowerCase();
}

function typeForMime(mime: string): MessageType {
  if (mime.startsWith('image/')) return 'Image';
  if (mime.startsWith('audio/')) return 'Audio';
  if (mime.startsWith('video/')) return 'Video';
  return 'File';
}

const SENDER_COLORS = ['#4F46E5', '#0F766E', '#B45309', '#BE185D', '#1D4ED8', '#7C3AED'];

function senderColor(userId: string): string {
  let hash = 0;
  for (let index = 0; index < userId.length; index += 1) {
    hash = userId.charCodeAt(index) + ((hash << 5) - hash);
  }
  return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length];
}

function dayKey(value: string): string {
  const date = parseChatInstant(value);
  if (!date) return '';
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(value: string): string {
  const date = parseChatInstant(value);
  if (!date) return '';
  const start = (item: Date) => new Date(item.getFullYear(), item.getMonth(), item.getDate()).getTime();
  const days = Math.round((start(new Date()) - start(date)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}

function clockTime(value: string): string {
  const date = parseChatInstant(value);
  if (!date) return '';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function readPage(body: unknown): LocalMessage[] {
  if (!Array.isArray(body)) return [];
  return body
    .map((item) => parseChatMessage(item))
    .filter((item): item is LocalMessage => Boolean(item));
}

/** The chat API returns only the newest page. Keep asking until yesterday is included. */
async function loadGroupHistory(groupId: string): Promise<{ messages: LocalMessage[]; hasMore: boolean }> {
  const seen = new Set<string>();
  const collected: LocalMessage[] = [];
  let before: string | undefined;
  let hasMore = false;
  const startOfYesterday = new Date();
  startOfYesterday.setHours(0, 0, 0, 0);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  for (let page = 0; page < 8; page += 1) {
    const batch = readPage(await listMessages(groupId, before, 50));
    const fresh = batch.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
    if (fresh.length === 0) return { messages: sortMessages(collected), hasMore: false };

    collected.push(...fresh);
    const sorted = sortMessages(collected);
    const oldest = sorted[0];
    const oldestAt = parseChatInstant(oldest?.createdAt)?.getTime() ?? Number.POSITIVE_INFINITY;
    hasMore = fresh.length >= 50;
    const cursor = oldest?.createdAt?.trim().replace(' ', 'T');
    if (!hasMore || oldestAt < startOfYesterday.getTime() || !cursor || cursor === before) {
      return { messages: sorted, hasMore: hasMore && cursor !== before };
    }
    before = cursor;
  }

  return { messages: sortMessages(collected), hasMore };
}

function isImageMessage(message: { type: MessageType; fileName?: string | null }): boolean {
  if (message.type === 'Image') return true;
  return /\.(jpe?g|png|gif|webp)$/i.test(message.fileName || '');
}

function previewUrl(fileUrl: string): string {
  return absoluteFileUrl(fileUrl).replace('/api/files/download?', '/api/files/view?');
}

function attachmentLabel(type: MessageType): string {
  if (type === 'Image') return 'Photo';
  if (type === 'Audio') return 'Audio';
  if (type === 'Video') return 'Video';
  return 'File';
}

function isPdfMessage(message: { fileName?: string | null; fileUrl?: string | null }): boolean {
  return /\.pdf(?:$|[?#])/i.test(`${message.fileName || ''} ${message.fileUrl || ''}`);
}

function formatFileSize(size?: number | null): string {
  if (size == null || size < 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function ChatThreadScreen({
  group,
  currentUserId,
  comSerialID,
  canDeleteMessages,
  onBack,
}: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ uri: string; name: string } | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [nameById, setNameById] = useState<Record<string, string>>({});
  const [cursor, setCursor] = useState(0);
  const [keyboardLift, setKeyboardLift] = useState(0);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [reactionTarget, setReactionTarget] = useState<string | null>(null);
  const lastTapRef = useRef<{ id: string; at: number }>({ id: '', at: 0 });
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<FlatList<LocalMessage>>(null);
  const stickToEnd = useRef(true);
  const hasMore = useRef(false);
  const loadingOlder = useRef(false);
  const oldestAt = useRef<string | null>(null);
  const messagesRef = useRef<LocalMessage[]>([]);
  messagesRef.current = messages;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) => {
      const windowHeight = Dimensions.get('window').height;
      const overlap = windowHeight - event.endCoordinates.screenY;
      setKeyboardLift(Math.max(0, overlap));
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    });
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardLift(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const applyIncoming = useCallback((raw: unknown) => {
    const message = parseChatMessage(raw);
    if (!message || message.groupId !== group.id) return;
    setMessages((current) => upsertMessage(current, message));
    markGroupRead(group.id, message.id).catch(() => undefined);
  }, [group.id]);

  const load = useCallback(async () => {
    setError('');
    try {
      const history = await loadGroupHistory(group.id);
      stickToEnd.current = true;
      hasMore.current = history.hasMore;
      oldestAt.current = history.messages[0]?.createdAt?.trim().replace(' ', 'T') ?? null;
      setMessages(history.messages);
      const latest = history.messages[history.messages.length - 1];
      if (latest) {
        markGroupRead(group.id, latest.id).catch(() => undefined);
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [group.id]);

  const loadOlder = useCallback(async () => {
    const before = oldestAt.current;
    if (!before || loadingOlder.current || !hasMore.current) return;
    loadingOlder.current = true;
    stickToEnd.current = false;
    setLoadingEarlier(true);
    try {
      const batch = readPage(await listMessages(group.id, before, 50));
      const ids = new Set(messagesRef.current.map((item) => item.id));
      const fresh = batch.filter((item) => item.id && !ids.has(item.id));
      if (fresh.length === 0 || fresh.length < 50) {
        hasMore.current = false;
      }
      if (fresh.length === 0) return;
      const sorted = sortMessages([...fresh, ...messagesRef.current]);
      const nextOldest = sorted[0]?.createdAt?.trim().replace(' ', 'T') || before;
      if (nextOldest === before) hasMore.current = false;
      oldestAt.current = nextOldest;
      setMessages(sorted);
    } catch {
      // Keep the messages already on screen.
    } finally {
      loadingOlder.current = false;
      setLoadingEarlier(false);
    }
  }, [group.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let active = true;
    Promise.all([listGroupMembers(group.id), getAllUsers().catch(() => [])])
      .then(([listed, users]) => {
        if (!active) return;
        const byId = new Map(users.map((user) => [user.userID.toLowerCase(), user.userName || user.userID]));
        setNameById(Object.fromEntries(byId));
        const merged = new Map<string, GroupMember>();
        for (const member of listed) {
          const key = member.userID.toLowerCase();
          merged.set(key, {
            userID: member.userID,
            userName: byId.get(key) || member.userName || member.userID,
          });
        }
        setMembers([...merged.values()]);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [group.id]);

  useEffect(() => {
    let hub: HubConnection | null = null;
    let active = true;

    const onReaction = (raw: unknown) => {
      if (!raw || typeof raw !== 'object') return;
      const record = raw as Record<string, unknown>;
      const groupId =
        typeof record.groupId === 'string'
          ? record.groupId
          : typeof record.GroupId === 'string'
            ? record.GroupId
            : '';
      const messageId =
        typeof record.messageId === 'string'
          ? record.messageId
          : typeof record.MessageId === 'string'
            ? record.MessageId
            : '';
      if (!messageId || groupId !== group.id) return;
      const reactions = parseMessageReactions(record.reactions ?? record.Reactions);
      setMessages((current) =>
        current.map((item) => (item.id === messageId ? { ...item, reactions } : item)),
      );
    };

    ensureChatHub(currentUserId, comSerialID)
      .then((connection) => {
        if (!active) return;
        hub = connection;
        connection.on('messageReceived', applyIncoming);
        connection.on('messageUpdated', applyIncoming);
        connection.on('reactionUpdated', onReaction);
      })
      .catch(() => undefined);

    return () => {
      active = false;
      hub?.off('messageReceived', applyIncoming);
      hub?.off('messageUpdated', applyIncoming);
      hub?.off('reactionUpdated', onReaction);
    };
  }, [applyIncoming, currentUserId, comSerialID, group.id]);

  const publish = async (input: {
    id: string;
    type: MessageType;
    body?: string | null;
    fileUrl?: string | null;
    fileName?: string | null;
    size?: number | null;
  }) => {
    const optimistic: LocalMessage = {
      id: input.id,
      groupId: group.id,
      senderId: currentUserId,
      type: input.type,
      body: input.body,
      fileUrl: input.fileUrl,
      fileName: input.fileName,
      size: input.size,
      createdAt: new Date().toISOString(),
      status: 'sending',
    };
    setMessages((current) => upsertMessage(current, optimistic));
    setSending(true);
    try {
      const saved = await sendMessage(group.id, input);
      setMessages((current) => upsertMessage(current, saved));
    } catch (err) {
      setMessages((current) =>
        current.map((item) => (item.id === input.id ? { ...item, status: 'failed' } : item)),
      );
      Alert.alert('Message not sent', getApiErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    stickToEnd.current = true;
    setDraft('');
    await publish({ id: createMessageId(), type: 'Text', body });
  };

  const sharePickedFile = async (file: {
    uri: string;
    name: string;
    type: string;
    size?: number | null;
  }) => {
    stickToEnd.current = true;
    setSending(true);
    try {
      const folder = `chat/${group.id}`;
      const localUri = await localFileForUpload(file.uri, file.name);
      await createFolder(folder);
      const uploaded = await uploadFiles(folder, [
        { uri: localUri, name: file.name, type: file.type },
      ]);
      const saved = uploaded.uploaded?.[0];
      const fileUrl = absoluteFileUrl(saved?.downloadUrl || saved?.viewUrl || '');
      if (!fileUrl) {
        throw new Error('The file uploaded, but no download link was returned.');
      }
      await publish({
        id: createMessageId(),
        type: typeForMime(file.type),
        body: null,
        fileUrl,
        fileName: file.name,
        size: file.size ?? saved.sizeBytes,
      });
    } catch (err) {
      Alert.alert('File not shared', getApiErrorMessage(err));
      setSending(false);
    }
  };

  const handleAttach = async () => {
    if (sending) return;
    const picked = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (picked.canceled || !picked.assets?.[0]) return;

    const file = picked.assets[0];
    await sharePickedFile({
      uri: file.uri,
      name: file.name,
      type: file.mimeType || 'application/octet-stream',
      size: file.size,
    });
  };

  const handleCamera = async () => {
    if (sending) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera needed', 'Allow the camera to send a photo in this group.');
      return;
    }

    const picked = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      cameraType: ImagePicker.CameraType.back,
      allowsEditing: false,
      quality: 0.7,
    });
    if (picked.canceled || !picked.assets?.[0]) return;

    const photo = picked.assets[0];
    const name = photo.fileName && /\.[a-z0-9]+$/i.test(photo.fileName)
      ? photo.fileName
      : `photo-${Date.now()}.jpg`;
    await sharePickedFile({
      uri: photo.uri,
      name,
      type: photo.mimeType || 'image/jpeg',
      size: photo.fileSize,
    });
  };

  const applyReaction = useCallback(
    (messageId: string, emoji: ReactionEmoji) => {
      setReactionTarget(null);
      setMessageReaction(group.id, messageId, emoji)
        .then((result) => {
          const record = result as unknown as Record<string, unknown>;
          const reactions = parseMessageReactions(record.reactions ?? record.Reactions);
          setMessages((current) =>
            current.map((item) => (item.id === messageId ? { ...item, reactions } : item)),
          );
        })
        .catch((err) => Alert.alert('Like not saved', getApiErrorMessage(err)));
    },
    [group.id],
  );

  const handleBubblePress = (message: LocalMessage, deleted: boolean) => {
    const now = Date.now();
    const last = lastTapRef.current;
    if (last.id === message.id && now - last.at < 280) {
      if (openTimerRef.current) clearTimeout(openTimerRef.current);
      lastTapRef.current = { id: '', at: 0 };
      if (!deleted) applyReaction(message.id, '👍');
      return;
    }
    lastTapRef.current = { id: message.id, at: now };
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    if (message.fileUrl && !deleted && isImageMessage(message)) {
      openTimerRef.current = setTimeout(() => handleView(message), 280);
    }
  };

  const handleView = async (message: LocalMessage) => {
    if (!message.fileUrl || downloadingId) return;
    if (isImageMessage(message)) {
      setViewer({ uri: previewUrl(message.fileUrl), name: message.fileName || 'Photo' });
      return;
    }
    setDownloadingId(message.id);
    try {
      await viewSharedFile(message.fileUrl, message.fileName || 'file');
    } catch (err) {
      Alert.alert('Could not open', getApiErrorMessage(err));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownload = async (message: LocalMessage) => {
    if (!message.fileUrl || downloadingId) return;
    setDownloadingId(message.id);
    try {
      await downloadSharedFile(message.fileUrl, message.fileName || 'file');
    } catch (err) {
      Alert.alert('Could not download', getApiErrorMessage(err));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = (message: LocalMessage) => {
    if (!canDeleteMessages || !isMine(message.senderId, currentUserId) || message.deletedAt) return;
    Alert.alert('Delete message', 'Remove this message for the group?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteMessage(group.id, message.id)
            .then(() => {
              setMessages((current) =>
                current.map((item) =>
                  item.id === message.id
                    ? { ...item, deletedAt: new Date().toISOString(), body: null }
                    : item,
                ),
              );
            })
            .catch((err) => Alert.alert('Could not delete', getApiErrorMessage(err)));
        },
      },
    ]);
  };

  const mentionPeople = (() => {
    const byId = new Map<string, GroupMember>();
    for (const member of members) {
      if (!member.userID || isMine(member.userID, currentUserId)) continue;
      byId.set(member.userID.toLowerCase(), member);
    }
    for (const message of messages) {
      if (!message.senderId || isMine(message.senderId, currentUserId)) continue;
      const key = message.senderId.toLowerCase();
      if (byId.has(key)) continue;
      byId.set(key, {
        userID: message.senderId,
        userName: nameById[key] || message.senderId,
      });
    }
    return [...byId.values()];
  })();
  const activeMention = mentionQuery(draft, cursor);
  const suggestions =
    activeMention === null
      ? []
      : mentionPeople
          .filter((person) => {
            const needle = activeMention.toLowerCase();
            return (
              person.userName.toLowerCase().includes(needle) ||
              person.userID.toLowerCase().includes(needle)
            );
          })
          .slice(0, 8);
  const mentionNames = mentionPeople.flatMap((person) => [person.userName, person.userID]);

  const insertMention = (person: GroupMember) => {
    const before = draft.slice(0, cursor);
    const at = before.lastIndexOf('@');
    if (at < 0) return;
    const name = person.userName.trim() || person.userID;
    const next = `${draft.slice(0, at)}@${name} ${draft.slice(cursor)}`;
    setDraft(next);
    setCursor(at + name.length + 2);
  };

  const initial = (group.name || 'G').slice(0, 1).toUpperCase();
  const canSend = Boolean(draft.trim()) && !sending;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Pressable style={styles.backBtn} onPress={onBack} hitSlop={8}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <View style={styles.headerRow}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{initial}</Text>
          </View>
          <View style={styles.headerBody}>
            <Text style={styles.title} numberOfLines={1}>
              {group.name || 'Group'}
            </Text>
            <Text style={styles.subtitle}>Group chat</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.panel}>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          ref={listRef}
          style={styles.messageList}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messages}
          keyboardShouldPersistTaps="handled"
          maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
          scrollEventThrottle={200}
          onScroll={(event) => {
            const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
            const distanceFromEnd =
              contentSize.height - layoutMeasurement.height - contentOffset.y;
            stickToEnd.current = distanceFromEnd < 80;
            if (contentOffset.y < 48) loadOlder();
          }}
          onContentSizeChange={() => {
            if (stickToEnd.current) listRef.current?.scrollToEnd({ animated: false });
          }}
          ListHeaderComponent={
            loadingEarlier ? (
              <ActivityIndicator color={colors.primary} style={styles.earlier} />
            ) : undefined
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyMark}>
                <Text style={styles.emptyMarkText}>{initial}</Text>
              </View>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptyBody}>Send the first message to this group.</Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const mine = isMine(item.senderId, currentUserId);
            const deleted = Boolean(item.deletedAt);
            const previous = messages[index - 1];
            const next = messages[index + 1];
            const sameSender = (other?: LocalMessage) =>
              Boolean(other) &&
              !other?.deletedAt &&
              !item.deletedAt &&
              other?.senderId.toLowerCase() === item.senderId.toLowerCase() &&
              dayKey(other.createdAt) === dayKey(item.createdAt);
            const groupedWithPrevious = sameSender(previous);
            const groupedWithNext = sameSender(next);
            const showDay = !previous || dayKey(previous.createdAt) !== dayKey(item.createdAt);
            const attachment = !deleted && item.type !== 'Text';

            return (
              <View>
                {showDay ? (
                  <View style={styles.dayRow}>
                    <Text style={styles.dayText}>{dayLabel(item.createdAt)}</Text>
                  </View>
                ) : null}
                <Pressable
                  onLongPress={() => {
                    if (!deleted) setReactionTarget(item.id);
                  }}
                  onPress={() => handleBubblePress(item, deleted)}
                  style={[
                    styles.bubbleWrap,
                    mine ? styles.mineWrap : styles.theirWrap,
                    groupedWithPrevious ? styles.bubbleTight : styles.bubbleLoose,
                    (item.reactions?.length ?? 0) > 0 ? styles.bubbleWithReaction : null,
                  ]}
                >
                  {!mine && !groupedWithPrevious ? (
                    <Text style={[styles.sender, { color: senderColor(item.senderId) }]}>
                      {item.senderId}
                    </Text>
                  ) : null}
                  {reactionTarget === item.id && !deleted ? (
                    <View style={[styles.reactionBar, mine ? styles.reactionBarMine : styles.reactionBarTheirs]}>
                      {REACTION_EMOJIS.map((emoji) => (
                        <Pressable
                          key={emoji}
                          style={styles.reactionChoice}
                          onPress={() => applyReaction(item.id, emoji)}
                        >
                          <Text style={styles.reactionChoiceText}>{emoji}</Text>
                        </Pressable>
                      ))}
                      {mine && canDeleteMessages ? (
                        <Pressable style={styles.reactionChoice} onPress={() => handleDelete(item)}>
                          <Text style={styles.reactionDelete}>Delete</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                  <View
                    style={[
                      styles.bubble,
                      mine ? styles.mineBubble : styles.theirBubble,
                      mine && !groupedWithNext ? styles.mineTail : null,
                      !mine && !groupedWithNext ? styles.theirTail : null,
                      deleted ? styles.deletedBubble : null,
                      attachment && isImageMessage(item) ? styles.imageBubble : null,
                    ]}
                  >
                    {attachment && isImageMessage(item) ? (
                      <View>
                        <Image source={{ uri: previewUrl(item.fileUrl || '') }} style={styles.photo} />
                        <Text style={styles.photoTime}>{clockTime(item.createdAt)}</Text>
                      </View>
                    ) : attachment ? (
                      <View style={styles.fileRow}>
                        <View style={[styles.docThumb, isPdfMessage(item) ? styles.docThumbPdf : null]}>
                          <Text style={styles.docThumbText}>
                            {isPdfMessage(item) ? 'PDF' : attachmentLabel(item.type).slice(0, 3).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.fileBody}>
                          <Text
                            style={[styles.fileName, mine ? styles.mineText : styles.theirText]}
                            numberOfLines={1}
                          >
                            {item.fileName || messagePreview(item)}
                          </Text>
                          {formatFileSize(item.size) ? (
                            <Text style={[styles.fileHint, mine ? styles.mineTime : styles.theirTime]}>
                              {formatFileSize(item.size)}
                            </Text>
                          ) : null}
                          <View style={styles.fileActions}>
                            <Pressable onPress={() => handleView(item)} disabled={downloadingId === item.id}>
                              <Text style={[styles.fileAction, mine ? styles.mineText : styles.theirMention]}>
                                {downloadingId === item.id ? 'Opening…' : 'View'}
                              </Text>
                            </Pressable>
                            <Pressable onPress={() => handleDownload(item)} disabled={downloadingId === item.id}>
                              <Text style={[styles.fileAction, mine ? styles.mineTime : styles.theirTime]}>
                                Save
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    ) : (
                      <Text style={[styles.bubbleText, mine ? styles.mineText : styles.theirText, deleted && styles.deletedText]}>
                        {deleted
                          ? 'Message deleted'
                          : splitMentionParts(messagePreview(item), mentionNames).map((part, partIndex) =>
                              part.mention ? (
                                <Text
                                  key={`${item.id}-m-${partIndex}`}
                                  style={mine ? styles.mineMention : styles.theirMention}
                                >
                                  {part.text}
                                </Text>
                              ) : (
                                part.text
                              ),
                            )}
                      </Text>
                    )}
                    {attachment && isImageMessage(item) && item.status !== 'sending' && item.status !== 'failed' ? null : (
                      <Text style={[styles.time, mine ? styles.mineTime : styles.theirTime]}>
                        {item.status === 'sending'
                          ? 'Sending'
                          : item.status === 'failed'
                            ? 'Not sent'
                            : clockTime(item.createdAt)}
                        {mine && item.status !== 'failed' && item.status !== 'sending' ? '  ✓' : ''}
                      </Text>
                    )}
                  </View>
                  {reactionGroups(item.reactions).length > 0 ? (
                    <View style={styles.reactionRow}>
                      {reactionGroups(item.reactions).map(([emoji, userIds]) => (
                        <View key={emoji} style={styles.reactionChip}>
                          <Text style={styles.reactionEmoji}>
                            {emoji}{' '}
                            {userIds
                              .map((userId) => nameById[userId.toLowerCase()] || userId)
                              .join(', ')}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </Pressable>
              </View>
            );
          }}
        />
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      {activeMention !== null ? (
        <View style={styles.mentionCard}>
          <Text style={styles.mentionTitle}>Mention a member</Text>
          {suggestions.length === 0 ? (
            <Text style={styles.mentionEmpty}>No matching member in this group.</Text>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.mentionList}>
              {suggestions.map((person) => (
                <Pressable
                  key={person.userID.toLowerCase()}
                  style={styles.mentionRow}
                  onPress={() => insertMention(person)}
                >
                  <View style={styles.mentionAvatar}>
                    <Text style={styles.mentionAvatarText}>
                      {(person.userName || person.userID).slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.mentionBody}>
                    <Text style={styles.mentionName}>{person.userName}</Text>
                    <Text style={styles.mentionId}>{person.userID}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      ) : null}

      <View
        style={[
          styles.composer,
          {
            marginBottom: keyboardLift,
            paddingBottom: keyboardLift > 0 ? spacing.sm : spacing.xxl,
          },
        ]}
      >
        <Pressable style={styles.attach} onPress={handleAttach} disabled={sending}>
          <Text style={styles.attachText}>+</Text>
        </Pressable>
        <Pressable style={styles.attach} onPress={handleCamera} disabled={sending}>
          <Text style={styles.cameraText}>📷</Text>
        </Pressable>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={(text) => {
            setDraft(text);
            setCursor(text.length);
          }}
          onSelectionChange={(event) => setCursor(event.nativeEvent.selection.end)}
          placeholder="Message, @ to mention"
          placeholderTextColor={colors.textMuted}
          multiline
        />
        <Pressable
          style={[styles.send, !canSend && styles.sendDisabled]}
          onPress={handleSend}
          disabled={!canSend}
        >
          <Text style={styles.sendText}>↑</Text>
        </Pressable>
      </View>
      <Modal visible={viewer !== null} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={styles.viewer}>
          <Pressable style={styles.viewerClose} onPress={() => setViewer(null)}>
            <Text style={styles.viewerCloseText}>Close</Text>
          </Pressable>
          {viewer ? (
            <Image source={{ uri: viewer.uri }} style={styles.viewerImage} resizeMode="contain" />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

function createStyles(colors: ColorPalette, shadow: ShadowTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingTop: spacing.xxxl + spacing.md,
      paddingBottom: spacing.xxl,
      paddingHorizontal: spacing.xl,
      borderBottomLeftRadius: radius.xl,
      borderBottomRightRadius: radius.xl,
    },
    backBtn: {
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      marginBottom: spacing.md,
    },
    backText: {
      ...typography.label,
      color: colors.textOnPrimary,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    headerAvatarText: {
      ...typography.title,
      color: colors.textOnPrimary,
    },
    headerBody: { flex: 1 },
    title: {
      ...typography.h3,
      color: colors.textOnPrimary,
    },
    subtitle: {
      ...typography.caption,
      color: colors.textOnPrimary,
      opacity: 0.85,
    },
    panel: {
      flex: 1,
      marginHorizontal: spacing.md,
      marginTop: -spacing.lg,
      marginBottom: spacing.sm,
      backgroundColor: colors.background,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      ...shadow.card,
    },
    loader: { marginTop: spacing.xxl },
    earlier: { marginVertical: spacing.sm },
    messageList: { flex: 1 },
    messages: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
      flexGrow: 1,
    },
    emptyWrap: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: spacing.xxxl,
    },
    emptyMark: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.tintPrimary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    emptyMarkText: {
      ...typography.h2,
      color: colors.primary,
    },
    emptyTitle: {
      ...typography.title,
      color: colors.text,
    },
    emptyBody: {
      ...typography.body,
      color: colors.textSecondary,
      marginTop: spacing.xs,
      textAlign: 'center',
    },
    dayRow: {
      alignSelf: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      marginVertical: spacing.sm,
    },
    dayText: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    bubbleWrap: {
      maxWidth: '82%',
    },
    bubbleLoose: { marginTop: spacing.sm },
    bubbleTight: { marginTop: 2 },
    bubbleWithReaction: { marginBottom: spacing.sm },
    reactionBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
      marginBottom: spacing.xs,
      ...shadow.soft,
    },
    reactionBarMine: { alignSelf: 'flex-end' },
    reactionBarTheirs: { alignSelf: 'flex-start' },
    reactionChoice: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    reactionChoiceText: { fontSize: 20 },
    reactionDelete: {
      ...typography.caption,
      color: colors.danger,
      fontWeight: '700',
    },
    reactionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 4,
    },
    reactionChip: {
      backgroundColor: colors.surface,
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 4,
      marginTop: 2,
    },
    reactionEmoji: {
      ...typography.caption,
      color: colors.text,
    },
    imageBubble: {
      paddingHorizontal: 4,
      paddingTop: 4,
      paddingBottom: 4,
    },
    mineWrap: { alignSelf: 'flex-end' },
    theirWrap: { alignSelf: 'flex-start' },
    sender: {
      ...typography.caption,
      fontWeight: '700',
      marginBottom: 3,
      marginLeft: spacing.sm,
    },
    bubble: {
      borderRadius: 18,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
    },
    mineBubble: { backgroundColor: colors.primary },
    theirBubble: {
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    mineTail: { borderBottomRightRadius: 6 },
    theirTail: { borderBottomLeftRadius: 6 },
    deletedBubble: { opacity: 0.72 },
    bubbleText: {
      ...typography.body,
      lineHeight: 21,
    },
    deletedText: { fontStyle: 'italic' },
    mineText: { color: colors.textOnPrimary },
    theirText: { color: colors.text },
    mineMention: {
      color: colors.textOnPrimary,
      fontWeight: '800',
    },
    theirMention: {
      color: colors.primary,
      fontWeight: '800',
    },
    time: {
      fontSize: 11,
      lineHeight: 14,
      marginTop: 4,
      alignSelf: 'flex-end',
    },
    mineTime: { color: colors.textOnPrimary, opacity: 0.78 },
    theirTime: { color: colors.textMuted },
    fileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minWidth: 180,
    },
    fileIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    fileIconMine: { backgroundColor: 'rgba(255,255,255,0.2)' },
    fileIconTheirs: { backgroundColor: colors.tintPrimary },
    fileIconText: {
      ...typography.label,
      fontWeight: '700',
    },
    fileBody: { flex: 1 },
    fileName: {
      ...typography.label,
    },
    fileHint: {
      ...typography.caption,
      marginTop: 4,
    },
    fileActions: {
      flexDirection: 'row',
      marginTop: 6,
    },
    fileAction: {
      ...typography.caption,
      fontWeight: '700',
      marginRight: spacing.md,
    },
    photo: {
      width: 220,
      height: 160,
      borderRadius: 14,
      backgroundColor: 'rgba(0,0,0,0.08)',
    },
    photoTime: {
      position: 'absolute',
      right: 8,
      bottom: 8,
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '600',
      backgroundColor: 'rgba(0,0,0,0.45)',
      overflow: 'hidden',
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    docThumb: {
      width: 46,
      height: 56,
      borderRadius: 8,
      backgroundColor: '#4F46E5',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    docThumbPdf: { backgroundColor: '#DC2626' },
    docThumbText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '800',
    },
    viewer: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.92)',
      justifyContent: 'center',
    },
    viewerClose: {
      position: 'absolute',
      top: spacing.xxxl,
      right: spacing.lg,
      zIndex: 2,
      padding: spacing.sm,
    },
    viewerCloseText: {
      ...typography.label,
      color: '#FFFFFF',
    },
    viewerImage: {
      width: '100%',
      height: '80%',
    },
    mentionCard: {
      marginHorizontal: spacing.md,
      marginBottom: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      ...shadow.soft,
    },
    mentionTitle: {
      ...typography.caption,
      color: colors.textMuted,
      fontWeight: '700',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
    },
    mentionList: {
      maxHeight: 180,
    },
    mentionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    mentionAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.tintPrimary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    mentionAvatarText: {
      ...typography.caption,
      color: colors.primary,
      fontWeight: '700',
    },
    mentionBody: { flex: 1 },
    mentionName: {
      ...typography.label,
      color: colors.text,
    },
    mentionId: {
      ...typography.caption,
      color: colors.textMuted,
    },
    mentionEmpty: {
      ...typography.caption,
      color: colors.textSecondary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    error: {
      ...typography.caption,
      color: colors.danger,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xs,
    },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginHorizontal: spacing.md,
      marginTop: spacing.sm,
      paddingHorizontal: spacing.sm,
      paddingTop: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: 28,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    attach: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.tintPrimary,
      marginRight: spacing.sm,
      marginBottom: 1,
    },
    attachText: {
      fontSize: 26,
      lineHeight: 28,
      color: colors.primary,
      marginTop: -1,
    },
    cameraText: {
      fontSize: 18,
      lineHeight: 22,
    },
    input: {
      flex: 1,
      minHeight: 42,
      maxHeight: 120,
      borderRadius: 21,
      backgroundColor: colors.inputBg,
      color: colors.text,
      paddingHorizontal: spacing.lg,
      paddingTop: Platform.OS === 'ios' ? 10 : 8,
      paddingBottom: Platform.OS === 'ios' ? 10 : 8,
      ...typography.body,
    },
    send: {
      width: 42,
      height: 42,
      marginLeft: spacing.sm,
      marginBottom: 1,
      backgroundColor: colors.primary,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendDisabled: { opacity: 0.4 },
    sendText: {
      color: colors.textOnPrimary,
      fontSize: 22,
      fontWeight: '700',
      lineHeight: 24,
      marginTop: -1,
    },
  });
}
