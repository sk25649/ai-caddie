import * as SecureStore from 'expo-secure-store';
import type { Playbook } from './api';

const LAST_PLAYBOOK_KEY = 'last_playbook';
const ONBOARDING_COMPLETE_KEY = 'onboarding_complete';

export async function cachePlaybook(playbook: Playbook): Promise<void> {
  await SecureStore.setItemAsync(LAST_PLAYBOOK_KEY, JSON.stringify(playbook));
}

export async function getCachedPlaybook(): Promise<Playbook | null> {
  const raw = await SecureStore.getItemAsync(LAST_PLAYBOOK_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as Playbook;
}

export async function clearCachedPlaybook(): Promise<void> {
  await SecureStore.deleteItemAsync(LAST_PLAYBOOK_KEY);
}

export async function setOnboardingComplete(): Promise<void> {
  await SecureStore.setItemAsync(ONBOARDING_COMPLETE_KEY, 'true');
}

export async function isOnboardingComplete(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(ONBOARDING_COMPLETE_KEY);
  return val === 'true';
}
