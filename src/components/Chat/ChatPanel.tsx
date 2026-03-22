import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";

import { useWalle } from "../../hooks/useWalle";
import { useWalleContext } from "../../hooks/useWalleContext";
import { getChatSessionId } from "../../lib/chatSession";
import { runScheduleFire, type ScheduleFirePayload } from "../../lib/runScheduleFire";
import {
  conversationRowsToMessages,
  type ConversationRowPayload,
} from "../../lib/persistConversation";
import { normalizeWorkflowsFromConfig } from "../../lib/workflowsFromConfig";
import { normalizeUserLevel, saveUiPreferences } from "../../lib/uiPreferences";
import type { LLMUsage } from "../../store/walleStore";
import { useWalleStore } from "../../store/walleStore";
import OnboardingFlow from "../Onboarding/OnboardingFlow";
import ActionCard from "./ActionCard";
import InputBar from "./InputBar";
import MessageList from "./MessageList";
import SuggestionChips from "./SuggestionChips";
import ShowWorkPanel from "./ShowWorkPanel";
import ModeToggle from "../UI/ModeToggle";
import { WorkflowPills } from "./WorkflowPills";

interface WorkflowConfigItem {
  name: string;
  description?: string;
  steps?: unknown[];
  created_at?: string;
}

interface ChatConfigSnapshot {
  onboarding_complete?: boolean;
  last_open_date?: string;
  user_level?: string;
  show_work?: boolean;
  agent?: { mode?: string };
  llm?: {
    provider?: string;
    default_model?: string;
    complex_model?: string;
    model?: string;
  };
  ui?: {
    debug_mode?: boolean;
  };
  workflows?: WorkflowConfigItem[];
}

function shortenModelName(model: string) {
  const trimmed = model.trim();
  if (trimmed.length <= 26) return trimmed;
  const parts = trimmed.split("/");
  return parts[parts.length - 1] ?? trimmed;
}

function modelIndicatorLabel(lastUsedModel: string | null, config: ChatConfigSnapshot | null) {
  if (!lastUsedModel) return null;
  const provider = config?.llm?.provider ?? "llm";
  return `${provider} / ${shortenModelName(lastUsedModel)}`;
}

function usageSummary(usage: LLMUsage | null) {
  if (!usage) return null;
  const total = usage.inputTokens + usage.outputTokens;
  return `in ${usage.inputTokens} / out ${usage.outputTokens} / total ${total}`;
}

