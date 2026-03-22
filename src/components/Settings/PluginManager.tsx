import { invoke } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";

const sectionStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(22,24,33,0.92), rgba(14,16,24,0.9))",
  border: "1px solid var(--walle-glass-border)",
  borderRadius: "14px",
  padding: "16px",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
};

interface BuiltinDef {
  id: string;
  title: string;
  body: string;
  risk: string;
  permissions: string[];
  requiresDev?: boolean;
}

const BUILTIN_PLUGINS: BuiltinDef[] = [
  {
    id: "shell",
    title: "Shell",
    body: "Run PowerShell commands on Windows.",
    risk: "Moderate · dangerous possible",
    permissions: ["shell:execute", "process:spawn"],
  },
  {
    id: "app_launch",
    title: "App launcher",
    body: "Open applications by display name.",
    risk: "Safe",
    permissions: ["os:launch-app"],
  },
  {
    id: "notify",
    title: "Notifications",
    body: "OS toast alerts and delayed reminders.",
    risk: "Safe",
    permissions: ["notification:post"],
  },
  {
    id: "git",
    title: "Git",
    body: "Repo-aware git actions when developer mode is enabled.",
    risk: "Moderate · dangerous possible",
    permissions: ["process:git", "fs:read-repo"],
    requiresDev: true,
  },
];

export interface ExternalManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  permissions: string[];
  commands: {
    name: string;
    description?: string;
    risk?: string;
    shellTemplate?: string;
    shell_template?: string;
  }[];
}

interface PluginManagerProps {
  developerMode: boolean;
  enabledIds: string[];
  onStatus: (msg: string) => void;
  onAfterToggle?: () => void;
}

