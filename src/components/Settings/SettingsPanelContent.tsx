import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import cronstrue from "cronstrue";
import { useCallback, useEffect, useState } from "react";

import { notifyConfigChanged, notifyRunWorkflow } from "../../lib/settingsCrossWindow";
import {
  normalizeWorkflowsFromConfig,
  type WorkflowConfigItem,
} from "../../lib/workflowsFromConfig";
import {
  normalizeUserLevel,
  saveUiPreferences,
  type UserLevel,
} from "../../lib/uiPreferences";
import {
  parseActiveMascotFromConfigJson,
  type Schedule,
  type Workflow,
  useWalleStore,
} from "../../store/walleStore";
import PluginManager from "./PluginManager";
import WorkflowEditor from "./WorkflowEditor";
import { InlineConfirmDialog } from "./InlineConfirmDialog";

interface SettingsPanelContentProps {
  onClose: () => void;
}

type SettingsTab = "general" | "appearance" | "plugins" | "workflows";

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
  workflows?: WorkflowConfigItem[];
  mascot?: { active?: string; sounds?: boolean };
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

function MascotFacePreviewWalle() {
  return (
    <svg width={70} height={70} viewBox="0 0 48 48" aria-hidden>
      <rect x="8" y="14" width="32" height="28" rx="8" fill="#1c2038" stroke="#22253e" strokeWidth="1.2" />
      <circle cx="18" cy="26" r="5" fill="#ffb347" />
      <circle cx="30" cy="26" r="5" fill="#ffb347" />
      <circle cx="18" cy="26" r="2" fill="#0d0800" />
      <circle cx="30" cy="26" r="2" fill="#0d0800" />
      <rect x="20" y="36" width="8" height="2" rx="1" fill="#00d4ff" opacity="0.5" />
    </svg>
  );
}

