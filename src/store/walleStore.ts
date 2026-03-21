import { create } from "zustand";

import type { Emotion } from "../lib/emotion";
import type { WalleAction } from "../lib/actionParser";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  at: number;
}

interface WalleStore {
  mode: "auto" | "manual_review";
  emotion: Emotion;
  isThinking: boolean;
  messages: ChatMessage[];
  pendingActions: { action: WalleAction; id: string }[];
  setMode: (m: "auto" | "manual_review") => void;
  setEmotion: (e: Emotion) => void;
  setThinking: (v: boolean) => void;
  addMessage: (m: Omit<ChatMessage, "id" | "at"> & { id?: string }) => void;
  setPendingActions: (a: { action: WalleAction; id: string }[]) => void;
  dequeueAction: (id: string) => void;
}

export const useWalleStore = create<WalleStore>((set) => ({
  mode: "manual_review",
  emotion: "idle",
  isThinking: false,
  messages: [],
  pendingActions: [],
  setMode: (mode) => set({ mode }),
  setEmotion: (emotion) => set({ emotion }),
  setThinking: (isThinking) => set({ isThinking }),
  addMessage: (m) =>
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: m.id ?? crypto.randomUUID(),
          role: m.role,
          text: m.text,
          at: Date.now(),
        },
      ],
    })),
  setPendingActions: (pendingActions) => set({ pendingActions }),
  dequeueAction: (id) =>
    set((s) => ({
      pendingActions: s.pendingActions.filter((p) => p.id !== id),
    })),
}));
