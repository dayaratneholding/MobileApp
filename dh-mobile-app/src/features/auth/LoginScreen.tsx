import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { login } from '../../api/endpoints/auth';
import { getUserCompanies } from '../../api/endpoints/companies';
import { getApiErrorMessage } from '../../api/client/client';
import { Button } from '../../components/ui/Button';
import { CompanyPicker } from '../../components/forms/CompanyPicker';
import { TextField } from '../../components/ui/TextField';
import { colors, radius, spacing, typography, shadow } from '../../styles/theme';
import type { AuthSession, UserCompany } from '../../types/api';

type Props = {
  onLogin: (session: AuthSession) => void;
};

export function LoginScreen({ onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [companies, setCompanies] = useState<UserCompany[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<UserCompany | null>(null);
  const [companiesLoaded, setCompaniesLoaded] = useState(false);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [error, setError] = useState('');

  const handleLoadCompanies = async () => {
    if (!username.trim()) {
      setError('Please enter your username.');
      return;
    }

    setError('');
    setLoadingCompanies(true);
    setCompanies([]);
    setSelectedCompany(null);
    setCompaniesLoaded(false);
    setPassword('');

    try {
      const result = await getUserCompanies(username.trim());

      if (result.length === 0) {
        setError('No companies found for this username.');
      }

      setCompanies(result);
      setCompaniesLoaded(true);

      if (result.length === 1) {
        setSelectedCompany(result[0]);
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
      setCompaniesLoaded(false);
    } finally {
      setLoadingCompanies(false);
    }
  };

  const handleLogin = async () => {
    if (!username.trim()) {
      setError('Please enter your username.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    if (!selectedCompany?.comSerialID) {
      setError('Please select a company.');
      return;
    }

    setError('');
    setLoadingLogin(true);

    try {
      const session = await login({
        userID: username.trim(),
        comSerialID: Number(selectedCompany.comSerialID),
        password,
        company: selectedCompany,
      });

      onLogin(session);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoadingLogin(false);
    }
  };

  const handleUsernameChange = (value: string) => {
    setUsername(value);
    if (companiesLoaded) {
      setCompaniesLoaded(false);
      setCompanies([]);
      setSelectedCompany(null);
      setPassword('');
      setError('');
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.logoCircle}>
          <Image
            source={require('../../../assets/psk-logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.headerTitle}>Welcome back</Text>
        <Text style={styles.headerSubtitle}>
          Sign in to manage attendance & leave
        </Text>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Login to your account</Text>

            <TextField
              label="Username"
              placeholder="Enter your username"
              autoCapitalize="none"
              value={username}
              onChangeText={handleUsernameChange}
              onSubmitEditing={handleLoadCompanies}
              returnKeyType="next"
            />

            {!companiesLoaded ? (
              <Button
                label="Continue"
                onPress={handleLoadCompanies}
                loading={loadingCompanies}
                variant="outline"
              />
            ) : (
              <>
                <CompanyPicker
                  companies={companies}
                  selected={selectedCompany}
                  loading={loadingCompanies}
                  onSelect={setSelectedCompany}
                />

                <TextField
                  label="Password"
                  placeholder="Enter your password"
                  isPassword
                  value={password}
                  onChangeText={setPassword}
                />

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <Pressable style={styles.forgot} hitSlop={8}>
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </Pressable>

                <Button
                  label="Sign In"
                  onPress={handleLogin}
                  loading={loadingLogin}
                  disabled={!selectedCompany}
                />

                <Pressable
                  style={styles.changeUser}
                  onPress={() => {
                    setCompaniesLoaded(false);
                    setCompanies([]);
                    setSelectedCompany(null);
                    setPassword('');
                    setError('');
                  }}
                >
                  <Text style={styles.changeUserText}>Change username</Text>
                </Pressable>
              </>
            )}

            {!companiesLoaded && error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}
          </View>

          <Text style={styles.footerText}>
            Don't have an account?{' '}
            <Text style={styles.footerLink}>Contact HR</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingTop: spacing.xxxl + spacing.lg,
    paddingBottom: spacing.xxxl + spacing.xl,
    paddingHorizontal: spacing.xl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    alignItems: 'center',
  },
  logoCircle: {
    width: 84,
    height: 84,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    padding: spacing.md,
    ...shadow.soft,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  headerTitle: {
    ...typography.h1,
    color: colors.textOnPrimary,
  },
  headerSubtitle: {
    ...typography.body,
    color: 'rgba(255,255,255,0.85)',
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  scroll: {
    padding: spacing.xl,
    paddingTop: 0,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginTop: -spacing.xxl,
    ...shadow.card,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xl,
  },
  forgot: {
    alignSelf: 'flex-end',
    marginBottom: spacing.xl,
  },
  forgotText: {
    ...typography.label,
    color: colors.primary,
  },
  changeUser: {
    alignSelf: 'center',
    marginTop: spacing.lg,
  },
  changeUserText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.md,
    textAlign: 'left',
    lineHeight: 20,
  },
  footerText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  footerLink: {
    color: colors.primary,
    fontWeight: '600',
  },
});
