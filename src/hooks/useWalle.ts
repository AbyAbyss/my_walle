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
import { fetchTrustForAction } from "../lib/trustScore";
import { emitMascotAnimation } from "../lib/mascotBridge";
import { fetchWalleContextForLlm } from "../lib/fetchContext";
import {
  persistConversationLine,
} from "../lib/persistConversation";
import type { Workflow, WorkStepKind } from "../store/walleStore";
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

async function getShowWorkEnabled(): Promise<boolean> {
  try {
    const raw = await invoke<string>("get_walle_config");
    const j = JSON.parse(raw) as { show_work?: boolean };
    return j.show_work === true;
  } catch {
    return false;
  }
}

function shortenText(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function actionSummaryLine(action: WalleAction): string {
  if (action.plugin === "shell") {
    const cmd = String((action.params as Record<string, unknown>).command ?? "");
    return shortenText(cmd, 120);
  }
  if (action.plugin === "app_launch") {
    const app = String(
      (action.params as Record<string, unknown>).app ??
        (action.params as Record<string, unknown>).name ??
        "",
    );
    return app ? `Open ${app}` : action.label || "app_launch";
  }
  if (action.plugin === "schedule_create") {
    const n = String((action.params as Record<string, unknown>).name ?? "").trim();
    const cron = String(
      (action.params as Record<string, unknown>).cron_expr ??
        (action.params as Record<string, unknown>).cronExpr ??
        "",
    ).trim();
    if (n && cron) return `Schedule “${n}” (${cron})`;
    return action.label || "schedule_create";
  }
  if (action.plugin === "schedule_list") return "List schedules";
  if (action.plugin === "schedule_delete") {
    const id = (action.params as Record<string, unknown>).id;
    const name = String((action.params as Record<string, unknown>).name ?? "").trim();
    if (typeof id === "number") return `Delete schedule #${id}`;
    if (name) return `Delete “${name}”`;
    return action.label || "schedule_delete";
  }
  if (action.plugin === "external" || action.plugin === "ext_shell") {
    const pid = String(
      (action.params as Record<string, unknown>).plugin_id ??
        (action.params as Record<string, unknown>).pluginId ??
        "",
    ).trim();
    const cmd = String((action.params as Record<string, unknown>).command ?? "").trim();
    if (pid && cmd) return `External ${pid} · ${cmd}`;
    return action.label || "external";
  }
  if (
    action.plugin === "git_status" ||
    action.plugin === "git_log" ||
    action.plugin === "git_diff" ||
    action.plugin === "git_commit" ||
    action.plugin === "git_push" ||
    action.plugin === "git_checkout"
  ) {
    const rp = String(
      (action.params as Record<string, unknown>).repo_path ??
        (action.params as Record<string, unknown>).repoPath ??
        "",
    ).trim();
    const verb = action.plugin.replace(/^git_/, "");
    return rp ? `${verb} (${shortenText(rp, 72)})` : action.label || action.plugin;
  }
  return action.label || action.plugin;
}

function pushWork(showWork: boolean, kind: WorkStepKind, text: string, plugin?: string) {
  if (!showWork) return;
  useWalleStore.getState().addWorkStep({ kind, text, plugin });
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
    const ctx = await fetchWalleContextForLlm();
    const response = await invoke<WalleChatResponse>("walle_chat", {
      payload: {
        userText: TOOL_FOLLOWUP_USER_TEXT,
        history,
        activeWindowTitle: ctx.activeWindowTitle,
        clipboardPreview: ctx.clipboardPreview,
        gitRepoPath: ctx.gitRepoPath,
      },
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
      void persistConversationLine("assistant", plan.message, plan.emotion);
      store.setEmotion(plan.emotion);
      await emitMascotEmotion(plan.emotion);
    } catch {
      await emitMascotAnimation("confused");
    }
  } catch {
    /* network / API failure — keep raw tool line only */
  }
}

async function runPluginActionWithResult(action: WalleAction, showWork: boolean): Promise<boolean> {
  const store = useWalleStore.getState();
  const isWorkflow = action.plugin === "run_workflow";
  try {
    if (action.plugin === "save_workflow") {
      pushWork(showWork, "work:action", `↳ ${actionSummaryLine(action)}`, action.plugin);
      const workflow = workflowFromAction(action);
      await invoke("save_workflow_to_config", { workflow });
      store.addWorkflow(workflow);
      const wfMsg = formatPluginResult(action.plugin, { ok: true });
      store.addMessage({
        role: "assistant",
        text: wfMsg,
      });
      void persistConversationLine("assistant", wfMsg, null);
      pushWork(showWork, "work:success", "Workflow saved", action.plugin);
      return false;
    }

    pushWork(showWork, "work:action", `↳ ${actionSummaryLine(action)}`, action.plugin);

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
    if (showWork) {
      if (action.plugin === "shell" && result && typeof result === "object") {
        const o = result as Record<string, unknown>;
        const out = [String(o.stdout ?? ""), String(o.stderr ?? "")].filter(Boolean).join("\n").trim();
        if (out) {
          pushWork(showWork, "work:output", shortenText(out, 4000), action.plugin);
        }
      } else if (
        (action.plugin === "external" || action.plugin === "ext_shell") &&
        result &&
        typeof result === "object"
      ) {
        const o = result as Record<string, unknown>;
        const out = [String(o.stdout ?? ""), String(o.stderr ?? "")].filter(Boolean).join("\n").trim();
        if (out) {
          pushWork(showWork, "work:output", shortenText(out, 4000), action.plugin);
        }
      } else if (
        action.plugin.startsWith("git_") &&
        result &&
        typeof result === "object"
      ) {
        const o = result as Record<string, unknown>;
        const out = String(o.stdout ?? "").trim();
        if (out) {
          pushWork(showWork, "work:output", shortenText(out, 4000), action.plugin);
        }
      } else if (action.plugin === "run_workflow" && result && typeof result === "object") {
        const o = result as Record<string, unknown>;
        const summary = String(o.summary ?? "");
        if (summary.trim()) {
          pushWork(showWork, "work:output", shortenText(summary, 4000), action.plugin);
        }
      }
      pushWork(
        showWork,
        "work:success",
        shortenText(action.label || "Completed", 120),
        action.plugin,
      );
    }

    const pluginMsg = formatPluginResult(action.plugin, result);
    store.addMessage({
      role: "assistant",
      text: pluginMsg,
    });
    void persistConversationLine("assistant", pluginMsg, null);

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
    pushWork(showWork, "work:error", msg, action.plugin);
    const failText = `**Action failed** (${action.plugin}): ${msg}`;
    store.addMessage({
      role: "assistant",
      text: failText,
    });
    void persistConversationLine("assistant", failText, null);
    return false;
  }
}

async function executeActionPlan(plan: WallePlan, mode: "auto" | "manual_review") {
  const store = useWalleStore.getState();
  const actions = plan.actions;
  if (!actions.length) {
    store.clearWorkSteps();
    return;
  }

  const showWork = await getShowWorkEnabled();
  store.clearWorkSteps();
  if (showWork) {
    pushWork(
      showWork,
      "work:thinking",
      shortenText(plan.message || "Working on your request…", 200),
    );
  }

  const delayMs = await getActionDelayMs();
  let autoBatchSummarize = false;

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const trust = await fetchTrustForAction(action);
    const needApproval = plan.requires_approval || needsApproval(action, mode, trust);

    if (needApproval) {
      if (autoBatchSummarize && (await getAutoSummarizeEnabled())) {
        await appendToolFollowUpSummary();
        autoBatchSummarize = false;
      }
      await emitMascotEmotion("thinking");
      const approved = await waitForUserApproval(action);
      if (!approved) {
        const skipText = `Skipped: ${action.label}`;
        pushWork(showWork, "work:output", `Skipped: ${action.label}`, action.plugin);
        store.addMessage({
          role: "assistant",
          text: skipText,
        });
        void persistConversationLine("assistant", skipText, null);
        await emitMascotEmotion("sad");
        if (i < actions.length - 1) await delay(delayMs);
        continue;
      }
    }

    // Match prior approveAction: show thinking while executing after Allow
    if (needApproval) {
      await emitMascotEmotion("thinking");
    }

    const ranSummarizable = await runPluginActionWithResult(action, showWork);

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

  if (showWork && actions.length) {
    pushWork(showWork, "work:done", "All done.");
  }
}

export function useWalle() {
  const sendMessage = async (text: string) => {
    const store = useWalleStore.getState();
    store.addMessage({ role: "user", text });
    void persistConversationLine("user", text, null);
    store.setThinking(true);
    try {
      await emitMascotEmotion("thinking");
      const history = buildChatHistoryPayload(useWalleStore.getState().messages);
      const ctx = await fetchWalleContextForLlm();
      const response = await invoke<WalleChatResponse>("walle_chat", {
        payload: {
          userText: text,
          history,
          activeWindowTitle: ctx.activeWindowTitle,
          clipboardPreview: ctx.clipboardPreview,
          gitRepoPath: ctx.gitRepoPath,
        },
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
        void persistConversationLine("assistant", response.raw, null);
        await emitMascotAnimation("confused");
        await emitMascotEmotion("idle");
        return;
      }
      store.addMessage({ role: "assistant", text: plan.message });
      void persistConversationLine("assistant", plan.message, plan.emotion);
      store.setEmotion(plan.emotion);
      await emitMascotEmotion(plan.emotion);

      const mode = store.mode;
      await executeActionPlan(plan, mode);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const errLine = `Error: ${msg}`;
      store.addMessage({ role: "assistant", text: errLine });
      void persistConversationLine("assistant", errLine, null);
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
