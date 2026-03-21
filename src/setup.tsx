import { invoke } from "@tauri-apps/api/core";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";

import "./styles/globals.css";

type ProviderName = "anthropic" | "openai" | "ollama" | "openrouter";

const PROVIDER_COPY: Record<
  ProviderName,
  { label: string; link?: string; placeholder: string; requiresApiKey: boolean }
> = {
  anthropic: {
    label: "Anthropic",
    link: "https://console.anthropic.com/",
    placeholder: "sk-ant-api03-...",
    requiresApiKey: true,
  },
  openai: {
    label: "OpenAI",
    link: "https://platform.openai.com/api-keys",
    placeholder: "sk-proj-...",
    requiresApiKey: true,
  },
  openrouter: {
    label: "OpenRouter",
    link: "https://openrouter.ai/keys",
    placeholder: "sk-or-...",
    requiresApiKey: true,
  },
  ollama: {
    label: "Ollama",
    placeholder: "",
    requiresApiKey: false,
  },
};

function toProviderName(value: string | undefined): ProviderName {
  if (value === "openai" || value === "openrouter" || value === "ollama") {
    return value;
  }
  return "anthropic";
}

function SetupApp() {
  const [provider, setProvider] = useState<ProviderName>("anthropic");
  const [key, setKey] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const raw = await invoke<string>("get_walle_config");
        const parsed = JSON.parse(raw) as { llm?: { provider?: string } };
        setProvider(toProviderName(parsed.llm?.provider));
      } catch {
        setProvider("anthropic");
      }
    })().catch(() => setProvider("anthropic"));
  }, []);

  const copy = PROVIDER_COPY[provider];

  const save = async () => {
    setErr("");
    try {
      if (copy.requiresApiKey) {
        await invoke("save_provider_api_key", { provider, key: key.trim() });
      }
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
          {copy.requiresApiKey
            ? `Enter your ${copy.label} API key. It is stored in the OS keychain only and kept separate from other providers.`
            : "Ollama is configured as the active provider. No API key is required for local use."}
        </p>
        {copy.link && (
          <a
            className="text-[13px] mb-4 inline-block underline"
            style={{ color: "var(--walle-cyan)" }}
            href={copy.link}
            target="_blank"
            rel="noreferrer"
          >
            {copy.link.replace(/^https?:\/\//, "")}
          </a>
        )}
        {copy.requiresApiKey && (
          <input
            type="password"
            className="w-full mb-3 px-3 py-2 rounded-lg text-sm"
            style={{
              background: "var(--walle-bg-2)",
              border: "1px solid var(--walle-glass-border)",
              color: "var(--walle-text-primary)",
            }}
            placeholder={copy.placeholder}
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
        )}
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
