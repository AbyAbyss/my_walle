import { create } from "zustand";

import type { Animation } from "../lib/animation";
import type { Emotion } from "../lib/emotion";
import { emitMascotAnimation } from "../lib/mascotBridge";
import type { WalleAction } from "../lib/actionParser";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  at: number;
}

export interface Workflow {
  name: string;
  description?: string;
  steps: WalleAction[];
  created_at: string;
}

export interface LLMUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/** Live narration steps when “Show your work” is enabled. */
export type WorkStepKind =
  | "work:thinking"
  | "work:action"
  | "work:success"
  | "work:output"
  | "work:done"
  | "work:error";

export interface WorkStep {
  id: string;
  kind: WorkStepKind;
  text: string;
  plugin?: string;
  at: number;
}

interface WalleStore {
  mode: "auto" | "manual_review";
  emotion: Emotion;
  isThinking: boolean;
  messages: ChatMessage[];
  /** At most one action awaiting Allow/Deny — sequential multi-action plans use this. */
  pendingAction: WalleAction | null;
  approvalCallback: ((approved: boolean) => void) | null;
  workflows: Workflow[];
  lastUsedModel: string | null;
  lastUsage: LLMUsage | null;
  workSteps: WorkStep[];
  addWorkStep: (step: Omit<WorkStep, "id" | "at"> & { id?: string }) => void;
  clearWorkSteps: () => void;
  setMode: (m: "auto" | "manual_review") => void;
  setEmotion: (e: Emotion) => void;
  setThinking: (v: boolean) => void;
  addMessage: (m: Omit<ChatMessage, "id" | "at"> & { id?: string }) => void;
  /** Replace chat (e.g. restore from SQLite). */
  setMessages: (messages: ChatMessage[]) => void;
  /** Blocks until Allow/Deny; clears pending when resolved. */
  startApprovalFlow: (action: WalleAction, onResolved: (approved: boolean) => void) => void;
  resolveApproval: (approved: boolean) => void;
  clearApprovalUi: () => void;
  setWorkflows: (workflows: Workflow[]) => void;
  addWorkflow: (workflow: Workflow) => void;
  setLastUsedModel: (model: string | null) => void;
  setLastUsage: (usage: LLMUsage | null) => void;
  /** Drives mascot overlay animations (emits to mascot window). */
  playAnimation: (animation: Animation) => void;
}

export const useWalleStore = create<WalleStore>((set, get) => ({
  mode: "manual_review",
  emotion: "idle",
  isThinking: false,
  messages: [],
  pendingAction: null,
  approvalCallback: null,
  workflows: [],
  lastUsedModel: null,
  lastUsage: null,
  workSteps: [],
  addWorkStep: (step) =>
    set((s) => ({
      workSteps: [
        ...s.workSteps,
        {
          id: step.id ?? crypto.randomUUID(),
          kind: step.kind,
          text: step.text,
          plugin: step.plugin,
          at: Date.now(),
        },
      ],
    })),
  clearWorkSteps: () => set({ workSteps: [] }),
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
  setMessages: (messages) => set({ messages }),
  startApprovalFlow: (action, onResolved) =>
    set({ pendingAction: action, approvalCallback: onResolved }),
  resolveApproval: (approved) => {
    const cb = get().approvalCallback;
    if (cb) {
      cb(approved);
      set({ pendingAction: null, approvalCallback: null });
    }
  },
  clearApprovalUi: () => set({ pendingAction: null, approvalCallback: null }),
  setWorkflows: (workflows) => set({ workflows }),
  addWorkflow: (workflow) =>
    set((s) => ({
      workflows: [
        ...s.workflows.filter(
          (existing) => existing.name.toLowerCase() !== workflow.name.toLowerCase(),
        ),
        workflow,
      ],
    })),
  setLastUsedModel: (lastUsedModel) => set({ lastUsedModel }),
  setLastUsage: (lastUsage) => set({ lastUsage }),
  playAnimation: (animation) => {
    void emitMascotAnimation(animation);
  },
}));
