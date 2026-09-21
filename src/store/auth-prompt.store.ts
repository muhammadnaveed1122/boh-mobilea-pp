import { create } from 'zustand';

interface AuthPromptState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useAuthPromptStore = create<AuthPromptState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
