import { invoke } from "@tauri-apps/api/core";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";

import "./styles/globals.css";

interface MemDto {
  id: number;
  memType: string;
  key: string;
  value: string;
}

function InsightsApp() {
  const [memories, setMemories] = useState<MemDto[]>([]);
  const [trust, setTrust] = useState<unknown[]>([]);
  const [patterns, setPatterns] = useState<unknown[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const m = await invoke<MemDto[]>("memories_list_cmd", { limit: 100 });
        const t = await invoke<unknown[]>("trust_list");
        const p = await invoke<unknown[]>("patterns_list");
        setMemories(m);
        setTrust(t);
        setPatterns(p);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  return (
    <div className="min-h-screen p-4 text-left" style={{ background: "var(--walle-bg-1)" }}>
      <h1 className="text-lg font-semibold mb-3" style={{ color: "var(--walle-text-primary)" }}>
        WALLE Insights
      </h1>
      {err && <p style={{ color: "var(--walle-red)" }}>{err}</p>}
      <section className="mb-4">
        <h2 className="text-sm mb-1" style={{ color: "var(--walle-text-secondary)" }}>
          Memory ({memories.length})
        </h2>
        <ul className="text-xs space-y-1" style={{ color: "var(--walle-text-muted)" }}>
          {memories.slice(0, 12).map((m) => (
            <li key={m.key}>
              <strong>{m.memType}</strong> · {m.key}: {m.value.slice(0, 80)}
              {m.value.length > 80 ? "…" : ""}
            </li>
          ))}
        </ul>
      </section>
      <section className="mb-4">
        <h2 className="text-sm mb-1" style={{ color: "var(--walle-text-secondary)" }}>
          Trust scores ({trust.length})
        </h2>
        <pre
          className="text-[11px] overflow-auto max-h-40 p-2 rounded"
          style={{ background: "var(--walle-bg-2)" }}
        >
          {JSON.stringify(trust.slice(0, 20), null, 2)}
        </pre>
      </section>
      <section>
        <h2 className="text-sm mb-1" style={{ color: "var(--walle-text-secondary)" }}>
          Patterns ({patterns.length})
        </h2>
        <pre
          className="text-[11px] overflow-auto max-h-40 p-2 rounded"
          style={{ background: "var(--walle-bg-2)" }}
        >
          {JSON.stringify(patterns.slice(0, 20), null, 2)}
        </pre>
      </section>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <InsightsApp />
  </React.StrictMode>,
);
