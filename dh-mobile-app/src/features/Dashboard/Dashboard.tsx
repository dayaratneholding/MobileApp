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
  onLogout: () => void;
};

type Widget = {
  key: string;
  title: string;
  subtitle: string;
  value: string;
  emoji: string;
  tint: string;
  accent: string;
};

const widgets: Widget[] = [
  {
    key: 'leave',
    title: 'Leave Management',
    subtitle: 'Balance remaining',
    value: '12 days',
    emoji: '🏖️',
    tint: '#E0E7FF',
    accent: colors.primary,
  },
  {
    key: 'attendance',
    title: 'Attendance',
    subtitle: 'This month',
    value: '18 / 20',
    emoji: '🕒',
    tint: '#DCFCE7',
    accent: colors.success,
  },
  {
    key: 'salary',
    title: 'Salary',
    subtitle: 'Next payout',
    value: 'Jul 30',
    emoji: '💰',
    tint: '#FEF3C7',
    accent: colors.warning,
  },
  {
    key: 'salary-advance',
    title: 'Salary Advance',
    subtitle: 'Available',
    value: 'Request',
    emoji: '💳',
    tint: '#FEE2E2',
    accent: colors.danger,
  },
];

export function Dashboard({ userEmail, onLogout }: Props) {
  const name = userEmail ? userEmail.split('@')[0] : 'Employee';
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });

  return (
    <View style={styles.container}>
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
            <Pressable style={styles.logoutBtn} onPress={onLogout} hitSlop={8}>
              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
          </View>

          <View style={styles.greetingBlock}>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.name}>{name} 👋</Text>
            <Text style={styles.date}>{today}</Text>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>18</Text>
              <Text style={styles.summaryLabel}>Present</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>2</Text>
              <Text style={styles.summaryLabel}>Leaves</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>12</Text>
              <Text style={styles.summaryLabel}>Balance</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Services</Text>
          <View style={styles.grid}>
            {widgets.map((w) => (
              <Pressable key={w.key} style={styles.widgetCard}>
                <View style={[styles.widgetIcon, { backgroundColor: w.tint }]}>
                  <Text style={styles.widgetEmoji}>{w.emoji}</Text>
                </View>
                <Text style={styles.widgetTitle}>{w.title}</Text>
                <Text style={styles.widgetSubtitle}>{w.subtitle}</Text>
                <Text style={[styles.widgetValue, { color: w.accent }]}>
                  {w.value}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Quick links</Text>
          <View style={styles.linksCard}>
            <Row emoji="✅" label="Mark Attendance" />
            <Divider />
            <Row emoji="📝" label="Apply for Leave" />
            <Divider />
            <Row emoji="📄" label="View Payslip" />
            <Divider />
            <Row emoji="💳" label="Request Salary Advance" last />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function Row({
  emoji,
  label,
  last = false,
}: {
  emoji: string;
  label: string;
  last?: boolean;
}) {
  return (
    <Pressable style={styles.row}>
      <Text style={styles.rowEmoji}>{emoji}</Text>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowChevron}>›</Text>
    </Pressable>
  );
}

function Divider() {
  return <View style={styles.rowDivider} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginTop: -spacing.xxxl,
    marginBottom: spacing.xl,
    alignItems: 'center',
    ...shadow.card,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border,
  },
  summaryValue: {
    ...typography.h2,
    color: colors.primary,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  widgetCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.soft,
  },
  widgetIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  widgetEmoji: {
    fontSize: 26,
  },
  widgetTitle: {
    ...typography.title,
    color: colors.text,
  },
  widgetSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  widgetValue: {
    ...typography.h3,
    marginTop: spacing.sm,
  },
  linksCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    ...shadow.soft,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  rowEmoji: {
    fontSize: 20,
    marginRight: spacing.lg,
  },
  rowLabel: {
    ...typography.title,
    color: colors.text,
    flex: 1,
  },
  rowChevron: {
    fontSize: 26,
    color: colors.textMuted,
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
});
