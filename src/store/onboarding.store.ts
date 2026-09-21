import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const KEY = 'onboarding.seen';

interface OnboardingState {
  hasSeenOnboarding: boolean | null;
  loadOnboardingState: () => Promise<void>;
  markOnboardingSeen: () => Promise<void>;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  hasSeenOnboarding: null,

  loadOnboardingState: async () => {
    const v = await AsyncStorage.getItem(KEY);
    set({ hasSeenOnboarding: v === 'true' });
  },

  markOnboardingSeen: async () => {
    await AsyncStorage.setItem(KEY, 'true');
    set({ hasSeenOnboarding: true });
  },
}));
