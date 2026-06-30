import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LoginScreen } from './src/features/auth/LoginScreen';
import { HomeScreen } from './src/features/home/HomeScreen';
import { Dashboard } from './src/features/Dashboard/Dashboard';
import { colors } from './src/styles/theme';

type AppPhase = 'home-preview' | 'login' | 'authenticated';

const SPLASH_DURATION_MS = 5000;

export default function App() {
  const [phase, setPhase] = useState<AppPhase>('home-preview');
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    if (phase !== 'home-preview') return;

    const timer = setTimeout(() => {
      setPhase('login');
    }, SPLASH_DURATION_MS);

    return () => clearTimeout(timer);
  }, [phase]);

  const handleLogin = (email: string) => {
    setUserEmail(email);
    setPhase('authenticated');
  };

  const handleLogout = () => {
    setUserEmail(null);
    setPhase('login');
  };

  return (
    <View style={styles.container}>
      {phase === 'authenticated' ? (
        <Dashboard userEmail={userEmail ?? undefined} onLogout={handleLogout} />
      ) : phase === 'home-preview' ? (
        <HomeScreen
          userEmail={userEmail ?? undefined}
          isPreview
          onLogout={handleLogout}
        />
      ) : (
        <LoginScreen onLogin={handleLogin} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
