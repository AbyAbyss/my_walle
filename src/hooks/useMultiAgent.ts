import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

export interface ChainProgressRow {
  id: string;
  status: string;
  goal?: string;
  output?: string;
}

export function useMultiAgent() {
  const [rows, setRows] = useState<ChainProgressRow[]>([]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      unlisten = await listen<ChainProgressRow>("chain:progress", (ev) => {
        const p = ev.payload;
        if (!p?.id) return;
        setRows((prev) => {
          const i = prev.findIndex((r) => r.id === p.id);
          if (i >= 0) {
            const n = [...prev];
            n[i] = { ...n[i], ...p };
            return n;
          }
          return [...prev, p];
        });
      });
    })().catch(console.error);
    return () => {
      unlisten?.();
    };
  }, []);

  const clear = () => setRows([]);

  return { chainRows: rows, clearChainRows: clear };
}
