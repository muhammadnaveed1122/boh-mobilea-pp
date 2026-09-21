import { create } from 'zustand';

import type { MessageLocation } from '../models/message';

export interface LocationDraft {
  conversationId: string;
  location: MessageLocation;
}

interface LocationDraftState {
  draft: LocationDraft | null;
  setDraft: (draft: LocationDraft) => void;
  clear: () => void;
}

/**
 * One-shot hand-off channel from the location-picker screen back to the
 * conversation that opened it. The picker sets a draft then navigates back;
 * ConversationScreen consumes it (matching its own conversationId) and clears.
 */
export const useLocationDraft = create<LocationDraftState>((set) => ({
  draft: null,
  setDraft: (draft) => set({ draft }),
  clear: () => set({ draft: null }),
}));
