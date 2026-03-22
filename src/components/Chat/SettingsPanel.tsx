import { invoke } from "@tauri-apps/api/core";
import cronstrue from "cronstrue";
import { useCallback, useEffect, useState } from "react";

import {
  normalizeUserLevel,
  saveUiPreferences,
  type UserLevel,
} from "../../lib/uiPreferences";
import type { Workflow } from "../../store/walleStore";
import PluginManager from "../Settings/PluginManager";
import WorkflowEditor from "../Settings/WorkflowEditor";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  workflows: Workflow[];
  onWorkflowsChange: (next: Workflow[]) => void;
  onRunWorkflow: (name: string) => void;
}

type SettingsTab = "general" | "plugins" | "workflows";

const CLIPBOARD_PROMPT_KEY = "walle_clipboard_prompt_seen";

interface SettingsConfig {
  user_level?: string;
  show_work?: boolean;
  context?: {
    inject_active_window?: boolean;
    inject_clipboard?: boolean;
  };
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
  plugins?: { enabled?: string[] };
  developer_mode?: { enabled?: boolean };
}

type ProviderName = "anthropic" | "openai" | "ollama" | "openrouter";

interface ScheduleRow {
  id: number;
  name: string;
  cronExpr: string;
  actions: unknown;
  enabled: boolean;
  lastRun: string | null;
  createdAt: string;
}

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
    helpText: "Claude models with separate Anthropic key storage.",
  },
  openai: {
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    complexModel: "gpt-4o",
    baseUrl: "",
    requiresApiKey: true,
    helpText: "OpenAI models with separate OpenAI key storage.",
  },
  ollama: {
    label: "Ollama",
    defaultModel: "llama3.2",
    complexModel: "llama3.2",
    baseUrl: "http://localhost:11434/v1",
    requiresApiKey: false,
    helpText: "Local OpenAI-compatible endpoint. No key required.",
  },
  openrouter: {
    label: "OpenRouter",
    defaultModel: "meta-llama/llama-3.2-3b-instruct:free",
    complexModel: "anthropic/claude-sonnet-4-6",
    baseUrl: "https://openrouter.ai/api/v1",
    requiresApiKey: true,
    helpText: "OpenAI-compatible gateway with separate OpenRouter key storage.",
  },
};

const sectionStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(22,24,33,0.92), rgba(14,16,24,0.9))",
  border: "1px solid var(--walle-glass-border)",
  borderRadius: "14px",
  padding: "16px",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
};

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: "10px",
  fontSize: "13px",
  background: "rgba(10,10,15,0.9)",
  border: "1px solid var(--walle-glass-border)",
  color: "var(--walle-text-primary)",
  outline: "none",
};

function toProviderName(value: string | undefined): ProviderName {
  return PROVIDER_OPTIONS.includes(value as ProviderName)
    ? (value as ProviderName)
    : "anthropic";
}

function formatCronHuman(expr: string): string | null {
  try {
    return cronstrue.toString(expr, { use24HourTimeFormat: true });
  } catch {
    return null;
  }
}

function SectionHeader({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="mb-3">
      <div
        className="text-[10px] uppercase tracking-[0.22em] mb-1"
        style={{ color: "var(--walle-cyan)" }}
      >
        {eyebrow}
      </div>
      <div className="text-[15px] font-medium mb-1" style={{ color: "var(--walle-text-primary)" }}>
        {title}
      </div>
      <div className="text-[12px]" style={{ color: "var(--walle-text-secondary)" }}>
        {body}
      </div>
    </div>
  );
}

function ToggleTile({
  title,
  body,
  checked,
  onChange,
}: {
  title: string;
  body: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className="block cursor-pointer rounded-xl p-3"
      style={{
        background: checked ? "var(--walle-cyan-dim)" : "rgba(10,10,15,0.72)",
        border: checked
          ? "1px solid rgba(0, 212, 255, 0.35)"
          : "1px solid var(--walle-glass-border)",
      }}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          style={{ marginTop: 3 }}
        />
        <div>
          <div className="text-[13px] font-medium" style={{ color: "var(--walle-text-primary)" }}>
            {title}
          </div>
          <div className="text-[12px] mt-1" style={{ color: "var(--walle-text-secondary)" }}>
            {body}
          </div>
        </div>
      </div>
    </label>
  );
}

