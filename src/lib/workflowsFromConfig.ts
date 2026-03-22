import type { Workflow } from "../store/walleStore";

export function withStepUiIds(steps: Workflow["steps"]): Workflow["steps"] {
  return steps.map((s) => {
    const p = { ...(s.params as Record<string, unknown>) };
    if (!p._uiId) p._uiId = crypto.randomUUID();
    return { ...s, params: p };
  });
}

export interface WorkflowConfigItem {
  name: string;
  description?: string;
  steps?: unknown[];
  created_at?: string;
}

/** Normalize workflow entries from `get_walle_config` JSON (same rules as chat). */
export function normalizeWorkflowsFromConfig(config: {
  workflows?: WorkflowConfigItem[];
}): Workflow[] {
  return (config.workflows ?? []).map((workflow) => ({
    name: workflow.name,
    description: workflow.description,
    steps: Array.isArray(workflow.steps)
      ? withStepUiIds(workflow.steps as Workflow["steps"])
      : [],
    created_at: workflow.created_at ?? new Date().toISOString(),
  }));
}
