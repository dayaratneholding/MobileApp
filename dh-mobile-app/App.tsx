import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LoginScreen } from './src/features/auth/LoginScreen';
import { HomeScreen } from './src/features/home/HomeScreen';
import { Dashboard } from './src/features/Dashboard/Dashboard';
import type { AuthSession } from './src/types/api';
import { setAuthToken } from './src/services/authToken';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';

type AppPhase = 'home-preview' | 'login' | 'authenticated';

const SPLASH_DURATION_MS = 5000;

function AppShell() {
  const { colors } = useTheme();
  const [phase, setPhase] = useState<AppPhase>('home-preview');
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    if (phase !== 'home-preview') return;

    const timer = setTimeout(() => {
      setPhase('login');
    }, SPLASH_DURATION_MS);

    return () => clearTimeout(timer);
  }, [phase]);

  const handleLogin = (authSession: AuthSession) => {
    setSession(authSession);
    setAuthToken(authSession.token);
    setPhase('authenticated');
  };

  const handleLogout = () => {
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
