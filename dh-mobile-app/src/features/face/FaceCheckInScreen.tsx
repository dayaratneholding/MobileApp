import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { enrollFace, getFaceAttendance, getFaceEnrollment, markFaceAttendance } from '../../api/endpoints/face';
import { getApiErrorMessage } from '../../api/client/client';
import { Button } from '../../components/ui/Button';
import { radius, spacing, typography, type ColorPalette, type ShadowTokens } from '../../styles/theme';
import { useTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { AuthSession } from '../../types/api';
import type { AttendanceRecord, FaceEnrollment, FacePhoto, PhoneLocation } from '../../types/face';

type Props = {
  session: AuthSession;
  onBack: () => void;
};

type BusyAction = 'status' | 'enroll' | 'add' | 'mark' | null;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function todayKey(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function deviceStamp(now = new Date()): string {
  return `${todayKey(now)}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function formatLocation(
  latitude?: number | null,
  longitude?: number | null,
): string {
  if (latitude == null || longitude == null) {
    return '';
  }
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

function formatUtcStamp(value: string): string {
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const hasZone = /(?:z|[+-]\d{2}:\d{2})$/i.test(normalized);
  return new Date(hasZone ? normalized : `${normalized}Z`).toLocaleString();
}

const MAX_FACE_TRIES = 3;

function isRetryableFaceError(message: string): boolean {
  return /face|match|detect|camera|person|signature|clear/i.test(message);
}

function AutoFaceCamera({
  attempt,
  busy,
  status,
  onCapture,
  onCancel,
}: {
  attempt: number;
  busy: boolean;
  status: string;
  onCapture: (photo: FacePhoto, punchedAt: string) => void;
  onCancel: () => void;
}) {
  const cameraRef = useRef<CameraView>(null);
  const capturedAttempt = useRef(-1);
  const [ready, setReady] = useState(false);
  const [count, setCount] = useState(2);

  useEffect(() => {
    if (!ready || busy || capturedAttempt.current === attempt) {
      return;
    }

    let left = attempt === 0 ? 2 : 1;
    setCount(left);
    const timer = setInterval(() => {
      left -= 1;
      if (left > 0) {
        setCount(left);
        return;
      }

      clearInterval(timer);
      if (capturedAttempt.current === attempt) {
        return;
      }
      capturedAttempt.current = attempt;
      setCount(0);
      cameraRef.current
        ?.takePictureAsync({ quality: 0.85, shutterSound: false })
        .then((photo) => {
          if (!photo?.uri) {
            onCancel();
            return;
          }
          onCapture(
            {
              uri: photo.uri,
              fileName: 'face.jpg',
              mimeType: 'image/jpeg',
            },
            deviceStamp(),
          );
        })
        .catch(() => onCancel());
    }, 1000);

    return () => clearInterval(timer);
  }, [attempt, busy, onCancel, onCapture, ready]);

  return (
    <View style={cameraStyles.screen}>
      <CameraView
        ref={cameraRef}
        style={cameraStyles.camera}
        facing="front"
        mode="picture"
        onCameraReady={() => setReady(true)}
      />
      <View style={cameraStyles.overlay}>
        <Text style={cameraStyles.title}>{status}</Text>
        <Text style={cameraStyles.count}>{busy ? '...' : count > 0 ? count : '...'}</Text>
        <Pressable style={cameraStyles.cancel} onPress={onCancel} disabled={busy}>
          <Text style={cameraStyles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

async function captureFace(): Promise<FacePhoto | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Camera permission is required to capture your face.');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    cameraType: ImagePicker.CameraType.front,
    allowsEditing: false,
    quality: 0.7,
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    fileName: asset.fileName,
    mimeType: asset.mimeType,
  };
}

export function FaceCheckInScreen({ session, onBack }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const employeeId = session.eESerialID ?? null;
  const [enrollment, setEnrollment] = useState<FaceEnrollment | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [todayRecords, setTodayRecords] = useState<AttendanceRecord[]>([]);
  const [punch, setPunch] = useState<AttendanceRecord | null>(null);
  const [busy, setBusy] = useState<BusyAction>('status');
  const [error, setError] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [faceAttempt, setFaceAttempt] = useState(0);
  const [cameraStatus, setCameraStatus] = useState('Look at the camera');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const locationRef = useRef<PhoneLocation | null>(null);

  const loadStatus = useCallback(async () => {
    if (!employeeId) {
      setError('Employee ID was not found in this session.');
      setBusy(null);
      return;
    }

    setBusy('status');
    setError('');
    try {
      const [status, attendance] = await Promise.all([
        getFaceEnrollment(session.comSerialID, employeeId),
        getFaceAttendance({
          companyId: session.comSerialID,
          employeeId,
          attendanceDate: todayKey(),
        }),
      ]);
      setEnrollment(status);
      setTodayRecords(attendance);
    } catch (err) {
      setEnrollment(null);
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }, [employeeId, session.comSerialID]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleEnroll = async (replace: boolean) => {
    if (!employeeId) {
      setError('Employee ID was not found in this session.');
      return;
    }

    setError('');
    setPunch(null);
    setBusy(replace ? 'enroll' : 'add');
    try {
      const photo = await captureFace();
      if (!photo) {
        return;
      }

      setPhotoUri(photo.uri);
      const saved = await enrollFace({
        photo,
        companyId: session.comSerialID,
        employeeId,
        employeeName: session.userName || session.userID,
        replace,
      });
      setEnrollment(saved);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const handleAutoCapture = useCallback(async (photo: FacePhoto, punchedAt: string) => {
    setPhotoUri(photo.uri);
    setPunch(null);
    setError('');
    setBusy('mark');
    setCameraStatus('Checking face...');
    try {
      const location = locationRef.current;
      if (!location) {
        throw new Error('Phone location was not ready. Allow location and try again.');
      }
      const result = await markFaceAttendance({
        photo,
        companyId: session.comSerialID,
        punchedAt,
        location,
      });
      setPunch(result);
      setFaceAttempt(0);
      setShowCamera(false);
      if (employeeId && result.employee_id === String(employeeId)) {
        setTodayRecords((current) => [result, ...current.filter((item) => item.id !== result.id)]);
      }
      setBusy(null);
    } catch (err) {
      const message = getApiErrorMessage(err);
      if (faceAttempt < MAX_FACE_TRIES - 1 && isRetryableFaceError(message)) {
        setFaceAttempt((value) => value + 1);
        setCameraStatus('Hold still. Trying again...');
        setBusy(null);
        return;
      }
      setFaceAttempt(0);
      setShowCamera(false);
      setError(message);
      setBusy(null);
    }
  }, [employeeId, faceAttempt, session.comSerialID]);

  const handleMark = async () => {
    if (!enrollment?.enrolled) {
      setError('Enroll your face before marking attendance.');
      return;
    }

    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        setError('Camera permission is required to mark attendance.');
        return;
      }
    }

    const locationPermission = await Location.requestForegroundPermissionsAsync();
    if (!locationPermission.granted) {
      setError('Allow location so attendance can save where you are.');
      return;
    }

    setError('');
    setBusy('mark');
    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      locationRef.current = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
    } catch {
      setError('Could not read the phone location. Turn on location and try again.');
      setBusy(null);
      return;
    }

    setBusy(null);
    setPunch(null);
    setFaceAttempt(0);
    setCameraStatus('Look at the camera');
    setShowCamera(true);
  };

  if (showCamera) {
    return (
      <AutoFaceCamera
        attempt={faceAttempt}
        busy={busy === 'mark'}
        status={cameraStatus}
        onCapture={handleAutoCapture}
        onCancel={() => {
          setBusy(null);
          setFaceAttempt(0);
          setShowCamera(false);
        }}
      />
    );
  }

  const enrolled = Boolean(enrollment?.enrolled);
  const statusLabel = busy === 'status'
    ? 'Checking enrollment...'
    : enrolled
      ? `Enrolled · ${enrollment?.sample_count ?? 0} sample(s)`
      : 'Not enrolled yet';

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
        <Text style={styles.headerTitle}>Face Attendance</Text>
        <Text style={styles.headerSubtitle}>
          {session.userName || session.userID}
        </Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: enrolled ? colors.success : colors.warning },
              ]}
            />
            <Text style={styles.statusTitle}>{statusLabel}</Text>
            {busy === 'status' ? <ActivityIndicator color={colors.primary} /> : null}
          </View>
          <Text style={styles.statusHint}>
            Mark attendance uses the front camera and saves the phone time and location.
          </Text>
          {enrollment?.updated_at ? (
            <Text style={styles.statusMeta}>
              Updated {formatUtcStamp(enrollment.updated_at)}
            </Text>
          ) : null}
        </View>

        <View style={styles.preview}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.previewImage} />
          ) : (
            <Text style={styles.previewEmpty}>Your latest capture will appear here.</Text>
          )}
        </View>

        <View style={styles.todayCard}>
          <Text style={styles.todayLabel}>Today</Text>
          {todayRecords.length === 0 ? (
            <Text style={styles.todayValue}>No attendance yet today</Text>
          ) : (
            todayRecords.map((item) => (
              <View key={item.id} style={styles.punchRow}>
                <Text style={styles.todayValue}>
                  {item.attendance_date} {item.time_in ?? '—'}
                </Text>
                <Text style={styles.todayMeta}>
                  {formatLocation(item.latitude, item.longitude) || 'Location not saved'}
                </Text>
              </View>
            ))
          )}
        </View>

        {punch ? (
          <View style={[styles.resultCard, { backgroundColor: colors.tintSuccess }]}>
            <Text style={[styles.resultTitle, { color: colors.success }]}>
              {punch.message}
            </Text>
            <Text style={styles.resultBody}>
              {punch.employee_name || `Employee ${punch.employee_id}`}
            </Text>
            <Text style={styles.resultMeta}>
              {punch.attendance_date} {punch.time_in ?? '—'}
              {punch.confidence != null ? ` · ${punch.confidence.toFixed(1)}%` : ''}
            </Text>
            <Text style={styles.resultMeta}>
              {formatLocation(punch.latitude, punch.longitude) || 'Location not saved'}
            </Text>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          <Button
            label="Mark attendance"
            onPress={handleMark}
            loading={busy === 'mark'}
            disabled={busy !== null || !enrolled}
          />
          <View style={styles.gap} />
          <Button
            label={enrolled ? 'Update my face' : 'Enroll my face'}
            variant="outline"
            onPress={() => handleEnroll(true)}
            loading={busy === 'enroll'}
            disabled={busy !== null || !employeeId}
          />
          {enrolled ? (
            <>
              <View style={styles.gap} />
              <Button
                label="Add another sample"
                variant="ghost"
                onPress={() => handleEnroll(false)}
                loading={busy === 'add'}
                disabled={busy !== null || !employeeId}
              />
            </>
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
      paddingBottom: spacing.xl,
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
      marginBottom: spacing.lg,
    },
    backText: {
      ...typography.label,
      color: colors.textOnPrimary,
    },
    headerTitle: {
      ...typography.h1,
      color: colors.textOnPrimary,
    },
    headerSubtitle: {
      ...typography.body,
      color: 'rgba(255,255,255,0.85)',
      marginTop: spacing.xs,
    },
    body: {
      padding: spacing.xl,
      paddingBottom: spacing.xxxl,
    },
    statusCard: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      ...shadow.card,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: radius.pill,
      marginRight: spacing.sm,
    },
    statusTitle: {
      ...typography.title,
      color: colors.text,
      flex: 1,
    },
    statusHint: {
      ...typography.body,
      color: colors.textSecondary,
      marginTop: spacing.sm,
    },
    statusMeta: {
      ...typography.caption,
      color: colors.textMuted,
      marginTop: spacing.sm,
    },
    todayCard: {
      marginTop: spacing.lg,
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      ...shadow.soft,
    },
    todayLabel: {
      ...typography.label,
      color: colors.textMuted,
    },
    todayValue: {
      ...typography.title,
      color: colors.text,
      marginTop: spacing.xs,
    },
    todayMeta: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    punchRow: {
      marginTop: spacing.sm,
    },
    preview: {
      marginTop: spacing.lg,
      height: 220,
      borderRadius: radius.lg,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      ...shadow.soft,
    },
    previewImage: {
      width: '100%',
      height: '100%',
    },
    previewEmpty: {
      ...typography.body,
      color: colors.textMuted,
      paddingHorizontal: spacing.xl,
      textAlign: 'center',
    },
    resultCard: {
      marginTop: spacing.lg,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    resultTitle: {
      ...typography.title,
    },
    resultBody: {
      ...typography.body,
      color: colors.text,
      marginTop: spacing.xs,
    },
    resultMeta: {
      ...typography.label,
      color: colors.textSecondary,
      marginTop: spacing.sm,
    },
    error: {
      ...typography.body,
      color: colors.danger,
      marginTop: spacing.lg,
    },
    actions: {
      marginTop: spacing.lg,
    },
    gap: {
      height: spacing.md,
    },
  });
}

const cameraStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingBottom: 48,
    paddingTop: 24,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  count: {
    color: '#FFFFFF',
    fontSize: 56,
    fontWeight: '700',
    marginVertical: 8,
  },
  cancel: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  cancelText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
