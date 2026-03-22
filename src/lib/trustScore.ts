import { invoke } from "@tauri-apps/api/core";

import type { WalleAction } from "./actionParser";

/** Mirrors `TrustScoreDto` from the backend. */
export interface TrustScoreRow {
  entityType: string;
  entityId: string;
  score: number;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  lastRun: string | null;
  lastFailure: string | null;
  userOverrides: number;
  pinned: string | null;
}

export function commandSummaryForTrust(action: WalleAction): string {
  return JSON.stringify(action.params ?? {});
}

export async function fetchTrustForAction(action: WalleAction): Promise<TrustScoreRow | null> {
  try {
    return await invoke<TrustScoreRow | null>("trust_get_for_action", {
      payload: {
        plugin: action.plugin,
        commandSummary: commandSummaryForTrust(action),
      },
    });
  } catch {
    return null;
  }
}

/** Phase 3 auto-execute gate (trust never overrides `dangerous`). */
export function shouldAutoExecute(
  baseRisk: "safe" | "moderate" | "dangerous",
  trust: TrustScoreRow | null,
): boolean {
  if (baseRisk === "dangerous") return false;
  if (trust?.pinned === "blacklist") return false;
  if (trust?.pinned === "whitelist") return true;
  const score = trust?.score ?? 50;
  const runs = trust?.totalRuns ?? 0;
  if (baseRisk === "moderate") return score >= 80 && runs >= 5;
  if (baseRisk === "safe") return score >= 30;
  return true;
}