export default function PluginManager({
  developerMode,
  enabledIds,
  onStatus,
  onAfterToggle,
}: PluginManagerProps) {
  const [external, setExternal] = useState<ExternalManifest[]>([]);
  const [pluginsDir, setPluginsDir] = useState<string>("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const refreshExternal = useCallback(async () => {
    try {
      const rows = await invoke<ExternalManifest[]>("list_external_plugin_manifests");
      setExternal(rows);
    } catch (e) {
      onStatus(String(e));
    }
  }, [onStatus]);

  useEffect(() => {
    void (async () => {
      try {
        const dir = await invoke<string>("get_user_plugins_dir_cmd");
        setPluginsDir(dir);
      } catch {
        /* ignore */
      }
      void refreshExternal();
    })();
  }, [refreshExternal]);

  useEffect(() => {
    let un: (() => void) | undefined;
    void listen("walle/plugins-folder-changed", () => {
      void refreshExternal();
    }).then((fn) => {
      un = fn;
    });
    return () => un?.();
  }, [refreshExternal]);

  const toggleBuiltin = async (id: string, on: boolean) => {
    const next = new Set(enabledIds);
    if (on) next.add(id);
    else next.delete(id);
    const list = [...next];
    try {
      await invoke("save_plugins_enabled", { enabled: list });
      onStatus(on ? `Enabled ${id}` : `Disabled ${id}`);
      onAfterToggle?.();
    } catch (e) {
      onStatus(String(e));
    }
  };

  const openFolder = async () => {
    try {
      const dir = pluginsDir || (await invoke<string>("get_user_plugins_dir_cmd"));
      await openPath(dir);
    } catch (e) {
      onStatus(String(e));
    }
  };

  return (
    <div className="grid gap-4">
      <section style={sectionStyle}>
        <div
          className="text-[10px] uppercase tracking-[0.22em] mb-2"
          style={{ color: "var(--walle-cyan)" }}
        >
          Built-in
        </div>
        <div className="grid gap-2">
          {BUILTIN_PLUGINS.filter((p) => !p.requiresDev || developerMode).map((p) => {
            const on = enabledIds.includes(p.id);
            const open = expanded === `b-${p.id}`;
            return (
              <div
                key={p.id}
                className="rounded-xl p-3"
                style={{
                  background: "rgba(10,10,15,0.72)",
                  border: "1px solid var(--walle-glass-border)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-[13px] font-medium"
                        style={{ color: "var(--walle-text-primary)" }}
                      >
                        {p.title}
                      </span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{
                          background: "rgba(0,212,255,0.12)",
                          color: "var(--walle-cyan)",
                          fontFamily: "var(--walle-font-mono)",
                        }}
                      >
                        {p.risk}
                      </span>
                    </div>
                    <div className="text-[12px] mt-1" style={{ color: "var(--walle-text-secondary)" }}>
                      {p.body}
                    </div>
                  </div>
                  <label className="flex items-center gap-2 shrink-0 text-[12px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => void toggleBuiltin(p.id, e.target.checked)}
                    />
                    On
                  </label>
                </div>
                <button
                  type="button"
                  className="text-[11px] mt-2"
                  style={{ color: "var(--walle-text-muted)" }}
                  onClick={() => setExpanded(open ? null : `b-${p.id}`)}
                >
                  {open ? "Hide permissions" : "Permissions"}
                </button>
                {open && (
                  <ul
                    className="text-[11px] mt-1 pl-4 list-disc"
                    style={{ color: "var(--walle-text-muted)", fontFamily: "var(--walle-font-mono)" }}
                  >
                    {p.permissions.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section style={sectionStyle}>
        <div
          className="text-[10px] uppercase tracking-[0.22em] mb-2"
          style={{ color: "var(--walle-cyan)" }}
        >
          Installed (~/.walle/plugins)
        </div>
        <p className="text-[12px] mb-3" style={{ color: "var(--walle-text-secondary)" }}>
          Each folder may contain a <code className="text-[11px]">manifest.json</code> with{" "}
          <code className="text-[11px]">shellTemplate</code> commands. The folder is watched — changes
          refresh this list.
        </p>
        {external.length === 0 ? (
          <div className="text-[12px]" style={{ color: "var(--walle-text-muted)" }}>
            No manifests found yet.
          </div>
        ) : (
          <ul className="grid gap-2" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {external.map((m) => (
              <li
                key={m.id}
                className="rounded-xl p-3"
                style={{
                  background: "rgba(10,10,15,0.72)",
                  border: "1px solid var(--walle-glass-border)",
                }}
              >
                <div className="flex justify-between gap-2">
                  <div>
                    <div className="text-[13px] font-medium" style={{ color: "var(--walle-text-primary)" }}>
                      {m.name}
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: "var(--walle-text-muted)" }}>
                      {m.id} · v{m.version}
                      {m.author ? ` · ${m.author}` : ""}
                    </div>
                    {m.description && (
                      <div className="text-[12px] mt-1" style={{ color: "var(--walle-text-secondary)" }}>
                        {m.description}
                      </div>
                    )}
                  </div>
                </div>
                {m.commands?.length ? (
                  <div className="text-[11px] mt-2" style={{ color: "var(--walle-text-muted)" }}>
                    Commands: {m.commands.map((c) => c.name).join(", ")}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            type="button"
            className="text-[12px] px-3 py-1.5 rounded-xl"
            style={{
              border: "1px solid var(--walle-glass-border)",
              color: "var(--walle-text-secondary)",
              background: "rgba(255,255,255,0.03)",
            }}
            onClick={() => void openFolder()}
          >
            Open plugins folder
          </button>
          <button
            type="button"
            className="text-[12px] px-3 py-1.5 rounded-xl"
            style={{
              border: "1px solid var(--walle-glass-border)",
              color: "var(--walle-text-secondary)",
              background: "rgba(255,255,255,0.03)",
            }}
            onClick={() => void refreshExternal()}
          >
            Refresh list
          </button>
        </div>
        {pluginsDir && (
          <div
            className="text-[10px] mt-2 break-all"
            style={{ color: "var(--walle-text-muted)", fontFamily: "var(--walle-font-mono)" }}
          >
            {pluginsDir}
          </div>
        )}
      </section>
    </div>
  );
}