export default function SettingsPanel({
  open,
  onClose,
  onSaved,
  workflows,
  onWorkflowsChange,
  onRunWorkflow,
}: SettingsPanelProps) {
  const [tab, setTab] = useState<SettingsTab>("general");
  const [enabledPlugins, setEnabledPlugins] = useState<string[]>([
    "shell",
    "app_launch",
    "notify",
    "git",
  ]);
  const [developerMode, setDeveloperMode] = useState(false);
  const [provider, setProvider] = useState<ProviderName>("anthropic");
  const [defaultModel, setDefaultModel] = useState("");
  const [complexModel, setComplexModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [smartRouting, setSmartRouting] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState("");
  const [keySaved, setKeySaved] = useState<boolean | null>(null);
  const [userLevel, setUserLevel] = useState<UserLevel>("standard");
  const [injectWindow, setInjectWindow] = useState(true);
  const [injectClipboard, setInjectClipboard] = useState(false);
  const [showWork, setShowWork] = useState(false);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);

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
        setBaseUrl(llm.base_url ?? PROVIDER_PRESETS[nextProvider].baseUrl);
        setSmartRouting(llm.smart_routing !== false);
        setDebugMode(parsed.ui?.debug_mode === true);
        setUserLevel(normalizeUserLevel(parsed.user_level));
        setInjectWindow(parsed.context?.inject_active_window !== false);
        setInjectClipboard(parsed.context?.inject_clipboard === true);
        setShowWork(parsed.show_work === true);
        setStatus("");
        setApiKey("");
        await refreshKeyStatus(nextProvider);
        setDeveloperMode(parsed.developer_mode?.enabled === true);
        if (Array.isArray(parsed.plugins?.enabled) && parsed.plugins!.enabled!.length > 0) {
          setEnabledPlugins(parsed.plugins!.enabled as string[]);
        } else {
          setEnabledPlugins(["shell", "app_launch", "notify", "git"]);
        }
        try {
          const rows = await invoke<ScheduleRow[]>("schedules_list_cmd");
          setSchedules(rows);
        } catch {
          setSchedules([]);
        }
      } catch (e) {
        setStatus(String(e));
      }
    })().catch((e) => setStatus(String(e)));
  }, [open]);

  const refreshPluginsFromConfig = useCallback(async () => {
    try {
      const raw = await invoke<string>("get_walle_config");
      const parsed = JSON.parse(raw) as SettingsConfig;
      setDeveloperMode(parsed.developer_mode?.enabled === true);
      if (Array.isArray(parsed.plugins?.enabled) && parsed.plugins!.enabled!.length > 0) {
        setEnabledPlugins(parsed.plugins!.enabled as string[]);
      }
    } catch {
      /* ignore */
    }
  }, []);

  if (!open) return null;

  const preset = PROVIDER_PRESETS[provider];

  const handleInjectClipboard = (next: boolean) => {
    if (next) {
      if (typeof localStorage !== "undefined" && !localStorage.getItem(CLIPBOARD_PROMPT_KEY)) {
        const ok = window.confirm(
          "Clipboard injection sends the first ~200 characters of your clipboard to the language model with each message. Only enable this if you accept that privacy tradeoff.",
        );
        if (!ok) return;
        localStorage.setItem(CLIPBOARD_PROMPT_KEY, "1");
      }
    }
    setInjectClipboard(next);
  };

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
      await saveUiPreferences({ user_level: userLevel, show_work: showWork });
      await invoke("save_context_settings", {
        settings: {
          injectActiveWindow: injectWindow,
          injectClipboard,
        },
      });
      await refreshKeyStatus(provider);
      setStatus("Settings saved. Keys stay separated by provider.");
      onSaved();
    } catch (e) {
      setStatus(String(e));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background:
          "radial-gradient(circle at top, rgba(0,212,255,0.1), transparent 38%), rgba(0,0,0,0.7)",
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel overflow-hidden"
        style={{
          width: "min(860px, 96vw)",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: 22,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "20px 22px 18px",
            borderBottom: "1px solid var(--walle-glass-border)",
            background:
              "linear-gradient(135deg, rgba(0,212,255,0.12), rgba(0,0,0,0) 45%), linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0))",
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div
                className="text-[10px] uppercase tracking-[0.24em] mb-2"
                style={{ color: "var(--walle-cyan)" }}
              >
                Control Deck
              </div>
              <h2
                className="text-[22px] leading-none m-0"
                style={{ color: "var(--walle-text-primary)" }}
              >
                WALLE Settings
              </h2>
              <p
                className="text-[13px] mt-3 mb-0 max-w-[560px]"
                style={{ color: "var(--walle-text-secondary)" }}
              >
                Tune provider behavior, routing, debug visibility, and key storage without
                reopening the app.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl text-sm"
              style={{
                color: "var(--walle-text-secondary)",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid var(--walle-glass-border)",
              }}
            >
              Close
            </button>
          </div>
        </div>

        <div
          className="walle-chat-scroll"
          style={{ overflowY: "auto", padding: 20, display: "grid", gap: 16 }}
        >
          <div className="flex flex-wrap gap-2 shrink-0">
            {(
              [
                { id: "general" as const, label: "General" },
                { id: "plugins" as const, label: "Plugins" },
                { id: "workflows" as const, label: "Workflows" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className="text-[12px] px-3 py-1.5 rounded-xl transition"
                style={{
                  border:
                    tab === t.id
                      ? "1px solid rgba(0, 212, 255, 0.45)"
                      : "1px solid var(--walle-glass-border)",
                  background: tab === t.id ? "var(--walle-cyan-dim)" : "rgba(10,10,15,0.72)",
                  color: "var(--walle-text-primary)",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "plugins" && (
            <PluginManager
              developerMode={developerMode}
              enabledIds={enabledPlugins}
              onStatus={setStatus}
              onAfterToggle={() => void refreshPluginsFromConfig()}
            />
          )}

          {tab === "workflows" && (
            <WorkflowEditor
              workflows={workflows}
              onWorkflowsChange={onWorkflowsChange}
              onRun={onRunWorkflow}
              onStatus={setStatus}
            />
          )}

          {tab === "general" && (
            <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.25fr) minmax(300px, 0.95fr)",
              gap: 16,
            }}
          >
            <section style={sectionStyle}>
              <SectionHeader
                eyebrow="Provider"
                title="Active Model Stack"
                body="Choose the backend WALLE uses for the next message. Switching provider loads recommended defaults."
              />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 10,
                }}
              >
                {PROVIDER_OPTIONS.map((option) => {
                  const active = option === provider;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => void applyProviderPreset(option)}
                      style={{
                        textAlign: "left",
                        padding: "12px 14px",
                        borderRadius: 12,
                        border: active
                          ? "1px solid rgba(0, 212, 255, 0.45)"
                          : "1px solid var(--walle-glass-border)",
                        background: active ? "var(--walle-cyan-dim)" : "rgba(10,10,15,0.72)",
                        color: "var(--walle-text-primary)",
                        cursor: "pointer",
                        transition: "var(--walle-transition)",
                      }}
                    >
                      <div className="text-[13px] font-medium">
                        {PROVIDER_PRESETS[option].label}
                      </div>
                      <div
                        className="text-[11px] mt-1"
                        style={{ color: active ? "var(--walle-cyan)" : "var(--walle-text-secondary)" }}
                      >
                        {PROVIDER_PRESETS[option].requiresApiKey ? "Remote" : "Local"}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="text-[12px] mt-3" style={{ color: "var(--walle-text-secondary)" }}>
                {preset.helpText}
              </div>
            </section>

            <section style={sectionStyle}>
              <SectionHeader
                eyebrow="Runtime"
                title="Behavior Toggles"
                body="Control speed, visibility, and diagnostics."
              />
              <div className="grid gap-3">
                <ToggleTile
                  title="Smart routing"
                  body="Route simple requests to the fast model and longer or multi-step requests to the complex model."
                  checked={smartRouting}
                  onChange={setSmartRouting}
                />
                <ToggleTile
                  title="Debug mode"
                  body="Show the exact provider/model and token usage in the chat header."
                  checked={debugMode}
                  onChange={setDebugMode}
                />
                <ToggleTile
                  title="Show your work"
                  body="Live narration of each action (shell, apps, workflows) in a panel below messages. Toggle anytime with Ctrl+Shift+W."
                  checked={showWork}
                  onChange={setShowWork}
                />
              </div>
            </section>
          </div>

          <section style={{ ...sectionStyle, marginBottom: 16 }}>
            <SectionHeader
              eyebrow="Experience"
              title="How do you want WALLE to talk to you?"
              body="Plain language only, optional details, or full technical details."
            />
            <div className="grid gap-2">
              {(
                [
                  { id: "simple" as const, label: "Simple", hint: "Plain language only, no tech details" },
                  { id: "standard" as const, label: "Standard", hint: "Label + expandable details" },
                  { id: "developer" as const, label: "Developer", hint: "Full command details always visible" },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.id}
                  className="flex items-start gap-3 cursor-pointer rounded-xl p-3"
                  style={{
                    background:
                      userLevel === opt.id ? "var(--walle-cyan-dim)" : "rgba(10,10,15,0.72)",
                    border:
                      userLevel === opt.id
                        ? "1px solid rgba(0, 212, 255, 0.35)"
                        : "1px solid var(--walle-glass-border)",
                  }}
                >
                  <input
                    type="radio"
                    name="userLevel"
                    checked={userLevel === opt.id}
                    onChange={() => setUserLevel(opt.id)}
                    style={{ marginTop: 3 }}
                  />
                  <div>
                    <div className="text-[13px] font-medium" style={{ color: "var(--walle-text-primary)" }}>
                      {opt.label}
                    </div>
                    <div className="text-[12px] mt-0.5" style={{ color: "var(--walle-text-secondary)" }}>
                      {opt.hint}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </section>

          <section style={{ ...sectionStyle, marginBottom: 16 }}>
            <SectionHeader
              eyebrow="Privacy"
              title="Context sent to the model"
              body="Invisible in chat — only the assistant sees this. Active window helps with “what am I doing?” Clipboard is off by default."
            />
            <div className="grid gap-3">
              <ToggleTile
                title="Inject active window title"
                body="Foreground window name is sent with each message (omitted if the title contains “WALLE”)."
                checked={injectWindow}
                onChange={setInjectWindow}
              />
              <ToggleTile
                title="Inject clipboard preview"
                body="First ~200 characters of the clipboard, truncated further in the prompt. Enable only when you need it."
                checked={injectClipboard}
                onChange={handleInjectClipboard}
              />
            </div>
          </section>

          <section style={{ ...sectionStyle, marginBottom: 16 }}>
            <SectionHeader
              eyebrow="Automation"
              title="Cron schedules"
              body="Recurring actions stored locally. The assistant can create these; you can pause or remove them here."
            />
            {schedules.length === 0 ? (
              <div className="text-[12px]" style={{ color: "var(--walle-text-secondary)" }}>
                No schedules yet. Ask WALLE to set one (e.g. “every weekday at 9am notify me to stretch”).
              </div>
            ) : (
              <ul className="grid gap-2" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {schedules.map((row) => {
                  const cronHuman = formatCronHuman(row.cronExpr);
                  return (
                  <li
                    key={row.id}
                    className="rounded-xl p-3"
                    style={{
                      background: "rgba(10,10,15,0.72)",
                      border: "1px solid var(--walle-glass-border)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div
                          className="text-[13px] font-medium truncate"
                          style={{ color: "var(--walle-text-primary)" }}
                        >
                          {row.name}
                        </div>
                        <div
                          className="text-[11px] mt-0.5 break-all"
                          style={{
                            color: "var(--walle-text-muted)",
                            fontFamily: "var(--walle-font-mono)",
                          }}
                        >
                          {row.cronExpr}
                        </div>
                        {cronHuman && (
                          <div
                            className="text-[11px] mt-1"
                            style={{ color: "var(--walle-text-secondary)" }}
                          >
                            {cronHuman}
                          </div>
                        )}
                      </div>
                      <label className="flex items-center gap-2 shrink-0 text-[12px] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={row.enabled}
                          onChange={async (e) => {
                            const next = e.target.checked;
                            try {
                              await invoke("schedules_set_enabled_cmd", {
                                id: row.id,
                                enabled: next,
                              });
                              setSchedules((prev) =>
                                prev.map((s) => (s.id === row.id ? { ...s, enabled: next } : s)),
                              );
                            } catch (err) {
                              setStatus(String(err));
                            }
                          }}
                        />
                        On
                      </label>
                    </div>
                    <div className="flex justify-end mt-2">
                      <button
                        type="button"
                        className="text-[12px] px-2 py-1 rounded"
                        style={{ color: "var(--walle-text-secondary)" }}
                        onClick={async () => {
                          if (!window.confirm(`Delete schedule “${row.name}”?`)) return;
                          try {
                            await invoke("schedules_delete_cmd", { id: row.id });
                            setSchedules((prev) => prev.filter((s) => s.id !== row.id));
                          } catch (err) {
                            setStatus(String(err));
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                );
                })}
              </ul>
            )}
          </section>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
              gap: 16,
            }}
          >
            <section style={sectionStyle}>
              <SectionHeader
                eyebrow="Models"
                title="Routing Targets"
                body="These are editable. The selected provider presets are just a starting point."
              />
              <div className="grid gap-3">
                <div>
                  <label
                    className="block text-[12px] mb-1.5"
                    style={{ color: "var(--walle-text-secondary)" }}
                  >
                    Fast model
                  </label>
                  <input
                    type="text"
                    style={fieldStyle}
                    value={defaultModel}
                    onChange={(e) => setDefaultModel(e.target.value)}
                  />
                </div>
                <div>
                  <label
                    className="block text-[12px] mb-1.5"
                    style={{ color: "var(--walle-text-secondary)" }}
                  >
                    Complex model
                  </label>
                  <input
                    type="text"
                    style={fieldStyle}
                    value={complexModel}
                    onChange={(e) => setComplexModel(e.target.value)}
                  />
                </div>
                <div>
                  <label
                    className="block text-[12px] mb-1.5"
                    style={{ color: "var(--walle-text-secondary)" }}
                  >
                    Base URL
                  </label>
                  <input
                    type="text"
                    style={fieldStyle}
                    placeholder="Leave blank for built-in defaults"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                  />
                </div>
              </div>
            </section>

            <section style={sectionStyle}>
              <SectionHeader
                eyebrow="Credentials"
                title={`${preset.label} Access`}
                body={
                  preset.requiresApiKey
                    ? "Each provider keeps its key in the OS keychain separately."
                    : "Local Ollama usage does not require credentials."
                }
              />
              {preset.requiresApiKey ? (
                <div className="grid gap-3">
                  <div
                    className="rounded-xl px-3 py-2"
                    style={{
                      background: keySaved ? "rgba(0,255,136,0.08)" : "rgba(255,179,71,0.08)",
                      border: keySaved
                        ? "1px solid rgba(0,255,136,0.18)"
                        : "1px solid rgba(255,179,71,0.18)",
                    }}
                  >
                    <div className="text-[12px]" style={{ color: "var(--walle-text-secondary)" }}>
                      Stored key status
                    </div>
                    <div
                      className="text-[15px] mt-1"
                      style={{
                        color: keySaved ? "var(--walle-green)" : "var(--walle-amber)",
                        fontFamily: "var(--walle-font-mono)",
                      }}
                    >
                      {keySaved === null ? "unknown" : keySaved ? "connected" : "missing"}
                    </div>
                  </div>
                  <div>
                    <label
                      className="block text-[12px] mb-1.5"
                      style={{ color: "var(--walle-text-secondary)" }}
                    >
                      Update API key
                    </label>
                    <input
                      type="password"
                      style={fieldStyle}
                      placeholder={`Leave blank to keep the saved ${preset.label} key`}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div
                  className="rounded-xl p-4"
                  style={{
                    background: "rgba(0,212,255,0.08)",
                    border: "1px solid rgba(0,212,255,0.18)",
                    color: "var(--walle-text-secondary)",
                    fontSize: 13,
                  }}
                >
                  Ollama uses your local endpoint. If the server is running at the configured base
                  URL, WALLE can use it immediately.
                </div>
              )}
            </section>
          </div>
            </>
          )}
        </div>

        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid var(--walle-glass-border)",
            background: "rgba(8,10,15,0.88)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div
            className="text-[12px]"
            style={{
              color: status ? "var(--walle-text-secondary)" : "var(--walle-text-muted)",
              minHeight: 18,
            }}
          >
            {status || "Changes take effect on the next message."}
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              className="px-4 py-2 rounded-xl text-sm"
              style={{
                border: "1px solid var(--walle-glass-border)",
                color: "var(--walle-text-secondary)",
                background: "rgba(255,255,255,0.03)",
              }}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{
                border: "1px solid rgba(0,212,255,0.4)",
                color: "var(--walle-cyan)",
                background:
                  "linear-gradient(180deg, rgba(0,212,255,0.2), rgba(0,212,255,0.08))",
                boxShadow: "var(--walle-cyan-glow)",
              }}
              onClick={() => void save()}
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
