import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

import { useWalle } from "../../hooks/useWalle";
import type { LLMUsage, Workflow } from "../../store/walleStore";
import { useWalleStore } from "../../store/walleStore";
import ActionCard from "./ActionCard";
import InputBar from "./InputBar";
import MessageList from "./MessageList";
import ModeToggle from "../UI/ModeToggle";
import SettingsPanel from "./SettingsPanel";
import { WorkflowPills } from "./WorkflowPills";

interface WorkflowConfigItem {
  name: string;
  description?: string;
  steps?: unknown[];
  created_at?: string;
}

interface ChatConfigSnapshot {
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

function normalizeWorkflows(config: ChatConfigSnapshot): Workflow[] {
  return (config.workflows ?? []).map((workflow) => ({
    name: workflow.name,
    description: workflow.description,
    steps: Array.isArray(workflow.steps) ? (workflow.steps as Workflow["steps"]) : [],
    created_at: workflow.created_at ?? new Date().toISOString(),
  }));
}

function usageSummary(usage: LLMUsage | null) {
  if (!usage) return null;
  const total = usage.inputTokens + usage.outputTokens;
  return `in ${usage.inputTokens} / out ${usage.outputTokens} / total ${total}`;
}

export default function ChatPanel() {
  const messages = useWalleStore((s) => s.messages);
  const pending = useWalleStore((s) => s.pendingActions);
  const isThinking = useWalleStore((s) => s.isThinking);
  const workflows = useWalleStore((s) => s.workflows);
  const lastUsedModel = useWalleStore((s) => s.lastUsedModel);
  const lastUsage = useWalleStore((s) => s.lastUsage);
  const setMode = useWalleStore((s) => s.setMode);
  const setWorkflows = useWalleStore((s) => s.setWorkflows);
  const { sendMessage, approveAction, denyAction } = useWalle();
  const [settings, setSettings] = useState(false);
  const [voiceTick, setVoiceTick] = useState(0);
  const [configSnapshot, setConfigSnapshot] = useState<ChatConfigSnapshot | null>(null);

  const loadConfig = async () => {
    try {
      const raw = await invoke<string>("get_walle_config");
      const parsed = JSON.parse(raw) as ChatConfigSnapshot;
      const mode = parsed.agent?.mode;
      if (mode === "auto" || mode === "manual_review") {
        setMode(mode);
      }
      setWorkflows(normalizeWorkflows(parsed));
      setConfigSnapshot(parsed);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    void loadConfig();
  }, [setMode, setWorkflows]);

  useEffect(() => {
    let u: (() => void) | undefined;
    (async () => {
      u = await listen("walle/voice-hotkey", () => {
        setVoiceTick((t) => t + 1);
      });
    })().catch(console.error);
    return () => u?.();
  }, []);

  const first = pending[0];
  const debugMode = configSnapshot?.ui?.debug_mode === true;

  return (
    <div
      className="flex flex-col h-full min-h-0 glass-panel overflow-hidden"
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
            onClick={() => setSettings(true)}
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

      {first && (
        <div className="px-3 shrink-0">
          <ActionCard
            action={first.action}
            onApprove={() => void approveAction(first.id)}
            onDeny={() => void denyAction(first.id)}
          />
        </div>
      )}

      <WorkflowPills workflows={workflows} onRun={(name) => void sendMessage(`run ${name}`)} />

      <div className="shrink-0">
        <InputBar
          onSend={(t) => void sendMessage(t)}
          disabled={isThinking}
          voiceTrigger={voiceTick}
        />
      </div>

      <SettingsPanel
        open={settings}
        onClose={() => setSettings(false)}
        onSaved={() => void loadConfig()}
      />
    </div>
  );
}
