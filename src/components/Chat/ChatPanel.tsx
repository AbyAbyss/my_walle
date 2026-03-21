import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

import { useWalle } from "../../hooks/useWalle";
import { useWalleStore } from "../../store/walleStore";
import ActionCard from "./ActionCard";
import InputBar from "./InputBar";
import MessageList from "./MessageList";
import ModeToggle from "../UI/ModeToggle";
import SettingsPanel from "./SettingsPanel";

export default function ChatPanel() {
  const messages = useWalleStore((s) => s.messages);
  const pending = useWalleStore((s) => s.pendingActions);
  const isThinking = useWalleStore((s) => s.isThinking);
  const setMode = useWalleStore((s) => s.setMode);
  const { sendMessage, approveAction, denyAction } = useWalle();
  const [settings, setSettings] = useState(false);
  const [voiceTick, setVoiceTick] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const raw = await invoke<string>("get_walle_config");
        const j = JSON.parse(raw) as { agent?: { mode?: string } };
        const m = j.agent?.mode;
        if (m === "auto" || m === "manual_review") setMode(m);
      } catch {
        /* ignore */
      }
    })();
  }, [setMode]);

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

      <div className="shrink-0">
        <InputBar
          onSend={(t) => void sendMessage(t)}
          disabled={isThinking}
          voiceTrigger={voiceTick}
        />
      </div>

      <SettingsPanel open={settings} onClose={() => setSettings(false)} />
    </div>
  );
}
