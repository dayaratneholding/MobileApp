import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LoginScreen } from './src/features/auth/LoginScreen';
import { HomeScreen } from './src/features/home/HomeScreen';
import { Dashboard } from './src/features/Dashboard/Dashboard';
import { unregisterChatDevice } from './src/api/endpoints/chat';
import type { AuthSession } from './src/types/api';
import { setAuthToken } from './src/services/authToken';
import { getRegisteredPushToken } from './src/services/chatAlerts';
import { clearSavedLogin, restoreSavedSession } from './src/services/savedLogin';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';

type AppPhase = 'home-preview' | 'login' | 'authenticated';

const SPLASH_DURATION_MS = 5000;

function AppShell() {
  const { colors } = useTheme();
  const [phase, setPhase] = useState<AppPhase>('home-preview');
  const [session, setSession] = useState<AuthSession | null>(null);
  const [restoreDone, setRestoreDone] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    let cancelled = false;
    restoreSavedSession()
      .then((restored) => {
        if (cancelled || !restored) return;
        setSession(restored);
        setAuthToken(restored.token);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setRestoreDone(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (phase !== 'home-preview' || !restoreDone) return;

    const wait = Math.max(0, SPLASH_DURATION_MS - (Date.now() - startedAt.current));
    const timer = setTimeout(() => {
      setPhase(session ? 'authenticated' : 'login');
    }, wait);

    return () => clearTimeout(timer);
  }, [phase, restoreDone, session]);

  const handleLogin = (authSession: AuthSession) => {
    setSession(authSession);
    setAuthToken(authSession.token);
    setPhase('authenticated');
  };

  const handleLogout = () => {
    const pushToken = getRegisteredPushToken();
    if (pushToken) {
      unregisterChatDevice(pushToken).catch(() => undefined);
    }
    clearSavedLogin().catch(() => undefined);
    setSession(null);
    setAuthToken(null);
    setPhase('login');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {phase === 'authenticated' ? (
        <Dashboard session={session!} onLogout={handleLogout} />
      ) : phase === 'home-preview' ? (
        <HomeScreen isPreview onLogout={handleLogout} />
      ) : (
        <LoginScreen onLogin={handleLogin} />
      )}
    </View>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
