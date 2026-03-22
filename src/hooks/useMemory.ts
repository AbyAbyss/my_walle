import { invoke } from "@tauri-apps/api/core";
import { useCallback } from "react";

import type { Memory } from "../lib/memory";
import { useWalleStore } from "../store/walleStore";

interface MemoryListRow {
  id: number;
  type: string;
  key: string;
  value: string;
  confidence: number;
  source: string;
  createdAt: string;
  updatedAt: string;
  lastUsed: string | null;
  useCount: number;
}

function toMemory(r: MemoryListRow): Memory {
  return {
    id: r.id,
    type: r.type as Memory["type"],
    key: r.key,
    value: r.value,
    confidence: r.confidence,
    source: r.source as Memory["source"],
    created_at: r.createdAt,
    updated_at: r.updatedAt,
    last_used: r.lastUsed,
    use_count: r.useCount,
  };
}

/** Loads SQLite memories into Zustand (`setMemories`). */
export function useMemory(limit = 100) {
  const memories = useWalleStore((s) => s.memories);
  const setMemories = useWalleStore((s) => s.setMemories);

  const refresh = useCallback(async () => {
    const rows = await invoke<MemoryListRow[]>("memories_list_cmd", { limit });
    setMemories(rows.map(toMemory));
  }, [limit, setMemories]);

  return { memories, refresh };
}
