import { invoke } from "@tauri-apps/api/core";

import type { WalleAction } from "./actionParser";
import { emitMascotAnimation } from "./mascotBridge";
import { formatPluginResult } from "./pluginResultFormat";
import { persistConversationLine } from "./persistConversation";
import { useWalleStore } from "../store/walleStore";

export interface ScheduleFirePayload {
  id: number;
  name: string;
  cronExpr: string;
  actions: unknown[];
}

async function getActionDelayMs(): Promise<number> {
  try {
    const raw = await invoke<string>("get_walle_config");
    const j = JSON.parse(raw) as { agent?: { action_delay_ms?: number } };
    const ms = j.agent?.action_delay_ms;
    return typeof ms === "number" && Number.isFinite(ms) && ms >= 0 ? ms : 600;
  } catch {
    return 600;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeStep(raw: unknown): WalleAction {
  const o = raw as Record<string, unknown>;
  return {
    plugin: String(o.plugin ?? "notify"),
    label: String(o.label ?? ""),
    risk: o.risk === "medium" || o.risk === "high" ? o.risk : "low",
    params: (o.params as Record<string, unknown>) ?? {},
  };
}

/** Runs stored schedule actions (no approval UI). Invoked when the backend emits `schedule:fire`. */
export async function runScheduleFire(payload: ScheduleFirePayload): Promise<void> {
  const store = useWalleStore.getState();
  const delayMs = await getActionDelayMs();
  const intro = `**Schedule:** “${payload.name}” fired (\`${payload.cronExpr}\`)`;
  store.addMessage({ role: "assistant", text: intro });
  void persistConversationLine("assistant", intro, null);

  const steps = Array.isArray(payload.actions) ? payload.actions : [];
  for (let i = 0; i < steps.length; i++) {
    const action = normalizeStep(steps[i]);
    if (action.plugin.startsWith("schedule_")) {
      const skip =
        "**Skipped** (schedule plugins cannot run inside a scheduled action list)";
      store.addMessage({ role: "assistant", text: skip });
      void persistConversationLine("assistant", skip, null);
      if (i + 1 < steps.length) await delay(delayMs);
      continue;
    }

    try {
      if (action.plugin === "run_workflow") {
        await emitMascotAnimation("excited_run");
      }

      const result = await invoke<unknown>("run_plugin_action", {
        action: {
          plugin: action.plugin,
          label: action.label,
          params: action.params,
        },
      });

      if (action.plugin === "run_workflow") {
        await emitMascotAnimation("none");
      }

      const pluginMsg = formatPluginResult(action.plugin, result);
      store.addMessage({ role: "assistant", text: pluginMsg });
      void persistConversationLine("assistant", pluginMsg, null);
    } catch (e) {
      if (action.plugin === "run_workflow") {
        await emitMascotAnimation("none");
      }
      const msg = e instanceof Error ? e.message : String(e);
      const failText = `**Scheduled action failed** (${action.plugin}): ${msg}`;
      store.addMessage({ role: "assistant", text: failText });
      void persistConversationLine("assistant", failText, null);
    }

    if (i + 1 < steps.length) await delay(delayMs);
  }
}
