import { invoke } from "@tauri-apps/api/core";
import { emitTo } from "@tauri-apps/api/event";

import {
  buildChatHistoryPayload,
  buildHistoryForFollowUp,
  TOOL_FOLLOWUP_USER_TEXT,
} from "../lib/chatHistory";
import type { WalleAction, WallePlan } from "../lib/actionParser";
import { parsePlan } from "../lib/actionParser";
import { formatPluginResult } from "../lib/pluginResultFormat";
import type { Emotion } from "../lib/emotion";
import { needsApproval } from "../lib/riskClassifier";
import { emitMascotAnimation } from "../lib/mascotBridge";
import type { Workflow } from "../store/walleStore";
import { useWalleStore } from "../store/walleStore";

interface WalleChatResponse {
  raw: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
}

function normalizeWorkflowStep(step: unknown): WalleAction {
  const raw = step as Record<string, unknown>;
  return {
    plugin: String(raw.plugin ?? "notify"),
    label: String(raw.label ?? ""),
    risk: raw.risk === "medium" || raw.risk === "high" ? raw.risk : "low",
    params: (raw.params as Record<string, unknown>) ?? {},
  };
}

function workflowFromAction(action: WalleAction): Workflow {
  const params = action.params as Record<string, unknown>;
  const name = String(params.name ?? "").trim();
  if (!name) {
    throw new Error("workflow name required");
  }

  const steps = Array.isArray(params.steps)
    ? params.steps.map((step) => normalizeWorkflowStep(step))
    : [];
  if (!steps.length) {
    throw new Error("workflow steps required");
  }

  return {
    name,
    description:
      typeof params.description === "string" && params.description.trim()
        ? params.description.trim()
        : undefined,
    steps,
    created_at: new Date().toISOString(),
  };
}

async function emitMascotEmotion(emotion: Emotion) {
  await emitTo("mascot", "walle/emotion", { emotion });
}

function workflowSummaryOk(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;
  const o = result as Record<string, unknown>;
  if (o.ok !== true) return false;
  const summary = String(o.summary ?? "");
  return summary.length > 0 && !summary.includes("FAILED");
}

