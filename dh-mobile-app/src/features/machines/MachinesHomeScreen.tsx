import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import type { MachineDirection } from '../../config/machinePdf';
import {
  radius,
  spacing,
  typography,
  type ColorPalette,
  type ShadowTokens,
} from '../../styles/theme';
import { useTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { MachinePdfUploadScreen } from './MachinePdfUploadScreen';

type Props = {
  onBack: () => void;
};

type Screen = 'home' | MachineDirection;

type MachineOption = {
  key: MachineDirection;
  title: string;
  subtitle: string;
  emoji: string;
  tint: string;
  accent: string;
};

export function MachinesHomeScreen({ onBack }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [screen, setScreen] = useState<Screen>('home');

  const options: MachineOption[] = [
    {
      key: 'OUT',
      title: 'Machines OUT',
      subtitle: 'Upload outgoing machine PDF',
      emoji: '📤',
      tint: colors.tintDanger,
      accent: colors.danger,
    },
    {
      key: 'IN',
      title: 'Machines IN',
      subtitle: 'Upload incoming machine PDF',
      emoji: '📥',
      tint: colors.tintSuccess,
      accent: colors.success,
    },
  ];

  if (screen === 'OUT' || screen === 'IN') {
    return (
      <MachinePdfUploadScreen
        direction={screen}
        onBack={() => setScreen('home')}
      />
    );
  }

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
            <Pressable style={styles.backBtn} onPress={onBack} hitSlop={8}>
              <Text style={styles.backText}>← Back</Text>
            </Pressable>
          </View>

          <View style={styles.headerContent}>
            <Text style={styles.headerEmoji}>⚙️</Text>
            <Text style={styles.headerTitle}>Machines</Text>
            <Text style={styles.headerSubtitle}>
              Upload PDF files for machine IN / OUT
            </Text>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          <Text style={styles.sectionTitle}>Select direction</Text>
          <View style={styles.grid}>
            {options.map((option) => (
              <Pressable
                key={option.key}
                style={styles.card}
                onPress={() => setScreen(option.key)}
              >
                <View style={[styles.icon, { backgroundColor: option.tint }]}>
                  <Text style={styles.emoji}>{option.emoji}</Text>
                </View>
                <Text style={styles.cardTitle}>{option.title}</Text>
                <Text style={styles.cardSubtitle}>{option.subtitle}</Text>
                <Text style={[styles.cardAction, { color: option.accent }]}>
                  Open ›
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
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
      paddingBottom: spacing.xxxl,
      paddingHorizontal: spacing.xl,
      borderBottomLeftRadius: radius.xl,
      borderBottomRightRadius: radius.xl,
    },
    appBar: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    backBtn: {
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
    },
    backText: {
      ...typography.label,
      color: colors.textOnPrimary,
    },
    headerContent: {
      marginTop: spacing.xl,
    },
    headerEmoji: {
      fontSize: 36,
      marginBottom: spacing.sm,
    },
    headerTitle: {
      ...typography.h2,
      color: colors.textOnPrimary,
    },
    headerSubtitle: {
      ...typography.body,
      color: 'rgba(255,255,255,0.85)',
      marginTop: spacing.xs,
    },
    body: {
      padding: spacing.xl,
    },
    sectionTitle: {
      ...typography.h3,
      color: colors.text,
      marginBottom: spacing.lg,
      marginTop: spacing.sm,
    },
    grid: {
      gap: spacing.lg,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.xl,
      ...shadow.soft,
    },
    icon: {
      width: 56,
      height: 56,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    emoji: {
      fontSize: 28,
    },
    cardTitle: {
      ...typography.title,
      color: colors.text,
    },
    cardSubtitle: {
      ...typography.caption,
      color: colors.textMuted,
      marginTop: 2,
    },
    cardAction: {
      ...typography.label,
      marginTop: spacing.md,
    },
  });
}