function MascotFacePreviewDuDu() {
  return (
    <svg width={70} height={70} viewBox="0 0 48 48" aria-hidden>
      <circle cx="24" cy="26" r="20" fill="#3db84a" />
      <ellipse cx="24" cy="18" rx="14" ry="10" fill="#1a3020" opacity="0.7" />
      <circle cx="17" cy="24" r="7" fill="white" opacity="0.92" />
      <circle cx="31" cy="24" r="7" fill="white" opacity="0.92" />
      <circle cx="17" cy="24" r="3" fill="#3a2800" />
      <circle cx="31" cy="24" r="3" fill="#3a2800" />
      <ellipse cx="11" cy="28" rx="4" ry="3" fill="#3db84a" opacity="0.85" />
      <ellipse cx="37" cy="28" rx="4" ry="3" fill="#3db84a" opacity="0.85" />
      <path
        d="M20 33 Q24 36 28 33"
        fill="none"
        stroke="#c8c4a0"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MascotPickerCard({
  name,
  description,
  personality,
  isActive,
  onSelect,
  preview,
}: {
  name: string;
  description: string;
  personality: string;
  isActive: boolean;
  onSelect: () => void;
  preview: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex flex-col items-center gap-2.5 text-left"
      style={{
        flex: 1,
        minWidth: 0,
        border: isActive ? "1.5px solid var(--walle-cyan)" : "1px solid var(--walle-glass-border)",
        borderRadius: "var(--walle-radius-lg)",
        background: isActive ? "var(--walle-cyan-dim)" : "var(--walle-bg-2)",
        padding: "16px",
        cursor: "pointer",
        transition: "var(--walle-transition)",
      }}
    >
      <div className="flex items-center justify-center" style={{ height: 80 }}>
        {preview}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[13px] font-bold" style={{ color: "var(--walle-text-primary)" }}>
          {name}
        </span>
        {isActive && (
          <span
            className="text-[9px] font-bold uppercase"
            style={{
              padding: "2px 6px",
              borderRadius: 999,
              background: "var(--walle-cyan-dim)",
              color: "var(--walle-cyan)",
              border: "1px solid var(--walle-cyan)",
            }}
          >
            Active
          </span>
        )}
      </div>
      <p className="text-[11px] text-center m-0" style={{ color: "var(--walle-text-secondary)" }}>
        {description}
      </p>
      <p
        className="text-[10px] text-center m-0 italic"
        style={{ color: "var(--walle-text-muted)" }}
      >
        &ldquo;{personality}&rdquo;
      </p>
    </button>
  );
}

export function SettingsPanelContent({ onClose }: SettingsPanelContentProps) {
  const activeMascot = useWalleStore((s) => s.activeMascot);
  const setActiveMascot = useWalleStore((s) => s.setActiveMascot);
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
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [clipboardPromptOpen, setClipboardPromptOpen] = useState(false);
  const [scheduleDeleteTarget, setScheduleDeleteTarget] = useState<{ id: number; name: string } | null>(
    null,
  );
  const [mascotSounds, setMascotSounds] = useState(true);

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

  const refreshSchedules = useCallback(async () => {
    try {
      const rows = await invoke<Schedule[]>("schedules_list_cmd");
      setSchedules(rows);
    } catch {
      setSchedules([]);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const raw = await invoke<string>("get_walle_config");
        const parsed = JSON.parse(raw) as SettingsConfig;
        useWalleStore.setState({ activeMascot: parseActiveMascotFromConfigJson(raw) });
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
        setMascotSounds(parsed.mascot?.sounds !== false);
        setStatus("");
        setApiKey("");
        await refreshKeyStatus(nextProvider);
        setDeveloperMode(parsed.developer_mode?.enabled === true);
        if (Array.isArray(parsed.plugins?.enabled) && parsed.plugins!.enabled!.length > 0) {
          setEnabledPlugins(parsed.plugins!.enabled as string[]);
        } else {
          setEnabledPlugins(["shell", "app_launch", "notify", "git"]);
        }
        setWorkflows(normalizeWorkflowsFromConfig(parsed));
        await refreshSchedules();
      } catch (e) {
        setStatus(String(e));
      }
    })().catch((e) => setStatus(String(e)));
  }, [refreshSchedules]);

  useEffect(() => {
    let unlistenFocus: (() => void) | undefined;
    void getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (focused) void refreshSchedules();
      })
      .then((u) => {
        unlistenFocus = u;
      });
    return () => {
      unlistenFocus?.();
    };
  }, [refreshSchedules]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen("walle/schedules-changed", () => {
      void refreshSchedules();
    }).then((u) => {
      unlisten = u;
    });
    return () => {
      unlisten?.();
    };
  }, [refreshSchedules]);

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

  const preset = PROVIDER_PRESETS[provider];

  const handleInjectClipboard = (next: boolean) => {
    if (!next) {
      setInjectClipboard(false);
      return;
    }
    if (typeof localStorage !== "undefined" && !localStorage.getItem(CLIPBOARD_PROMPT_KEY)) {
      setClipboardPromptOpen(true);
      return;
    }
    setInjectClipboard(true);
  };

  const confirmClipboardPrompt = () => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(CLIPBOARD_PROMPT_KEY, "1");
    }
    setInjectClipboard(true);
    setClipboardPromptOpen(false);
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
      await saveUiPreferences({ user_level: userLevel, show_work: showWork, mascot_sounds: mascotSounds });
      await invoke("save_context_settings", {
        settings: {
          injectActiveWindow: injectWindow,
          injectClipboard,
        },
      });
      await refreshKeyStatus(provider);
      setStatus("Settings saved. Keys stay separated by provider.");
      await notifyConfigChanged();
    } catch (e) {
      setStatus(String(e));
    }
  };

  const runWorkflowFromSettings = (name: string) => {
    void notifyRunWorkflow(name);
  };

  const afterPluginToggle = async () => {
    await refreshPluginsFromConfig();
    await notifyConfigChanged();
  };

  return (
    <div
      style={{
        position: "relative",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      {clipboardPromptOpen && (
        <InlineConfirmDialog
          message="Clipboard injection sends the first ~200 characters of your clipboard to the language model with each message. Only enable this if you accept that privacy tradeoff."
          confirmLabel="Enable"
          onConfirm={confirmClipboardPrompt}
          onCancel={() => setClipboardPromptOpen(false)}
        />
      )}
      {scheduleDeleteTarget && (
        <InlineConfirmDialog
          message={`Delete schedule “${scheduleDeleteTarget.name}”?`}
          onConfirm={() => {
            const id = scheduleDeleteTarget.id;
            setScheduleDeleteTarget(null);
            void (async () => {
              try {
                await invoke("schedules_delete_cmd", { id });
                setSchedules((prev) => prev.filter((s) => s.id !== id));
                await notifyConfigChanged();
              } catch (err) {
                setStatus(String(err));
              }
            })();
          }}
          onCancel={() => setScheduleDeleteTarget(null)}
        />
      )}

      <div
        className="walle-chat-scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "20px 22px",
          display: "grid",
          gap: 18,
          minHeight: 0,
          /* Avoid default grid item stretch: tall content row was stretching the tab bar + pill buttons */
          alignItems: "start",
          justifyItems: "stretch",
        }}
      >
        <div className="flex flex-wrap items-center gap-2 shrink-0 self-start">
          {(
            [
              { id: "general" as const, label: "General" },
              { id: "appearance" as const, label: "Appearance" },
              { id: "plugins" as const, label: "Plugins" },
              { id: "workflows" as const, label: "Workflows" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="text-[12px] px-3 py-1.5 rounded-xl transition shrink-0"
              style={{
                border:
                  tab === t.id
                    ? "1px solid rgba(0, 212, 255, 0.45)"
                    : "1px solid var(--walle-glass-border)",
                background: tab === t.id ? "var(--walle-cyan-dim)" : "rgba(10,10,15,0.72)",
                color: "var(--walle-text-primary)",
                width: "auto",
                height: "auto",
                lineHeight: 1.25,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "appearance" && (
          <section style={{ ...sectionStyle, marginBottom: 16 }}>
            <SectionHeader
              eyebrow="Mascot"
              title="Choose your companion"
              body="Switch instantly — no restart. The mascot window updates as soon as you pick."
            />
            <div
              className="flex flex-wrap gap-3"
              style={{ alignItems: "stretch" }}
            >
              <MascotPickerCard
                name="WALLE"
                description="Boxy robot — warm, curious, efficient"
                personality="Concise, helpful, slightly witty"
                isActive={activeMascot === "walle"}
                onSelect={() => {
                  if (activeMascot === "walle") return;
                  setActiveMascot("walle");
                  setStatus("Switched to WALLE.");
                }}
                preview={<MascotFacePreviewWalle />}
              />
              <MascotPickerCard
                name="DuDu"
                description="Green-cheeked conure — chirpy, playful"
                personality="Excitable, birdy, loves a good squawk"
                isActive={activeMascot === "dudu"}
                onSelect={() => {
                  if (activeMascot === "dudu") return;
                  setActiveMascot("dudu");
                  setStatus("Switched to DuDu.");
                }}
                preview={<MascotFacePreviewDuDu />}
              />
            </div>
            <p className="text-[12px] mt-3 m-0" style={{ color: "var(--walle-text-secondary)" }}>
              Active:{" "}
              <span style={{ color: "var(--walle-cyan)", fontWeight: 600 }}>
                {activeMascot === "dudu" ? "DuDu" : "WALLE"}
              </span>
            </p>
            <div className="mt-4 max-w-md">
              <ToggleTile
                title="Mascot sounds"
                body="Soft chirps for DuDu and little robot bloops for WALLE when they react, pet, or play animations."
                checked={mascotSounds}
                onChange={(next) => {
                  setMascotSounds(next);
                  void (async () => {
                    try {
                      await saveUiPreferences({ mascot_sounds: next });
                      setStatus(next ? "Mascot sounds on." : "Mascot sounds off.");
                      await notifyConfigChanged();
                    } catch (e) {
                      setStatus(String(e));
                    }
                  })();
                }}
              />
            </div>
          </section>
        )}

        {tab === "plugins" && (
          <PluginManager
            developerMode={developerMode}
            enabledIds={enabledPlugins}
            onStatus={setStatus}
            onAfterToggle={() => void afterPluginToggle()}
          />
        )}

        {tab === "workflows" && (
          <WorkflowEditor
            workflows={workflows}
            onWorkflowsChange={setWorkflows}
            onRun={runWorkflowFromSettings}
            onStatus={setStatus}
            onAfterPersist={() => {
              void notifyConfigChanged();
            }}
          />
        )}

        {tab === "general" && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
                gap: 18,
                alignItems: "start",
              }}
            >
              <section style={{ ...sectionStyle, minWidth: 0 }}>
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
                          minWidth: 0,
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
                          style={{
                            color: active ? "var(--walle-cyan)" : "var(--walle-text-secondary)",
                          }}
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

              <section style={{ ...sectionStyle, minWidth: 0 }}>
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
                                  setSchedules(
                                    schedules.map((s) => (s.id === row.id ? { ...s, enabled: next } : s)),
                                  );
                                  await notifyConfigChanged();
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
                            onClick={() => setScheduleDeleteTarget({ id: row.id, name: row.name })}
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
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
                gap: 18,
                alignItems: "start",
              }}
            >
              <section style={{ ...sectionStyle, minWidth: 0 }}>
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

              <section style={{ ...sectionStyle, minWidth: 0 }}>
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
          flexShrink: 0,
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
  );
}