async function getAutoSummarizeEnabled(): Promise<boolean> {
  try {
    const raw = await invoke<string>("get_walle_config");
    const j = JSON.parse(raw) as { agent?: { auto_summarize_tool_output?: boolean } };
    return j.agent?.auto_summarize_tool_output !== false;
  } catch {
    return true;
  }
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

function waitForUserApproval(action: WalleAction): Promise<boolean> {
  return new Promise((resolve) => {
    useWalleStore.getState().startApprovalFlow(action, resolve);
  });
}

/** Second LLM turn after shell/workflow output; does not execute actions from the response. */
async function appendToolFollowUpSummary() {
  const store = useWalleStore.getState();
  try {
    const history = buildHistoryForFollowUp(useWalleStore.getState().messages);
    const response = await invoke<WalleChatResponse>("walle_chat", {
      payload: { userText: TOOL_FOLLOWUP_USER_TEXT, history },
    });
    store.setLastUsedModel(response.model);
    store.setLastUsage({
      model: response.model,
      inputTokens: response.input_tokens ?? 0,
      outputTokens: response.output_tokens ?? 0,
    });
    try {
      const plan = parsePlan(response.raw);
      store.addMessage({ role: "assistant", text: plan.message });
      store.setEmotion(plan.emotion);
      await emitMascotEmotion(plan.emotion);
    } catch {
      await emitMascotAnimation("confused");
    }
  } catch {
    /* network / API failure — keep raw tool line only */
  }
}

async function runPluginActionWithResult(action: WalleAction): Promise<boolean> {
  const store = useWalleStore.getState();
  const isWorkflow = action.plugin === "run_workflow";
  try {
    if (action.plugin === "save_workflow") {
      const workflow = workflowFromAction(action);
      await invoke("save_workflow_to_config", { workflow });
      store.addWorkflow(workflow);
      store.addMessage({
        role: "assistant",
        text: formatPluginResult(action.plugin, { ok: true }),
      });
      return false;
    }

    if (isWorkflow) {
      await emitMascotAnimation("excited_run");
    }

    const result = await invoke<unknown>("run_plugin_action", {
      action: {
        plugin: action.plugin,
        label: action.label,
        params: action.params,
      },
    });
    store.addMessage({
      role: "assistant",
      text: formatPluginResult(action.plugin, result),
    });

    if (isWorkflow) {
      await emitMascotAnimation("none");
      if (workflowSummaryOk(result)) {
        await emitMascotAnimation("dance");
      }
    } else {
      await emitMascotAnimation("thumbs_up");
    }

    return action.plugin === "shell" || action.plugin === "run_workflow";
  } catch (e) {
    if (isWorkflow) {
      await emitMascotAnimation("none");
    }
    const msg = e instanceof Error ? e.message : String(e);
    store.addMessage({
      role: "assistant",
      text: `**Action failed** (${action.plugin}): ${msg}`,
    });
    return false;
  }
}

async function executeActionPlan(plan: WallePlan, mode: "auto" | "manual_review") {
  const store = useWalleStore.getState();
  const actions = plan.actions;
  if (!actions.length) return;

  const delayMs = await getActionDelayMs();
  let autoBatchSummarize = false;

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const needApproval = plan.requires_approval || needsApproval(action, mode);

    if (needApproval) {
      if (autoBatchSummarize && (await getAutoSummarizeEnabled())) {
        await appendToolFollowUpSummary();
        autoBatchSummarize = false;
      }
      await emitMascotEmotion("thinking");
      const approved = await waitForUserApproval(action);
      if (!approved) {
        store.addMessage({
          role: "assistant",
          text: `Skipped: ${action.label}`,
        });
        await emitMascotEmotion("sad");
        if (i < actions.length - 1) await delay(delayMs);
        continue;
      }
    }

    // Match prior approveAction: show thinking while executing after Allow
    if (needApproval) {
      await emitMascotEmotion("thinking");
    }

    const ranSummarizable = await runPluginActionWithResult(action);

    if (needApproval) {
      if (ranSummarizable && (await getAutoSummarizeEnabled())) {
        await appendToolFollowUpSummary();
      } else {
        await emitMascotEmotion("happy");
      }
    } else if (ranSummarizable) {
      autoBatchSummarize = true;
    }

    if (i < actions.length - 1) await delay(delayMs);
  }

  if (autoBatchSummarize && (await getAutoSummarizeEnabled())) {
    await appendToolFollowUpSummary();
  }
}

export function useWalle() {
  const sendMessage = async (text: string) => {
    const store = useWalleStore.getState();
    store.addMessage({ role: "user", text });
    store.setThinking(true);
    try {
      await emitMascotEmotion("thinking");
      const history = buildChatHistoryPayload(useWalleStore.getState().messages);
      const response = await invoke<WalleChatResponse>("walle_chat", {
        payload: { userText: text, history },
      });
      store.setLastUsedModel(response.model);
      store.setLastUsage({
        model: response.model,
        inputTokens: response.input_tokens ?? 0,
        outputTokens: response.output_tokens ?? 0,
      });
      let plan;
      try {
        plan = parsePlan(response.raw);
      } catch {
        useWalleStore.getState().addMessage({ role: "assistant", text: response.raw });
        await emitMascotAnimation("confused");
        await emitMascotEmotion("idle");
        return;
      }
      store.addMessage({ role: "assistant", text: plan.message });
      store.setEmotion(plan.emotion);
      await emitMascotEmotion(plan.emotion);

      const mode = store.mode;
      await executeActionPlan(plan, mode);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      store.addMessage({ role: "assistant", text: `Error: ${msg}` });
      await emitMascotEmotion("sad");
    } finally {
      useWalleStore.getState().clearApprovalUi();
      store.setThinking(false);
    }
  };

  return {
    sendMessage,
  };
}
