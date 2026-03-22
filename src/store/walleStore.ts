import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";

import type { Animation } from "../lib/animation";
import type { Emotion } from "../lib/emotion";
import { emitMascotAnimation } from "../lib/mascotBridge";
import { notifyConfigChanged } from "../lib/settingsCrossWindow";
import type { WalleAction } from "../lib/actionParser";
import type { Memory } from "../lib/memory";

export type ChatRole = "user" | "assistant" | "bubble_echo";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  at: number;
}

/** Last 20 unprompted bubble lines echoed into chat (chat webview only). */
export interface BubbleEcho {
  text: string;
  timestamp: string;
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
  | "work:iteration"
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

/** Cron schedules (SQLite); mirrors `ScheduleDto` from the backend. */
export interface Schedule {
  id: number;
  name: string;
  cronExpr: string;
  actions: unknown;
  enabled: boolean;
  lastRun: string | null;
  createdAt: string;
}

/** Developer-mode repo hint from window title + watch dir (see `fetchContext`). */
export interface GitContext {
  repoPath: string | null;
}

export type ActiveMascot = "walle" | "dudu";

export function parseActiveMascotFromConfigJson(raw: string): ActiveMascot {
  try {
    const j = JSON.parse(raw) as { mascot?: { active?: string } };
    return j.mascot?.active === "dudu" ? "dudu" : "walle";
  } catch {
    return "walle";
  }
}

/** Default on when key missing or invalid. */
export function parseMascotSoundsFromConfigJson(raw: string): boolean {
  try {
    const j = JSON.parse(raw) as { mascot?: { sounds?: boolean } };
    return j.mascot?.sounds !== false;
  } catch {
    return true;
  }
}

interface WalleStore {
  mode: "auto" | "manual_review";
  emotion: Emotion;
  isThinking: boolean;
  messages: ChatMessage[];
  bubbleEchos: BubbleEcho[];
  /** At most one action awaiting Allow/Deny — sequential multi-action plans use this. */
  pendingAction: WalleAction | null;
  approvalCallback: ((approved: boolean) => void) | null;
  workflows: Workflow[];
  lastUsedModel: string | null;
  lastUsage: LLMUsage | null;
  workSteps: WorkStep[];
  /** Phase 2 — durable memories (optional UI cache; SQLite is source of truth). */
  memories: Memory[];
  /** Phase 2 — schedule rows (optional UI cache; SQLite is source of truth). */
  schedules: Schedule[];
  activeWindow: string | null;
  clipboardPreview: string | null;
  showWorkEnabled: boolean;
  gitContext: GitContext | null;
  activeMascot: ActiveMascot;
  setActiveMascot: (mascot: ActiveMascot) => void;
  addWorkStep: (step: Omit<WorkStep, "id" | "at"> & { id?: string }) => void;
  clearWorkSteps: () => void;
  addMemory: (m: Memory) => void;
  updateMemory: (key: string, value: string) => void;
  setMemories: (memories: Memory[]) => void;
  addSchedule: (s: Schedule) => void;
  removeSchedule: (id: number) => void;
  setSchedules: (schedules: Schedule[]) => void;
  setActiveWindow: (title: string | null) => void;
  setClipboardPreview: (preview: string | null) => void;
  setShowWorkEnabled: (v: boolean) => void;
  setGitContext: (ctx: GitContext | null) => void;
  toggleShowWork: () => void;
  setMode: (m: "auto" | "manual_review") => void;
  setEmotion: (e: Emotion) => void;
  setThinking: (v: boolean) => void;
  addMessage: (m: Omit<ChatMessage, "id" | "at"> & { id?: string }) => void;
  addBubbleEcho: (text: string) => void;
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
  bubbleEchos: [],
  pendingAction: null,
  approvalCallback: null,
  workflows: [],
  lastUsedModel: null,
  lastUsage: null,
  workSteps: [],
  memories: [],
  schedules: [],
  activeWindow: null,
  clipboardPreview: null,
  showWorkEnabled: false,
  gitContext: null,
  activeMascot: "walle",
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
  addMemory: (m) =>
    set((s) => ({
      memories: [...s.memories.filter((x) => x.key !== m.key), m],
    })),
  updateMemory: (key, value) =>
    set((s) => ({
      memories: s.memories.map((x) =>
        x.key === key ? { ...x, value, updated_at: new Date().toISOString() } : x,
      ),
    })),
  setMemories: (memories) => set({ memories }),
  addSchedule: (row) =>
    set((s) => ({
      schedules: [...s.schedules.filter((x) => x.id !== row.id), row],
    })),
  removeSchedule: (id) =>
    set((s) => ({
      schedules: s.schedules.filter((x) => x.id !== id),
    })),
  setSchedules: (schedules) => set({ schedules }),
  setActiveWindow: (activeWindow) => set({ activeWindow }),
  setClipboardPreview: (clipboardPreview) => set({ clipboardPreview }),
  setShowWorkEnabled: (showWorkEnabled) => set({ showWorkEnabled }),
  setGitContext: (gitContext) => set({ gitContext }),
  toggleShowWork: () => set((s) => ({ showWorkEnabled: !s.showWorkEnabled })),
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
  addBubbleEcho: (text) =>
    set((s) => ({
      bubbleEchos: [
        ...s.bubbleEchos.slice(-19),
        { text, timestamp: new Date().toISOString() },
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
  setActiveMascot: (mascot) => {
    set({ activeMascot: mascot });
    void (async () => {
      try {
        await invoke("save_mascot_choice", { mascot });
        await notifyConfigChanged();
      } catch (e) {
        console.error(e);
      }
    })();
  },
}));
