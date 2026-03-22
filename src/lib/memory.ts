/** Canonical memory types persisted in SQLite (`memories.type`). */
export type MemoryType =
  | "habit"
  | "preference"
  | "fact"
  | "pattern"
  | "outcome";

export interface Memory {
  id: number;
  type: MemoryType;
  key: string;
  value: string;
  confidence: number;
  source: "user" | "inferred" | "observed";
  created_at: string;
  updated_at: string;
  last_used: string | null;
  use_count: number;
}

/** Optional `memories` entries in the LLM JSON plan (Phase 2). */
export interface MemoryDraft {
  type: MemoryType;
  key: string;
  value: string;
  source: "user" | "inferred" | "observed";
}
