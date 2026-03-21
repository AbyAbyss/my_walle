import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

interface SettingsConfig {
  llm?: {
    provider?: string;
    model?: string;
    default_model?: string;
    complex_model?: string;
    base_url?: string;
    smart_routing?: boolean;
  };
  ui?: {
    debug_mode?: boolean;
  };
}

type ProviderName = "anthropic" | "openai" | "ollama" | "openrouter";

interface ProviderPreset {
  label: string;
  defaultModel: string;
  complexModel: string;
  baseUrl: string;
  requiresApiKey: boolean;
  helpText: string;
}

const PROVIDER_OPTIONS: ProviderName[] = ["anthropic", "openai", "ollama", "openrouter"];

const PROVIDER_PRESETS: Record<ProviderName, ProviderPreset> = {
  anthropic: {
    label: "Anthropic",
    defaultModel: "claude-haiku-4-5-20251001",
    complexModel: "claude-sonnet-4-6",
    baseUrl: "",
    requiresApiKey: true,
    helpText: "Claude models. Uses the Anthropic API key stored for Anthropic only.",
  },
  openai: {
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    complexModel: "gpt-4o",
    baseUrl: "",
    requiresApiKey: true,
    helpText: "OpenAI models. Uses the OpenAI API key stored for OpenAI only.",
  },
  ollama: {
    label: "Ollama",
    defaultModel: "llama3.2",
    complexModel: "llama3.2",
    baseUrl: "http://localhost:11434/v1",
    requiresApiKey: false,
    helpText: "Local OpenAI-compatible endpoint. No API key required.",
  },
  openrouter: {
    label: "OpenRouter",
    defaultModel: "meta-llama/llama-3.2-3b-instruct:free",
    complexModel: "anthropic/claude-sonnet-4-6",
    baseUrl: "https://openrouter.ai/api/v1",
    requiresApiKey: true,
    helpText: "OpenAI-compatible gateway. Uses the OpenRouter key stored for OpenRouter only.",
  },
};

function toProviderName(value: string | undefined): ProviderName {
  return PROVIDER_OPTIONS.includes(value as ProviderName)
    ? (value as ProviderName)
    : "anthropic";
}

