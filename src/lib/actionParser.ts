import type { Emotion } from "./emotion";
import { normalizeEmotion } from "./emotion";

export interface WalleAction {
  plugin: string;
  label: string;
  risk: "low" | "medium" | "high";
  params: Record<string, unknown>;
}

export interface WallePlan {
  message: string;
  emotion: Emotion;
  actions: WalleAction[];
  requires_approval: boolean;
}

export function parsePlan(raw: string): WallePlan {
  const clean = raw.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(clean) as Record<string, unknown>;
  const actionsRaw = Array.isArray(parsed.actions) ? parsed.actions : [];
  const actions: WalleAction[] = actionsRaw.map((a) => {
    const o = a as Record<string, unknown>;
    return {
      plugin: String(o.plugin ?? "notify"),
      label: String(o.label ?? ""),
      risk: (o.risk as WalleAction["risk"]) ?? "low",
      params: (o.params as Record<string, unknown>) ?? {},
    };
  });
  return {
    message: String(parsed.message ?? ""),
    emotion: normalizeEmotion(parsed.emotion as string | undefined),
    actions,
    requires_approval: Boolean(parsed.requires_approval),
  };
}
