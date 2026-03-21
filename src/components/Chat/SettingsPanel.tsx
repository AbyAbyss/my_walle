import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const [key, setKey] = useState("");
  const [status, setStatus] = useState("");

  if (!open) return null;

  const changeKey = async () => {
    try {
      await invoke("clear_api_key");
      if (key.trim()) {
        await invoke("save_api_key", { key: key.trim() });
      }
      setStatus("API key updated.");
      setKey("");
    } catch (e) {
      setStatus(String(e));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        className="glass-panel p-4 w-[min(420px,92vw)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base mb-3" style={{ color: "var(--walle-text-primary)" }}>
          Settings
        </h2>
        <p className="text-[13px] mb-2" style={{ color: "var(--walle-text-secondary)" }}>
          Hotkeys: Ctrl+Shift+Space (chat), Ctrl+Shift+V (voice push-to-talk)
        </p>
        <label
          className="block text-[13px] mb-1"
          style={{ color: "var(--walle-text-secondary)" }}
        >
          Change Anthropic API key
        </label>
        <input
          type="password"
          className="w-full mb-2 px-2 py-2 rounded text-sm"
          style={{
            background: "var(--walle-bg-2)",
            border: "1px solid var(--walle-glass-border)",
            color: "var(--walle-text-primary)",
          }}
          placeholder="sk-ant-..."
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        {status && (
          <p className="text-[12px] mb-2" style={{ color: "var(--walle-text-muted)" }}>
            {status}
          </p>
        )}
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            className="px-3 py-1.5 rounded text-sm"
            style={{ border: "1px solid var(--walle-glass-border)" }}
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded text-sm"
            style={{
              border: "1px solid var(--walle-cyan)",
              color: "var(--walle-cyan)",
            }}
            onClick={() => void changeKey()}
          >
            Save key
          </button>
        </div>
      </div>
    </div>
  );
}
