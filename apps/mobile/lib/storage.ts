import * as SecureStore from 'expo-secure-store';
import type { Playbook } from './api';

const LAST_PLAYBOOK_KEY = 'last_playbook';
const ONBOARDING_COMPLETE_KEY = 'onboarding_complete';

export async function cachePlaybook(playbook: Playbook): Promise<void> {
  try {
    await SecureStore.setItemAsync(LAST_PLAYBOOK_KEY, JSON.stringify(playbook));
  } catch {
    // SecureStore write failed — non-fatal, playbook is still in memory
  }
}

export async function getCachedPlaybook(): Promise<Playbook | null> {
  try {
    const raw = await SecureStore.getItemAsync(LAST_PLAYBOOK_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Playbook;
  } catch {
    return null;
  }
}

export async function clearCachedPlaybook(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(LAST_PLAYBOOK_KEY);
  } catch {
    // Best-effort cleanup
  }
}

export async function setOnboardingComplete(): Promise<void> {
  try {
    await SecureStore.setItemAsync(ONBOARDING_COMPLETE_KEY, 'true');
  } catch {
    // Non-fatal — user may need to re-onboard next launch
  }
}

export async function isOnboardingComplete(): Promise<boolean> {
  try {
    const val = await SecureStore.getItemAsync(ONBOARDING_COMPLETE_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}
