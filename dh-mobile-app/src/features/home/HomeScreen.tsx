import React from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { colors, radius, spacing, typography, shadow } from '../../styles/theme';

type Props = {
  userEmail?: string;
  isPreview?: boolean;
  onLogout: () => void;
};

const quickActions = [
  { key: 'checkin', label: 'Check In', emoji: '✅', tint: '#DCFCE7' },
  { key: 'checkout', label: 'Check Out', emoji: '🏁', tint: '#FEE2E2' },
  { key: 'leave', label: 'Apply Leave', emoji: '🏖️', tint: '#E0E7FF' },
  { key: 'reports', label: 'Reports', emoji: '📊', tint: '#FEF3C7' },
];

const leaveBalances = [
  { key: 'annual', label: 'Annual', used: 6, total: 14, color: colors.primary },
  { key: 'casual', label: 'Casual', used: 3, total: 7, color: colors.accent },
  { key: 'sick', label: 'Sick', used: 1, total: 7, color: colors.warning },
];

const activity = [
  { key: '1', title: 'Checked in', time: 'Today, 09:02 AM', emoji: '🟢' },
  { key: '2', title: 'Leave approved', time: 'Yesterday, 04:30 PM', emoji: '🔵' },
  { key: '3', title: 'Checked out', time: 'Yesterday, 06:10 PM', emoji: '🔴' },
];

export function HomeScreen({ userEmail, isPreview = false, onLogout }: Props) {
  const name = userEmail ? userEmail.split('@')[0] : 'Employee';
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.appBar}>
            <View style={styles.brandRow}>
              <View style={styles.logoBadge}>
                <Image
                  source={require('../../../assets/psk-logo.png')}
                  style={styles.brandLogo}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.brandName}>PSK</Text>
            </View>
            {!isPreview ? (
              <Pressable style={styles.logoutBtn} onPress={onLogout} hitSlop={8}>
                <Text style={styles.logoutText}>Logout</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.greetingBlock}>
            <Text style={styles.greeting}>Good morning,</Text>
            <Text style={styles.name}>{name} 👋</Text>
            <Text style={styles.date}>{today}</Text>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          <View style={styles.heroCard}>
            <View style={styles.heroLeft}>
              <Text style={styles.heroLabel}>TODAY'S STATUS</Text>
              <Text style={styles.heroStatus}>Not checked in</Text>
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>Shift 09:00 - 18:00</Text>
              </View>
            </View>
            <Pressable style={styles.checkInBtn}>
              <LinearGradient
                colors={[colors.gradientStart, colors.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.checkInGradient}
              >
                <Text style={styles.checkInEmoji}>👆</Text>
                <Text style={styles.checkInText}>Check In</Text>
              </LinearGradient>
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>Quick actions</Text>
          <View style={styles.grid}>
            {quickActions.map((a) => (
              <Pressable key={a.key} style={styles.actionCard}>
                <View style={[styles.actionIcon, { backgroundColor: a.tint }]}>
                  <Text style={styles.actionEmoji}>{a.emoji}</Text>
                </View>
                <Text style={styles.actionLabel}>{a.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Leave balance</Text>
            <Text style={styles.linkText}>View all</Text>
          </View>
          <View style={styles.balanceCard}>
            {leaveBalances.map((b, idx) => {
              const remaining = b.total - b.used;
              const pct = Math.max(0, Math.min(1, remaining / b.total));
              return (
                <View
                  key={b.key}
                  style={[
                    styles.balanceRow,
                    idx !== leaveBalances.length - 1 && styles.balanceSpacing,
                  ]}
                >
                  <View style={styles.balanceTop}>
                    <Text style={styles.balanceLabel}>{b.label}</Text>
                    <Text style={styles.balanceValue}>
                      {remaining}
                      <Text style={styles.balanceTotal}> / {b.total} days</Text>
                    </Text>
                  </View>
                  <View style={styles.track}>
                    <View
                      style={[
                        styles.trackFill,
                        { width: `${pct * 100}%`, backgroundColor: b.color },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>Recent activity</Text>
          <View style={styles.activityCard}>
            {activity.map((item, idx) => (
              <View
                key={item.key}
                style={[
                  styles.activityRow,
                  idx !== activity.length - 1 && styles.activityDivider,
                ]}
              >
                <Text style={styles.activityEmoji}>{item.emoji}</Text>
                <View style={styles.flex}>
                  <Text style={styles.activityTitle}>{item.title}</Text>
                  <Text style={styles.activityTime}>{item.time}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingTop: spacing.xxxl + spacing.md,
    paddingBottom: spacing.xxxl + spacing.xl,
    paddingHorizontal: spacing.xl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
    ...shadow.soft,
  },
  brandLogo: {
    width: '100%',
    height: '100%',
  },
  brandName: {
    ...typography.h3,
    color: colors.textOnPrimary,
    marginLeft: spacing.md,
    letterSpacing: 1,
  },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  logoutText: {
    ...typography.label,
    color: colors.textOnPrimary,
  },
  greetingBlock: {
    marginTop: spacing.xl,
  },
  greeting: {
    ...typography.body,
    color: 'rgba(255,255,255,0.85)',
  },
  name: {
    ...typography.h1,
    color: colors.textOnPrimary,
    textTransform: 'capitalize',
  },
  date: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.8)',
    marginTop: spacing.xs,
  },
  body: {
    padding: spacing.xl,
  },
  heroCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginTop: -spacing.xxxl,
    marginBottom: spacing.xl,
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadow.card,
  },
  heroLeft: {
    flex: 1,
  },
  heroLabel: {
    ...typography.caption,
    color: colors.textMuted,
    letterSpacing: 1,
    fontWeight: '600',
  },
  heroStatus: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.xs,
  },
  heroPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.inputBg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginTop: spacing.md,
  },
  heroPillText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  checkInBtn: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginLeft: spacing.lg,
  },
  checkInGradient: {
    width: 92,
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInEmoji: {
    fontSize: 22,
    marginBottom: 2,
  },
  checkInText: {
    ...typography.label,
    color: colors.textOnPrimary,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkText: {
    ...typography.label,
    color: colors.primary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  actionCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.soft,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  actionEmoji: {
    fontSize: 24,
  },
  actionLabel: {
    ...typography.title,
    color: colors.text,
  },
  balanceCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    ...shadow.soft,
  },
  balanceRow: {},
  balanceSpacing: {
    marginBottom: spacing.lg,
  },
  balanceTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.sm,
  },
  balanceLabel: {
    ...typography.title,
    color: colors.text,
  },
  balanceValue: {
    ...typography.title,
    color: colors.text,
  },
  balanceTotal: {
    ...typography.caption,
    color: colors.textMuted,
  },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.inputBg,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  activityCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    ...shadow.soft,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  activityDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  activityEmoji: {
    fontSize: 18,
    marginRight: spacing.lg,
  },
  activityTitle: {
    ...typography.title,
    color: colors.text,
  },
  activityTime: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
