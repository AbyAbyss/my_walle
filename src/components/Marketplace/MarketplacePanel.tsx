import { useState } from "react";

import { searchPlugins, type RegistryPlugin } from "../../lib/marketplace";

export default function MarketplacePanel({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<RegistryPlugin[]>([]);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="glass-panel p-3 text-left">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium" style={{ color: "var(--walle-text-primary)" }}>
          Marketplace
        </span>
        <button type="button" className="text-xs" onClick={onClose}>
          Close
        </button>
      </div>
      <input
        className="w-full mb-2 px-2 py-1 rounded text-sm"
        placeholder="Search…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            void (async () => {
              try {
                setErr(null);
                setRows(await searchPlugins(q.trim() || "plugin"));
              } catch (ex) {
                setErr(ex instanceof Error ? ex.message : String(ex));
              }
            })();
          }
        }}
      />
      {err && <p className="text-xs" style={{ color: "var(--walle-red)" }}>{err}</p>}
      <ul className="text-xs space-y-2 max-h-64 overflow-y-auto">
        {rows.map((r) => (
          <li key={r.id} style={{ color: "var(--walle-text-secondary)" }}>
            <strong>{r.name}</strong> v{r.version}
            <div className="opacity-70">{r.id}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