export default function ChatPanel() {
  const messages = useWalleStore((s) => s.messages);
  const pendingAction = useWalleStore((s) => s.pendingAction);
  const resolveApproval = useWalleStore((s) => s.resolveApproval);
  const isThinking = useWalleStore((s) => s.isThinking);
  const workflows = useWalleStore((s) => s.workflows);
  const lastUsedModel = useWalleStore((s) => s.lastUsedModel);
  const lastUsage = useWalleStore((s) => s.lastUsage);
  const setMode = useWalleStore((s) => s.setMode);
  const setWorkflows = useWalleStore((s) => s.setWorkflows);
  const setMessages = useWalleStore((s) => s.setMessages);
  const setShowWorkEnabled = useWalleStore((s) => s.setShowWorkEnabled);
  const { sendMessage } = useWalle();
  const { refresh: refreshContext } = useWalleContext();
  const [voiceTick, setVoiceTick] = useState(0);
  const [configSnapshot, setConfigSnapshot] = useState<ChatConfigSnapshot | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const firstOpenWaveRef = useRef(false);
  const restoredChatRef = useRef(false);

  const loadConfig = useCallback(async () => {
    try {
      const raw = await invoke<string>("get_walle_config");
      const parsed = JSON.parse(raw) as ChatConfigSnapshot;
      const mode = parsed.agent?.mode;
      if (mode === "auto" || mode === "manual_review") {
        setMode(mode);
      }
      setWorkflows(normalizeWorkflowsFromConfig(parsed));
      setConfigSnapshot(parsed);
      setShowWorkEnabled(parsed.show_work === true);
      setShowOnboarding(parsed.onboarding_complete === false);

      const today = new Date().toDateString();
      if (!firstOpenWaveRef.current && parsed.last_open_date !== today) {
        firstOpenWaveRef.current = true;
        await saveUiPreferences({ last_open_date: today });
        if (parsed.onboarding_complete !== false) {
          window.setTimeout(() => {
            useWalleStore.getState().playAnimation("wave");
          }, 500);
        }
      }
    } catch {
      /* ignore */
    }
  }, [setMode, setWorkflows, setShowWorkEnabled]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    void refreshContext();
  }, [refreshContext]);

  useEffect(() => {
    if (restoredChatRef.current) return;
    restoredChatRef.current = true;
    void (async () => {
      try {
        const rows = await invoke<ConversationRowPayload[]>("conversation_load_recent", {
          sessionId: getChatSessionId(),
          limit: 20,
        });
        if (rows.length) {
          setMessages(conversationRowsToMessages(rows));
        }
      } catch {
        /* ignore */
      }
    })();
  }, [setMessages]);

  useEffect(() => {
    let u: (() => void) | undefined;
    (async () => {
      u = await listen("walle/voice-hotkey", () => {
        setVoiceTick((t) => t + 1);
      });
    })().catch(console.error);
    return () => u?.();
  }, []);

  useEffect(() => {
    let u: (() => void) | undefined;
    (async () => {
      u = await listen<ScheduleFirePayload>("schedule:fire", (ev) => {
        void runScheduleFire(ev.payload);
      });
    })().catch(console.error);
    return () => u?.();
  }, []);

  useEffect(() => {
    let u: (() => void) | undefined;
    (async () => {
      u = await listen("walle/config-changed", () => {
        void loadConfig();
      });
    })().catch(console.error);
    return () => u?.();
  }, [loadConfig]);

  useEffect(() => {
    let u: (() => void) | undefined;
    (async () => {
      u = await listen<{ name: string }>("walle/run-workflow", (ev) => {
        const name = ev.payload?.name;
        if (name) void sendMessage(`run ${name}`);
      });
    })().catch(console.error);
    return () => u?.();
  }, [sendMessage]);

  useEffect(() => {
    let u: (() => void) | undefined;
    (async () => {
      u = await listen("walle/toggle-show-work", async () => {
        try {
          const raw = await invoke<string>("get_walle_config");
          const before = JSON.parse(raw) as { show_work?: boolean };
          await saveUiPreferences({ show_work: !(before.show_work === true) });
          const next = await invoke<string>("get_walle_config");
          const updated = JSON.parse(next) as ChatConfigSnapshot;
          setConfigSnapshot(updated);
          setShowWorkEnabled(updated.show_work === true);
        } catch {
          /* ignore */
        }
      });
    })().catch(console.error);
    return () => u?.();
  }, []);

  const debugMode = configSnapshot?.ui?.debug_mode === true;
  const userLevel = normalizeUserLevel(configSnapshot?.user_level);

  return (
    <div
      className="flex flex-col h-full min-h-0 glass-panel overflow-hidden relative"
      style={{
        width: 380,
        height: 620,
        color: "var(--walle-text-primary)",
      }}
    >
      <header
        className="flex items-center justify-between px-3 py-2 border-b shrink-0"
        style={{ borderColor: "var(--walle-glass-border)" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium tracking-wide">WALLE</span>
          <span
            className="w-2 h-2 rounded-full"
            style={{
              background: isThinking ? "var(--walle-cyan)" : "var(--walle-green)",
            }}
          />
          <ModeToggle />
          {debugMode && modelIndicatorLabel(lastUsedModel, configSnapshot) && (
            <span
              style={{
                fontSize: "11px",
                color: "var(--walle-text-muted)",
                fontFamily: "var(--walle-font-mono)",
              }}
            >
              {modelIndicatorLabel(lastUsedModel, configSnapshot)}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            className="text-[13px] px-2 py-1 rounded"
            style={{ color: "var(--walle-text-secondary)" }}
            onClick={() => void invoke("open_settings_window")}
          >
            ⚙
          </button>
          <button
            type="button"
            className="text-[13px] px-2 py-1 rounded"
            style={{ color: "var(--walle-text-secondary)" }}
            onClick={() => void invoke("toggle_chat_window")}
          >
            ×
          </button>
        </div>
      </header>

      {debugMode && usageSummary(lastUsage) && (
        <div
          className="px-3 py-1.5 text-[11px] shrink-0 border-b"
          style={{
            borderColor: "var(--walle-glass-border)",
            color: "var(--walle-text-muted)",
            fontFamily: "var(--walle-font-mono)",
          }}
        >
          {usageSummary(lastUsage)}
        </div>
      )}

      <MessageList messages={messages} />

      <ShowWorkPanel enabled={configSnapshot?.show_work === true} />

      {pendingAction && (
        <div className="px-3 shrink-0">
          <ActionCard
            action={pendingAction}
            userLevel={userLevel}
            onApprove={() => resolveApproval(true)}
            onDeny={() => resolveApproval(false)}
          />
        </div>
      )}

      <WorkflowPills workflows={workflows} onRun={(name) => void sendMessage(`run ${name}`)} />

      <SuggestionChips userLevel={userLevel} onSelect={(text) => void sendMessage(text)} />

      <div className="shrink-0">
        <InputBar
          onSend={(t) => void sendMessage(t)}
          disabled={isThinking}
          voiceTrigger={voiceTick}
        />
      </div>

      {showOnboarding && (
        <OnboardingFlow
          onDismiss={() => {
            setShowOnboarding(false);
            void loadConfig();
          }}
          onTrySend={(text) => void sendMessage(text)}
        />
      )}
    </div>
  );
}
