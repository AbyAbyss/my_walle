import { invoke } from "@tauri-apps/api/core";
import React, { useState } from "react";
import ReactDOM from "react-dom/client";

import "./styles/globals.css";

function SetupApp() {
  const [key, setKey] = useState("");
  const [err, setErr] = useState("");

  const save = async () => {
    setErr("");
    try {
      await invoke("save_api_key", { key: key.trim() });
      await invoke("complete_setup_flow");
    } catch (e) {
      setErr(String(e));
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        background: "var(--walle-bg-0)",
        color: "var(--walle-text-primary)",
      }}
    >
      <div className="glass-panel max-w-md w-full p-6">
        <h1 className="text-lg mb-2 tracking-wide">Welcome to WALLE</h1>
        <p className="text-[13px] mb-4" style={{ color: "var(--walle-text-secondary)" }}>
          Enter your Anthropic API key. It is stored in the OS keychain only — never in a file.
        </p>
        <a
          className="text-[13px] mb-4 inline-block underline"
          style={{ color: "var(--walle-cyan)" }}
          href="https://console.anthropic.com/"
          target="_blank"
          rel="noreferrer"
        >
          console.anthropic.com
        </a>
        <input
          type="password"
          className="w-full mb-3 px-3 py-2 rounded-lg text-sm"
          style={{
            background: "var(--walle-bg-2)",
            border: "1px solid var(--walle-glass-border)",
            color: "var(--walle-text-primary)",
          }}
          placeholder="sk-ant-api03-..."
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        {err && (
          <p className="text-[12px] mb-2" style={{ color: "var(--walle-red)" }}>
            {err}
          </p>
        )}
        <button
          type="button"
          className="w-full py-2 rounded-lg text-sm font-medium"
          style={{
            background: "var(--walle-cyan-dim)",
            color: "var(--walle-cyan)",
            border: "1px solid var(--walle-cyan)",
          }}
          onClick={() => void save()}
        >
          Save and continue
        </button>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <SetupApp />
  </React.StrictMode>,
);
