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

/** Models sometimes copy the prompt's "allowed plugins" union as the plugin field; fix using params. */
function normalizePluginField(raw: string, params: Record<string, unknown>): string {
  const s = String(raw ?? "").trim();
  if (!s.includes("|")) return s || "notify";
  if (params.command != null) return "shell";
  if (
    params.name != null &&
    typeof params.name === "string" &&
    params.steps == null &&
    !params.cron_expr &&
    !params.cronExpr
  ) {
    return "run_workflow";
  }
  if (params.app != null) return "app_launch";
  const parts = s.split("|").map((x) => x.trim()).filter(Boolean);
  return parts[0] ?? "notify";
}

export function parsePlan(raw: string): WallePlan {
  const clean = raw.replace(/```json|```/g, "").trim();
  const jsonSlice = extractJsonObject(clean);
  const parsed = JSON.parse(jsonSlice) as Record<string, unknown>;
  const actionsRaw = Array.isArray(parsed.actions) ? parsed.actions : [];
  const actions: WalleAction[] = actionsRaw.map((a) => {
    const o = a as Record<string, unknown>;
    const params = (o.params as Record<string, unknown>) ?? {};
    const pluginRaw = String(o.plugin ?? "notify");
    return {
      plugin: normalizePluginField(pluginRaw, params),
      label: String(o.label ?? ""),
      risk: (o.risk as WalleAction["risk"]) ?? "low",
      params,
    };
  });
  return {
    message: String(parsed.message ?? ""),
    emotion: normalizeEmotion(parsed.emotion as string | undefined),
    actions,
    requires_approval: Boolean(parsed.requires_approval),
  };
}
