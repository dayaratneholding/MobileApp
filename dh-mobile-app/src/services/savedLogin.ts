import * as SecureStore from 'expo-secure-store';
import { login } from '../api/endpoints/auth';
import type { AuthSession } from '../types/api';

const KEY = 'psk.saved-login';

export type SavedLogin = {
  userID: string;
  password: string;
  comSerialID: number;
  companyName: string;
  companyCode: string;
};

export async function saveSavedLogin(value: SavedLogin): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(value));
}

export async function loadSavedLogin(): Promise<SavedLogin | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as SavedLogin;
    if (!parsed.userID || !parsed.password || !parsed.comSerialID) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearSavedLogin(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}

export async function restoreSavedSession(): Promise<AuthSession | null> {
  const saved = await loadSavedLogin();
  if (!saved) return null;

  return login({
    userID: saved.userID,
    password: saved.password,
    comSerialID: saved.comSerialID,
    company: {
      comSerialID: saved.comSerialID,
      comName: saved.companyName,
      comCode: saved.companyCode,
    },
  });
}
