// Lightweight global toast queue. Mirrors the notification-banner store shape
// (Zustand store + global host overlay in app/_layout.tsx), but is UI-agnostic
// so non-React code — the axios interceptor in src/lib/api.ts — can fire a
// toast via the exported `showToast`/`showErrorToast` helpers.

import { create } from 'zustand';

export type ToastType = 'error' | 'success' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

// Auto-dismiss delay. Errors linger a touch longer so the message is readable.
const TOAST_TTL_MS = 4000;

interface ToastState {
  toasts: ToastItem[];
  push: (toast: { type: ToastType; message: string }) => void;
  remove: (id: string) => void;
}

// Module counter for ids — Date.now()/Math.random() are unavailable in this
// build environment, and a monotonic seq is enough for React keys.
let _seq = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  push: ({ type, message }) => {
    const text = message?.trim();
    if (!text) return;
    const id = String(++_seq);
    set((s) => ({ toasts: [...s.toasts, { id, type, message: text }] }));
    setTimeout(() => get().remove(id), TOAST_TTL_MS);
  },

  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative API for non-React callers (interceptors, callbacks). */
export function showToast(type: ToastType, message: string): void {
  useToastStore.getState().push({ type, message });
}

export function showErrorToast(message: string): void {
  showToast('error', message);
}