export default function SettingsPanel({ open, onClose, onSaved }: SettingsPanelProps) {
  const [provider, setProvider] = useState<ProviderName>("anthropic");
  const [defaultModel, setDefaultModel] = useState("");
  const [complexModel, setComplexModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [smartRouting, setSmartRouting] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState("");
  const [keySaved, setKeySaved] = useState<boolean | null>(null);

  const refreshKeyStatus = async (nextProvider: ProviderName) => {
    if (!PROVIDER_PRESETS[nextProvider].requiresApiKey) {
      setKeySaved(null);
      return;
    }

    try {
      const saved = await invoke<boolean>("has_provider_api_key", { provider: nextProvider });
      setKeySaved(saved);
    } catch {
      setKeySaved(null);
    }
  };

  useEffect(() => {
    if (!open) return;

    (async () => {
      try {
        const raw = await invoke<string>("get_walle_config");
        const parsed = JSON.parse(raw) as SettingsConfig;
        const llm = parsed.llm ?? {};
        const nextProvider = toProviderName(llm.provider);
        setProvider(nextProvider);
        setDefaultModel(
          llm.default_model ?? llm.model ?? PROVIDER_PRESETS[nextProvider].defaultModel,
        );
        setComplexModel(
          llm.complex_model ??
            llm.default_model ??
            llm.model ??
            PROVIDER_PRESETS[nextProvider].complexModel,
        );
        setBaseUrl(
          llm.base_url ??
            PROVIDER_PRESETS[nextProvider].baseUrl,
        );
        setSmartRouting(llm.smart_routing !== false);
        setDebugMode(parsed.ui?.debug_mode === true);
        setStatus("");
        setApiKey("");
        await refreshKeyStatus(nextProvider);
      } catch (e) {
        setStatus(String(e));
      }
    })().catch((e) => setStatus(String(e)));
  }, [open]);

  if (!open) return null;

  const preset = PROVIDER_PRESETS[provider];

  const applyProviderPreset = async (nextProvider: ProviderName) => {
    const nextPreset = PROVIDER_PRESETS[nextProvider];
    setProvider(nextProvider);
    setDefaultModel(nextPreset.defaultModel);
    setComplexModel(nextPreset.complexModel);
    setBaseUrl(nextPreset.baseUrl);
    setSmartRouting(nextProvider !== "ollama");
    setApiKey("");
    setStatus(`Loaded recommended defaults for ${nextPreset.label}.`);
    await refreshKeyStatus(nextProvider);
  };

  const save = async () => {
    setStatus("");
    try {
      await invoke("save_llm_settings", {
        settings: {
          provider,
          defaultModel: defaultModel.trim(),
          complexModel: complexModel.trim(),
          baseUrl: baseUrl.trim(),
          smartRouting,
          debugMode,
        },
      });
      if (apiKey.trim()) {
        await invoke("save_provider_api_key", { provider, key: apiKey.trim() });
        setApiKey("");
      }
      await refreshKeyStatus(provider);
      setStatus("Settings saved. Keys are stored separately per provider.");
      onSaved();
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
        className="glass-panel p-4 w-[min(460px,92vw)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base mb-3" style={{ color: "var(--walle-text-primary)" }}>
          Settings
        </h2>
        <p className="text-[13px] mb-3" style={{ color: "var(--walle-text-secondary)" }}>
          Hotkeys: Ctrl+Shift+Space (chat), Ctrl+Shift+V (voice push-to-talk)
        </p>

        <div className="grid gap-3">
          <div>
            <label
              className="block text-[13px] mb-1"
              style={{ color: "var(--walle-text-secondary)" }}
            >
              Provider
            </label>
            <select
              className="w-full px-2 py-2 rounded text-sm"
              style={{
                background: "var(--walle-bg-2)",
                border: "1px solid var(--walle-glass-border)",
                color: "var(--walle-text-primary)",
              }}
              value={provider}
              onChange={(e) => void applyProviderPreset(toProviderName(e.target.value))}
            >
              {PROVIDER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {PROVIDER_PRESETS[option].label}
                </option>
              ))}
            </select>
            <p className="text-[12px] mt-1" style={{ color: "var(--walle-text-muted)" }}>
              {preset.helpText}
            </p>
          </div>

          <div>
            <label
              className="block text-[13px] mb-1"
              style={{ color: "var(--walle-text-secondary)" }}
            >
              Fast model
            </label>
            <input
              type="text"
              className="w-full px-2 py-2 rounded text-sm"
              style={{
                background: "var(--walle-bg-2)",
                border: "1px solid var(--walle-glass-border)",
                color: "var(--walle-text-primary)",
              }}
              value={defaultModel}
              onChange={(e) => setDefaultModel(e.target.value)}
            />
          </div>

          <div>
            <label
              className="block text-[13px] mb-1"
              style={{ color: "var(--walle-text-secondary)" }}
            >
              Complex model
            </label>
            <input
              type="text"
              className="w-full px-2 py-2 rounded text-sm"
              style={{
                background: "var(--walle-bg-2)",
                border: "1px solid var(--walle-glass-border)",
                color: "var(--walle-text-primary)",
              }}
              value={complexModel}
              onChange={(e) => setComplexModel(e.target.value)}
            />
          </div>

          <div>
            <label
              className="block text-[13px] mb-1"
              style={{ color: "var(--walle-text-secondary)" }}
            >
              Base URL
            </label>
            <input
              type="text"
              className="w-full px-2 py-2 rounded text-sm"
              style={{
                background: "var(--walle-bg-2)",
                border: "1px solid var(--walle-glass-border)",
                color: "var(--walle-text-primary)",
              }}
              placeholder="Leave blank for built-in defaults"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={smartRouting}
              onChange={(e) => setSmartRouting(e.target.checked)}
            />
            <span style={{ color: "var(--walle-text-secondary)" }}>
              Smart routing: use the fast model when possible
            </span>
          </label>

          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={debugMode}
              onChange={(e) => setDebugMode(e.target.checked)}
            />
            <span style={{ color: "var(--walle-text-secondary)" }}>
              Debug mode: show model and token usage in chat
            </span>
          </label>

          {preset.requiresApiKey ? (
            <div>
              <label
                className="block text-[13px] mb-1"
                style={{ color: "var(--walle-text-secondary)" }}
              >
                {preset.label} API key
              </label>
              <input
                type="password"
                className="w-full px-2 py-2 rounded text-sm"
                style={{
                  background: "var(--walle-bg-2)",
                  border: "1px solid var(--walle-glass-border)",
                  color: "var(--walle-text-primary)",
                }}
                placeholder="Leave blank to keep the stored key for this provider"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-[12px] mt-1" style={{ color: "var(--walle-text-muted)" }}>
                Stored key for {preset.label}:{" "}
                {keySaved === null ? "unknown" : keySaved ? "yes" : "no"}
              </p>
            </div>
          ) : (
            <p className="text-[12px]" style={{ color: "var(--walle-text-muted)" }}>
              Ollama uses your local endpoint and does not need an API key.
            </p>
          )}
        </div>

        {status && (
          <p className="text-[12px] mt-3" style={{ color: "var(--walle-text-muted)" }}>
            {status}
          </p>
        )}

        <div className="flex gap-2 justify-end mt-4">
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
            onClick={() => void save()}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
