import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Button } from '../../components/ui/Button';
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
import {
  formatFileSize,
  getConfiguredMachinePath,
  pickPdf,
  uploadMachinePdf,
  type PickedPdf,
  type UploadedMachinePdf,
} from '../../utils/machinePdfUpload';

type Props = {
  direction: MachineDirection;
  onBack: () => void;
};

const DIRECTION_META: Record<
  MachineDirection,
  { title: string; subtitle: string; emoji: string; tintKey: keyof ColorPalette }
> = {
  OUT: {
    title: 'Machines OUT',
    subtitle: 'Upload outgoing machine PDF',
    emoji: '📤',
    tintKey: 'tintDanger',
  },
  IN: {
    title: 'Machines IN',
    subtitle: 'Upload incoming machine PDF',
    emoji: '📥',
    tintKey: 'tintSuccess',
  },
};

export function MachinePdfUploadScreen({ direction, onBack }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const meta = DIRECTION_META[direction];
  const configuredPath = getConfiguredMachinePath(direction);

  const [picked, setPicked] = useState<PickedPdf | null>(null);
  const [uploaded, setUploaded] = useState<UploadedMachinePdf | null>(null);
  const [picking, setPicking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handlePick = async () => {
    setPicking(true);
    setError('');
    setUploaded(null);

    try {
      const result = await pickPdf();
      if (result) {
        setPicked(result);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not open the file picker.';
      setError(message);
    } finally {
      setPicking(false);
    }
  };

  const handleUpload = async () => {
    if (!picked) {
      setError('Please select a PDF first.');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const result = await uploadMachinePdf(direction, picked);
      setUploaded(result);
      setPicked(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'PDF upload failed.';
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  const handleClear = () => {
    setPicked(null);
    setUploaded(null);
    setError('');
  };

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
            <View
              style={[
                styles.headerIcon,
                { backgroundColor: colors[meta.tintKey] as string },
              ]}
            >
              <Text style={styles.headerEmoji}>{meta.emoji}</Text>
            </View>
            <Text style={styles.headerTitle}>{meta.title}</Text>
            <Text style={styles.headerSubtitle}>{meta.subtitle}</Text>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>SAVE LOCATION (DEMO)</Text>
            <Text style={styles.pathText}>{configuredPath}</Text>
            <Text style={styles.hintText}>
              Demo path — replace in src/config/machinePdf.ts when you have the
              final folder.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>PDF FILE</Text>

            {picked ? (
              <View style={styles.fileBox}>
                <Text style={styles.fileEmoji}>📄</Text>
                <View style={styles.fileMeta}>
                  <Text style={styles.fileName} numberOfLines={2}>
                    {picked.name}
                  </Text>
                  <Text style={styles.fileSize}>
                    {formatFileSize(picked.size)}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>📂</Text>
                <Text style={styles.emptyTitle}>No PDF selected</Text>
                <Text style={styles.emptySubtitle}>
                  Choose a PDF to upload. It will be renamed with the current
                  date and time.
                </Text>
              </View>
            )}

            <Button
              label={picked ? 'Choose another PDF' : 'Select PDF'}
              variant="outline"
              onPress={handlePick}
              loading={picking}
              disabled={uploading}
              style={styles.actionBtn}
            />

            <Button
              label="Upload PDF"
              onPress={handleUpload}
              loading={uploading}
              disabled={!picked || picking}
              style={styles.actionBtn}
            />

            {(picked || uploaded) && !uploading ? (
              <Button
                label="Clear"
                variant="ghost"
                onPress={handleClear}
                style={styles.actionBtn}
              />
            ) : null}
          </View>

          {uploading ? (
            <View style={styles.statusCard}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.statusText}>Uploading and renaming…</Text>
            </View>
          ) : null}

          {error ? (
            <View style={[styles.statusCard, styles.errorCard]}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {uploaded ? (
            <View style={[styles.statusCard, styles.successCard]}>
              <Text style={styles.successTitle}>Upload successful</Text>
              <Text style={styles.successRow}>
                Renamed to:{' '}
                <Text style={styles.successStrong}>{uploaded.savedName}</Text>
              </Text>
              <Text style={styles.successRow}>
                Configured path:{' '}
                <Text style={styles.successStrong}>
                  {uploaded.configuredPath}
                </Text>
              </Text>
              <Text style={styles.successRow}>
                Saved on device:{' '}
                <Text style={styles.successStrong}>{uploaded.savedUri}</Text>
              </Text>
            </View>
          ) : null}
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
      alignItems: 'flex-start',
    },
    headerIcon: {
      width: 56,
      height: 56,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    headerEmoji: {
      fontSize: 28,
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
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.xl,
      marginBottom: spacing.lg,
      ...shadow.soft,
    },
    cardLabel: {
      ...typography.caption,
      color: colors.textMuted,
      letterSpacing: 1,
      fontWeight: '700',
      marginBottom: spacing.md,
    },
    pathText: {
      ...typography.title,
      color: colors.text,
    },
    hintText: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: spacing.sm,
    },
    emptyBox: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
      marginBottom: spacing.lg,
      backgroundColor: colors.inputBg,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
    },
    emptyEmoji: {
      fontSize: 32,
      marginBottom: spacing.sm,
    },
    emptyTitle: {
      ...typography.title,
      color: colors.text,
    },
    emptySubtitle: {
      ...typography.caption,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.xs,
    },
    fileBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBg,
      borderRadius: radius.md,
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    fileEmoji: {
      fontSize: 28,
      marginRight: spacing.md,
    },
    fileMeta: {
      flex: 1,
    },
    fileName: {
      ...typography.title,
      color: colors.text,
    },
    fileSize: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },
    actionBtn: {
      marginBottom: spacing.md,
    },
    statusCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.xl,
      marginBottom: spacing.lg,
      ...shadow.soft,
    },
    statusText: {
      ...typography.body,
      color: colors.textSecondary,
      marginTop: spacing.md,
      textAlign: 'center',
    },
    errorCard: {
      borderWidth: 1,
      borderColor: colors.danger,
    },
    errorText: {
      ...typography.body,
      color: colors.danger,
    },
    successCard: {
      borderWidth: 1,
      borderColor: colors.success,
    },
    successTitle: {
      ...typography.title,
      color: colors.success,
      marginBottom: spacing.md,
    },
    successRow: {
      ...typography.caption,
      color: colors.textSecondary,
      marginBottom: spacing.sm,
    },
    successStrong: {
      ...typography.caption,
      color: colors.text,
      fontWeight: '600',
    },
  });
}
