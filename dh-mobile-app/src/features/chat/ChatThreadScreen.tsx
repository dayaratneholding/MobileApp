import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import type { HubConnection } from '@microsoft/signalr';
import { createFolder, uploadFiles } from '../../api/client/fileManagerClient';
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
  typography,
  type ColorPalette,
} from '../../styles/theme';
import { useTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { ChatMessage, GroupSummary, MessageType } from '../../types/chat';
import {
  createMessageId,
  formatChatTime,
  messagePreview,
  parseChatMessage,
  sortMessages,
  upsertMessage,
} from './chatModel';

type Props = {
  group: GroupSummary;
  currentUserId: string;
  comSerialID: number;
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

export function ChatThreadScreen({ group, currentUserId, comSerialID, onBack }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<LocalMessage>>(null);

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
      if (!saved?.viewUrl) {
        throw new Error('The file uploaded, but no link was returned.');
      }
      await publish({
        id: createMessageId(),
        type: typeForMime(mime),
        body: null,
        fileUrl: saved.viewUrl,
        fileName: file.name,
        size: file.size ?? saved.sizeBytes,
      });
    } catch (err) {
      Alert.alert('File not shared', getApiErrorMessage(err));
      setSending(false);
    }
  };

  const handleDelete = (message: LocalMessage) => {
    if (!isMine(message.senderId, currentUserId) || message.deletedAt) return;
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <View style={styles.headerBody}>
          <Text style={styles.title} numberOfLines={1}>
            {group.name || 'Group'}
          </Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <Text style={styles.empty}>Say hello to the group.</Text>
          }
          renderItem={({ item }) => {
            const mine = isMine(item.senderId, currentUserId);
            const deleted = Boolean(item.deletedAt);
            return (
              <Pressable
                onLongPress={() => handleDelete(item)}
                onPress={() => {
                  if (item.fileUrl && !deleted) Linking.openURL(item.fileUrl).catch(() => undefined);
                }}
                style={[styles.bubbleWrap, mine ? styles.mineWrap : styles.theirWrap]}
              >
                {!mine ? <Text style={styles.sender}>{item.senderId}</Text> : null}
                <View style={[styles.bubble, mine ? styles.mineBubble : styles.theirBubble]}>
                  <Text style={[styles.bubbleText, mine ? styles.mineText : styles.theirText]}>
                    {deleted ? 'Message deleted' : messagePreview(item)}
                  </Text>
                  <Text style={[styles.time, mine ? styles.mineTime : styles.theirTime]}>
                    {item.status === 'sending'
                      ? 'Sending'
                      : item.status === 'failed'
                        ? 'Failed'
                        : formatChatTime(item.createdAt)}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.composer}>
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
          style={[styles.send, (!draft.trim() || sending) && styles.sendDisabled]}
          onPress={handleSend}
          disabled={!draft.trim() || sending}
        >
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingTop: spacing.xxxl + spacing.md,
      paddingBottom: spacing.md,
      paddingHorizontal: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    backText: {
      fontSize: 28,
      color: colors.primary,
      marginRight: spacing.md,
    },
    headerBody: { flex: 1 },
    title: {
      ...typography.title,
      color: colors.text,
    },
    loader: { marginTop: spacing.xxl },
    messages: {
      padding: spacing.lg,
      flexGrow: 1,
    },
    empty: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.xxl,
    },
    bubbleWrap: {
      maxWidth: '82%',
      marginBottom: spacing.sm,
    },
    mineWrap: { alignSelf: 'flex-end' },
    theirWrap: { alignSelf: 'flex-start' },
    sender: {
      ...typography.caption,
      color: colors.textMuted,
      marginBottom: 2,
      marginLeft: spacing.xs,
    },
    bubble: {
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    mineBubble: { backgroundColor: colors.primary },
    theirBubble: { backgroundColor: colors.surface },
    bubbleText: { ...typography.body },
    mineText: { color: colors.textOnPrimary },
    theirText: { color: colors.text },
    time: {
      ...typography.caption,
      marginTop: 2,
      alignSelf: 'flex-end',
    },
    mineTime: { color: colors.textOnPrimary, opacity: 0.8 },
    theirTime: { color: colors.textMuted },
    error: {
      ...typography.caption,
      color: colors.danger,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xs,
    },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      padding: spacing.sm,
      paddingBottom: spacing.lg,
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    attach: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.tintPrimary,
      marginRight: spacing.sm,
    },
    attachText: {
      fontSize: 24,
      color: colors.primary,
      lineHeight: 28,
    },
    input: {
      flex: 1,
      minHeight: 40,
      maxHeight: 120,
      borderRadius: radius.lg,
      backgroundColor: colors.inputBg,
      color: colors.text,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      ...typography.body,
    },
    send: {
      marginLeft: spacing.sm,
      backgroundColor: colors.primary,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.lg,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendDisabled: { opacity: 0.45 },
    sendText: {
      ...typography.label,
      color: colors.textOnPrimary,
    },
  });
}
