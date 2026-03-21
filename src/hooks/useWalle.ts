import { invoke } from "@tauri-apps/api/core";
import { emitTo } from "@tauri-apps/api/event";

import {
  buildChatHistoryPayload,
  buildHistoryForFollowUp,
  TOOL_FOLLOWUP_USER_TEXT,
} from "../lib/chatHistory";
import type { WalleAction } from "../lib/actionParser";
import { parsePlan } from "../lib/actionParser";
import { formatPluginResult } from "../lib/pluginResultFormat";
import type { Emotion } from "../lib/emotion";
import { needsApproval } from "../lib/riskClassifier";
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

async function getAutoSummarizeEnabled(): Promise<boolean> {
  try {
    const raw = await invoke<string>("get_walle_config");
    const j = JSON.parse(raw) as { agent?: { auto_summarize_tool_output?: boolean } };
    return j.agent?.auto_summarize_tool_output !== false;
  } catch {
    return true;
  }
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
      /* malformed JSON */
    }
  } catch {
    /* network / API failure — keep raw tool line only */
  }
}

async function runPluginActionWithResult(action: WalleAction): Promise<boolean> {
  const store = useWalleStore.getState();
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
    return action.plugin === "shell" || action.plugin === "run_workflow";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    store.addMessage({
      role: "assistant",
      text: `**Action failed** (${action.plugin}): ${msg}`,
    });
    return false;
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
        await emitMascotEmotion("idle");
        return;
      }
      store.addMessage({ role: "assistant", text: plan.message });
      store.setEmotion(plan.emotion);
      await emitMascotEmotion(plan.emotion);

      const mode = store.mode;
      const pending: { action: WalleAction; id: string }[] = [];
      let ranSummarizableTool = false;
      for (const action of plan.actions) {
        const need = plan.requires_approval || needsApproval(action, mode);
        if (need) {
          pending.push({ action, id: crypto.randomUUID() });
        } else {
          if (await runPluginActionWithResult(action)) {
            ranSummarizableTool = true;
          }
        }
      }
      store.setPendingActions(pending);

      if (ranSummarizableTool && (await getAutoSummarizeEnabled())) {
        await appendToolFollowUpSummary();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      store.addMessage({ role: "assistant", text: `Error: ${msg}` });
      await emitMascotEmotion("sad");
    } finally {
      store.setThinking(false);
    }
  };

  const approveAction = async (id: string) => {
    const store = useWalleStore.getState();
    const item = store.pendingActions.find((p) => p.id === id);
    if (!item) return;
    store.setThinking(true);
    try {
      await emitMascotEmotion("thinking");
      const ranSummarizableTool = await runPluginActionWithResult(item.action);
      store.dequeueAction(id);

      if (ranSummarizableTool && (await getAutoSummarizeEnabled())) {
        await appendToolFollowUpSummary();
      } else {
        await emitMascotEmotion("happy");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      store.addMessage({ role: "assistant", text: `Action failed: ${msg}` });
      await emitMascotEmotion("sad");
      store.dequeueAction(id);
    } finally {
      store.setThinking(false);
    }
  };

  const denyAction = async (id: string) => {
    useWalleStore.getState().dequeueAction(id);
    await emitMascotEmotion("sad");
  };

  return {
    sendMessage,
    approveAction,
    denyAction,
  };
}
