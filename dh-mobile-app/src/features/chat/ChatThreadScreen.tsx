import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import type { HubConnection } from '@microsoft/signalr';
import { createFolder, downloadSharedFile, uploadFiles } from '../../api/client/fileManagerClient';
import { getApiErrorMessage } from '../../api/client/client';
import {
  deleteMessage,
  listMessages,
  markGroupRead,
  sendMessage,
} from '../../api/endpoints/chat';
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
  messagePreview,
  parseChatInstant,
  parseChatMessage,
  sortMessages,
  upsertMessage,
} from './chatModel';

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

function attachmentLabel(type: MessageType): string {
  if (type === 'Image') return 'Photo';
  if (type === 'Audio') return 'Audio';
  if (type === 'Video') return 'Video';
  return 'File';
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
  const [keyboardLift, setKeyboardLift] = useState(0);
  const listRef = useRef<FlatList<LocalMessage>>(null);

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
      const result = await listMessages(group.id);
      const sorted = sortMessages(result ?? []);
      setMessages(sorted);
      const latest = sorted[sorted.length - 1];
      if (latest) {
        markGroupRead(group.id, latest.id).catch(() => undefined);
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [group.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let hub: HubConnection | null = null;
    let active = true;

    ensureChatHub(currentUserId, comSerialID)
      .then((connection) => {
        if (!active) return;
        hub = connection;
        connection.on('messageReceived', applyIncoming);
        connection.on('messageUpdated', applyIncoming);
      })
      .catch(() => undefined);

    return () => {
      active = false;
      hub?.off('messageReceived', applyIncoming);
      hub?.off('messageUpdated', applyIncoming);
    };
  }, [applyIncoming, currentUserId, comSerialID]);

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
    setDraft('');
    await publish({ id: createMessageId(), type: 'Text', body });
  };

  const handleAttach = async () => {
    if (sending) return;
    const picked = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (picked.canceled || !picked.assets?.[0]) return;

    const file = picked.assets[0];
    const mime = file.mimeType || 'application/octet-stream';
    setSending(true);
    try {
      const folder = `chat/${group.id}`;
      await createFolder(folder);
      const uploaded = await uploadFiles(folder, [
        { uri: file.uri, name: file.name, type: mime },
      ]);
      const saved = uploaded.uploaded?.[0];
      const fileUrl = saved?.downloadUrl || saved?.viewUrl;
      if (!fileUrl) {
        throw new Error('The file uploaded, but no download link was returned.');
      }
      await publish({
        id: createMessageId(),
        type: typeForMime(mime),
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
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
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
                  onLongPress={() => handleDelete(item)}
                  onPress={() => {
                    if (item.fileUrl && !deleted) handleDownload(item);
                  }}
                  style={[
                    styles.bubbleWrap,
                    mine ? styles.mineWrap : styles.theirWrap,
                    groupedWithPrevious ? styles.bubbleTight : styles.bubbleLoose,
                  ]}
                >
                  {!mine && !groupedWithPrevious ? (
                    <Text style={[styles.sender, { color: senderColor(item.senderId) }]}>
                      {item.senderId}
                    </Text>
                  ) : null}
                  <View
                    style={[
                      styles.bubble,
                      mine ? styles.mineBubble : styles.theirBubble,
                      mine && !groupedWithNext ? styles.mineTail : null,
                      !mine && !groupedWithNext ? styles.theirTail : null,
                      deleted ? styles.deletedBubble : null,
                    ]}
                  >
                    {attachment ? (
                      <View style={styles.fileRow}>
                        <View style={[styles.fileIcon, mine ? styles.fileIconMine : styles.fileIconTheirs]}>
                          <Text style={[styles.fileIconText, mine ? styles.mineText : styles.theirText]}>
                            {attachmentLabel(item.type).slice(0, 1)}
                          </Text>
                        </View>
                        <View style={styles.fileBody}>
                          <Text
                            style={[styles.fileName, mine ? styles.mineText : styles.theirText]}
                            numberOfLines={1}
                          >
                            {item.fileName || messagePreview(item)}
                          </Text>
                          <Text style={[styles.fileHint, mine ? styles.mineTime : styles.theirTime]}>
                            {downloadingId === item.id
                              ? 'Downloading…'
                              : `${attachmentLabel(item.type)} · Tap to download`}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <Text style={[styles.bubbleText, mine ? styles.mineText : styles.theirText, deleted && styles.deletedText]}>
                        {deleted ? 'Message deleted' : messagePreview(item)}
                      </Text>
                    )}
                    <Text style={[styles.time, mine ? styles.mineTime : styles.theirTime]}>
                      {item.status === 'sending'
                        ? 'Sending'
                        : item.status === 'failed'
                          ? 'Not sent'
                          : clockTime(item.createdAt)}
                      {mine && item.status !== 'failed' && item.status !== 'sending' ? '  ✓' : ''}
                    </Text>
                  </View>
                </Pressable>
              </View>
            );
          }}
        />
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

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
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message"
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
      fontSize: 11,
      lineHeight: 14,
      marginTop: 1,
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
