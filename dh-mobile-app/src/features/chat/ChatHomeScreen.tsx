import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import type { HubConnection } from '@microsoft/signalr';
import { setChatIdentity } from '../../api/client/chatClient';
import { createGroup, listGroups } from '../../api/endpoints/chat';
import { getAllUsers, type CoreUser } from '../../api/endpoints/users';
import { getApiErrorMessage } from '../../api/client/client';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import {
  radius,
  spacing,
  typography,
  type ColorPalette,
  type ShadowTokens,
} from '../../styles/theme';
import { useTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { AuthSession } from '../../types/api';
import type { GroupSummary } from '../../types/chat';
import { ensureChatHub, stopChatHub } from '../../services/chatHub';
import {
  GroupMemberPermission,
  GroupMessagePermission,
  hasPermission,
} from '../../services/groupPermissions';
import { formatChatTime, messagePreview, parseChatMessage } from './chatModel';
import { ChatThreadScreen } from './ChatThreadScreen';

type Props = {
  session: AuthSession;
  onBack: () => void;
};

type Screen = 'list' | 'create';

export function ChatHomeScreen({ session, onBack }: Props) {
  setChatIdentity(session.userID, session.comSerialID);
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [screen, setScreen] = useState<Screen>('list');
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [selected, setSelected] = useState<GroupSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [users, setUsers] = useState<CoreUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<CoreUser[]>([]);
  const [creating, setCreating] = useState(false);
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selected?.id ?? null;
  const canAddGroup = hasPermission(session.permissionIds, GroupMessagePermission.add);
  const canSaveGroup = hasPermission(session.permissionIds, GroupMessagePermission.save);
  const canDeleteMessage = hasPermission(session.permissionIds, GroupMessagePermission.delete);
  const canViewMembers = hasPermission(session.permissionIds, GroupMemberPermission.view);
  const canAddMember = hasPermission(session.permissionIds, GroupMemberPermission.add);
  const canEditMember = hasPermission(session.permissionIds, GroupMemberPermission.edit);
  const canSaveMembers = hasPermission(session.permissionIds, GroupMemberPermission.save);
  const canDeleteMember = hasPermission(session.permissionIds, GroupMemberPermission.delete);
  const canOpenCreate = canAddGroup || canSaveGroup;
  const showMembers = canViewMembers || canAddMember || canEditMember;
  const canPickMember = canAddMember || canEditMember;
  const canRemoveMember = canDeleteMember || canEditMember;

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const result = await listGroups();
      setGroups(
        [...(result ?? [])].sort((a, b) => {
          const left = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
          const right = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
          return right - left;
        }),
      );
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let hub: HubConnection | null = null;
    let active = true;

    const onMessage = (raw: unknown) => {
      const message = parseChatMessage(raw);
      if (!message) return;
      setGroups((current) => {
        const next = current.map((group) => {
          if (group.id !== message.groupId) return group;
          const viewing = selectedIdRef.current === group.id;
          return {
            ...group,
            lastMessage: messagePreview(message),
            lastMessageAt: message.createdAt,
            unreadCount: viewing ? 0 : group.unreadCount + 1,
          };
        });
        return next.sort((a, b) => {
          const left = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
          const right = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
          return right - left;
        });
      });
    };

    ensureChatHub(session.userID, session.comSerialID)
      .then((connection) => {
        if (!active) return;
        hub = connection;
        connection.on('messageReceived', onMessage);
      })
      .catch(() => undefined);

    return () => {
      active = false;
      hub?.off('messageReceived', onMessage);
      void stopChatHub();
    };
  }, [session.userID, session.comSerialID]);

  useEffect(() => {
    if (screen !== 'create' || !showMembers) return;

    let active = true;
    setUsersLoading(true);
    getAllUsers()
      .then((result) => {
        if (active) setUsers(result);
      })
      .catch((err) => {
        if (active) setError(getApiErrorMessage(err));
      })
      .finally(() => {
        if (active) setUsersLoading(false);
      });

    return () => {
      active = false;
    };
  }, [screen, showMembers]);

  const filteredUsers = users
    .filter((user) => user.userID.toLowerCase() !== session.userID.trim().toLowerCase())
    .filter((user) => {
      const query = userQuery.trim().toLowerCase();
      if (!query) return true;
      return (
        user.userName.toLowerCase().includes(query) ||
        user.userID.toLowerCase().includes(query)
      );
    });

  const toggleUser = (user: CoreUser) => {
    setSelectedUsers((current) => {
      const exists = current.some(
        (item) => item.userID.toLowerCase() === user.userID.toLowerCase(),
      );
      if (exists) {
        if (!canRemoveMember) return current;
        return current.filter((item) => item.userID.toLowerCase() !== user.userID.toLowerCase());
      }
      if (!canPickMember) return current;
      return [...current, user];
    });
  };

  const handleCreate = async () => {
    const groupName = name.trim();
    if (!canSaveGroup) {
      setError('You do not have permission to save a group.');
      return;
    }
    if (!groupName) {
      setError('Enter a group name.');
      return;
    }

    setCreating(true);
    setError('');
    try {
      const memberIds = canSaveMembers
        ? selectedUsers
            .map((user) => user.userID.trim())
            .filter((userID) => userID.length > 0)
        : [];
      const created = await createGroup(groupName, memberIds);
      setName('');
      setUserQuery('');
      setSelectedUsers([]);
      setScreen('list');
      setSelected(created);
      await load(true);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  if (selected) {
    return (
      <ChatThreadScreen
        group={selected}
        currentUserId={session.userID}
        comSerialID={session.comSerialID}
        canDeleteMessages={canDeleteMessage}
        onBack={() => {
          setSelected(null);
          load(true);
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.appBar}>
          <Pressable
            style={styles.backBtn}
            onPress={screen === 'create' ? () => setScreen('list') : onBack}
            hitSlop={8}
          >
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          {screen === 'list' && canOpenCreate ? (
            <Pressable style={styles.newBtn} onPress={() => setScreen('create')} hitSlop={8}>
              <Text style={styles.newText}>New group</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.headerTitle}>{screen === 'create' ? 'New group' : 'Messages'}</Text>
        <Text style={styles.headerSubtitle}>
          {screen === 'create'
            ? showMembers
              ? 'Search people and add them to the group'
              : 'Name the group'
            : 'Groups you belong to'}
        </Text>
      </LinearGradient>

      {screen === 'create' ? (
        <View style={styles.formWrap}>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <TextField
              label="Group name"
              value={name}
              onChangeText={setName}
              placeholder="Site team"
            />
            {showMembers ? (
              <>
                <TextField
                  label="Add members"
                  value={userQuery}
                  onChangeText={setUserQuery}
                  placeholder="Search by name or user id"
                  autoCapitalize="none"
                  editable={canPickMember}
                />
                {selectedUsers.length > 0 ? (
                  <View style={styles.chips}>
                    {selectedUsers.map((user) => (
                      <Pressable
                        key={user.userID}
                        style={styles.chip}
                        onPress={() => toggleUser(user)}
                        disabled={!canRemoveMember}
                      >
                        <Text style={styles.chipText}>{user.userName}</Text>
                        {canRemoveMember ? <Text style={styles.chipRemove}>×</Text> : null}
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                {!canSaveMembers ? (
                  <Text style={styles.userCount}>You can view people, but saving members is not allowed.</Text>
                ) : null}
                {users.length > 0 ? (
                  <Text style={styles.userCount}>
                    {filteredUsers.length} of {users.length} people
                  </Text>
                ) : null}
                <ScrollView style={styles.userList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {usersLoading ? (
                    <ActivityIndicator color={colors.primary} style={styles.userEmpty} />
                  ) : filteredUsers.length === 0 ? (
                    <Text style={styles.userEmpty}>
                      {users.length === 0
                        ? 'No people were returned.'
                        : 'No people match that search.'}
                    </Text>
                  ) : (
                    filteredUsers.map((user) => {
                      const picked = selectedUsers.some(
                        (item) => item.userID.toLowerCase() === user.userID.toLowerCase(),
                      );
                      const canToggle = picked ? canRemoveMember : canPickMember;
                      return (
                        <Pressable
                          key={user.userID}
                          style={[styles.userRow, picked && styles.userRowPicked]}
                          onPress={() => toggleUser(user)}
                          disabled={!canToggle}
                        >
                          <View style={styles.userBody}>
                            <Text style={styles.userName}>{user.userName}</Text>
                            <Text style={styles.userId}>{user.userID}</Text>
                          </View>
                          {canToggle ? (
                            <Text style={styles.userMark}>{picked ? 'Added' : 'Add'}</Text>
                          ) : null}
                        </Pressable>
                      );
                    })
                  )}
                </ScrollView>
              </>
            ) : (
              <Text style={styles.userCount}>You do not have permission to add members.</Text>
            )}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>
          <View style={styles.formFooter}>
            {canSaveGroup ? (
              <Button
                label={creating ? 'Creating…' : 'Create group'}
                onPress={handleCreate}
                disabled={creating}
                loading={creating}
              />
            ) : (
              <Text style={styles.userCount}>You do not have permission to save a group.</Text>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.listWrap}>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : (
            <FlatList
              data={groups}
              keyExtractor={(item) => item.id}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => {
                    setRefreshing(true);
                    load(true);
                  }}
                  tintColor={colors.primary}
                />
              }
              contentContainerStyle={groups.length === 0 ? styles.emptyWrap : styles.list}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={
                <View>
                  <Text style={styles.emptyTitle}>No groups yet</Text>
                  <Text style={styles.emptyBody}>Create a group and choose people from the list.</Text>
                </View>
              }
              ListHeaderComponent={
                error ? <Text style={styles.error}>{error}</Text> : null
              }
              renderItem={({ item }) => (
                <Pressable style={styles.row} onPress={() => setSelected(item)}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(item.name || '?').slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.rowBody}>
                    <View style={styles.rowTop}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {item.name || 'Group'}
                      </Text>
                      <Text style={[styles.rowTime, item.unreadCount > 0 && styles.rowTimeUnread]}>
                        {formatChatTime(item.lastMessageAt)}
                      </Text>
                    </View>
                    <Text
                      style={[styles.rowPreview, item.unreadCount > 0 && styles.rowPreviewUnread]}
                      numberOfLines={1}
                    >
                      {item.lastMessage || 'No messages yet'}
                    </Text>
                  </View>
                  {item.unreadCount > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.unreadCount}</Text>
                    </View>
                  ) : null}
                </Pressable>
              )}
            />
          )}
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ColorPalette, shadow: ShadowTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: spacing.xxxl + spacing.md,
      paddingBottom: spacing.xl,
      paddingHorizontal: spacing.xl,
      borderBottomLeftRadius: radius.xl,
      borderBottomRightRadius: radius.xl,
    },
    appBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    backBtn: {
      paddingVertical: spacing.sm,
    },
    backText: {
      ...typography.label,
      color: colors.textOnPrimary,
    },
    newBtn: {
      paddingVertical: spacing.sm,
    },
    newText: {
      ...typography.label,
      color: colors.textOnPrimary,
    },
    headerTitle: {
      ...typography.h1,
      color: colors.textOnPrimary,
      marginTop: spacing.md,
    },
    headerSubtitle: {
      ...typography.body,
      color: colors.textOnPrimary,
      opacity: 0.85,
      marginTop: spacing.xs,
    },
    listWrap: { flex: 1 },
    loader: { marginTop: spacing.xxl },
    list: {
      paddingBottom: spacing.xxxl + spacing.lg,
    },
    emptyWrap: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    emptyTitle: {
      ...typography.title,
      color: colors.text,
      textAlign: 'center',
    },
    emptyBody: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginLeft: 76,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.tintPrimary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    avatarText: {
      ...typography.title,
      color: colors.primary,
    },
    rowBody: { flex: 1 },
    rowTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    rowTitle: {
      ...typography.title,
      color: colors.text,
      flex: 1,
    },
    rowTime: {
      ...typography.caption,
      color: colors.textMuted,
    },
    rowTimeUnread: {
      color: colors.primary,
      fontWeight: '700',
    },
    rowPreview: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },
    rowPreviewUnread: {
      color: colors.text,
      fontWeight: '600',
    },
    badge: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
      marginLeft: spacing.sm,
    },
    badgeText: {
      ...typography.caption,
      color: colors.textOnPrimary,
      fontWeight: '700',
    },
    formWrap: { flex: 1 },
    form: {
      padding: spacing.xl,
      gap: spacing.md,
    },
    formFooter: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xxxl,
    },
    error: {
      ...typography.caption,
      color: colors.danger,
      marginBottom: spacing.sm,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.tintPrimary,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    chipText: {
      ...typography.caption,
      color: colors.primary,
      fontWeight: '600',
    },
    chipRemove: {
      ...typography.body,
      color: colors.primary,
      marginLeft: spacing.xs,
    },
    userList: {
      maxHeight: 280,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    userRowPicked: {
      backgroundColor: colors.tintSelected,
    },
    userBody: { flex: 1 },
    userName: {
      ...typography.label,
      color: colors.text,
    },
    userId: {
      ...typography.caption,
      color: colors.textMuted,
    },
    userMark: {
      ...typography.caption,
      color: colors.primary,
      fontWeight: '700',
    },
    userEmpty: {
      ...typography.caption,
      color: colors.textSecondary,
      padding: spacing.md,
    },
    userCount: {
      ...typography.caption,
      color: colors.textMuted,
    },
  });
}
