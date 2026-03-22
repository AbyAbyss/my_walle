/** Detected habit pattern (mirrors backend `PatternDto`). */
export interface Pattern {
  id: string;
  description: string;
  trigger: string;
  action: string;
  occurrences: number;
  confidence: number;
  lastSeen: string;
  suggested: boolean;
  accepted: boolean | null;
  /** Set when `source === "proactive"` (backend `NudgeEnvelope.watcher_id`). */
  watcherId?: string;
  source?: "pattern" | "proactive";
}
