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

/** Pulls the first top-level `{ ... }` so models can prefix prose before JSON. */
function extractJsonObject(raw: string): string {
  const start = raw.indexOf("{");
  if (start === -1) {
    throw new SyntaxError("No JSON object found in model output");
  }
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < raw.length; i++) {
    const c = raw[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\" && inString) {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) return raw.slice(start, i + 1);
      }
    }
  }
  throw new SyntaxError("Unbalanced braces in model JSON");
}

export function parsePlan(raw: string): WallePlan {
  const clean = raw.replace(/```json|```/g, "").trim();
  const jsonSlice = extractJsonObject(clean);
  const parsed = JSON.parse(jsonSlice) as Record<string, unknown>;
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
