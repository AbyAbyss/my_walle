import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useState } from "react";

import { InlineConfirmDialog } from "./InlineConfirmDialog";
import type { WalleAction } from "../../lib/actionParser";
import { effectiveRisk } from "../../lib/riskClassifier";
import type { Workflow } from "../../store/walleStore";

const sectionStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(22,24,33,0.92), rgba(14,16,24,0.9))",
  border: "1px solid var(--walle-glass-border)",
  borderRadius: "14px",
  padding: "16px",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
};

const PLUGIN_OPTIONS = [
  { value: "shell", label: "Shell" },
  { value: "app_launch", label: "App launch" },
  { value: "notify", label: "Notify" },
  { value: "git_status", label: "Git status" },
  { value: "git_log", label: "Git log" },
  { value: "git_diff", label: "Git diff" },
  { value: "git_commit", label: "Git commit" },
  { value: "git_push", label: "Git push" },
  { value: "git_checkout", label: "Git checkout" },
  { value: "external", label: "External (manifest)" },
] as const;

function riskForAction(a: WalleAction): string {
  const r = effectiveRisk(a);
  if (r === "dangerous") return "high";
  if (r === "moderate") return "medium";
  return "low";
}

function emptyStep(plugin = "notify"): WalleAction {
  return {
    plugin,
    label: "New step",
    risk: "low",
    params: { _uiId: crypto.randomUUID() },
  };
}

function SortableStep({
  id,
  step,
  index,
  onChange,
  onRemove,
}: {
  id: string;
  step: WalleAction;
  index: number;
  onChange: (next: WalleAction) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  };
  const p = step.params as Record<string, unknown>;
  const risk = riskForAction(step);

  return (
    <div
      ref={setNodeRef}
      className="rounded-xl p-3 mb-2"
      style={{
        ...style,
        background: "rgba(10,10,15,0.72)",
        border: "1px solid var(--walle-glass-border)",
      }}
    >
      <div className="flex gap-2 items-start">
        <button
          type="button"
          className="shrink-0 mt-1 px-1 cursor-grab text-[14px]"
          style={{ color: "var(--walle-text-muted)" }}
          {...attributes}
          {...listeners}
        >
          ⣿
        </button>
        <div className="flex-1 min-w-0 grid gap-2">
          <div className="flex flex-wrap gap-2 items-center">
            <span
              className="text-[11px] px-1.5 py-0.5 rounded"
              style={{
                background: "rgba(0,212,255,0.1)",
                color: "var(--walle-cyan)",
                fontFamily: "var(--walle-font-mono)",
              }}
            >
              {index + 1}
            </span>
            <select
              className="text-[12px] rounded-lg px-2 py-1 max-w-[160px]"
              style={{
                background: "rgba(10,10,15,0.9)",
                border: "1px solid var(--walle-glass-border)",
                color: "var(--walle-text-primary)",
              }}
              value={step.plugin}
              onChange={(e) => {
                const plugin = e.target.value;
                const uid = (p._uiId as string) || crypto.randomUUID();
                const base = emptyStep(plugin);
                onChange({ ...base, label: step.label, params: { ...base.params, _uiId: uid } });
              }}
            >
              {PLUGIN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded uppercase"
              style={{
                background:
                  risk === "high"
                    ? "rgba(255,80,80,0.15)"
                    : risk === "medium"
                      ? "rgba(255,179,71,0.12)"
                      : "rgba(0,255,136,0.1)",
                color:
                  risk === "high"
                    ? "var(--walle-red, #f66)"
                    : risk === "medium"
                      ? "var(--walle-amber)"
                      : "var(--walle-green)",
              }}
            >
              {risk}
            </span>
          </div>
          <input
            type="text"
            className="text-[12px] w-full rounded-lg px-2 py-1"
            style={{
              background: "rgba(10,10,15,0.9)",
              border: "1px solid var(--walle-glass-border)",
              color: "var(--walle-text-primary)",
            }}
            placeholder="Label"
            value={step.label}
            onChange={(e) => onChange({ ...step, label: e.target.value })}
          />
          {step.plugin === "shell" && (
            <textarea
              className="text-[12px] w-full rounded-lg px-2 py-1 font-mono min-h-[56px]"
              style={{
                background: "rgba(10,10,15,0.9)",
                border: "1px solid var(--walle-glass-border)",
                color: "var(--walle-text-primary)",
              }}
              placeholder="PowerShell command"
              value={String(p.command ?? "")}
              onChange={(e) =>
                onChange({
                  ...step,
                  params: { ...p, command: e.target.value },
                  risk: step.risk,
                })
              }
            />
          )}
          {step.plugin === "app_launch" && (
            <input
              type="text"
              className="text-[12px] w-full rounded-lg px-2 py-1"
              style={{
                background: "rgba(10,10,15,0.9)",
                border: "1px solid var(--walle-glass-border)",
                color: "var(--walle-text-primary)",
              }}
              placeholder="App display name"
              value={String(p.app ?? "")}
              onChange={(e) =>
                onChange({ ...step, params: { ...p, app: e.target.value }, risk: step.risk })
              }
            />
          )}
          {step.plugin === "notify" && (
            <div className="grid gap-1">
              <input
                type="text"
                placeholder="Title"
                className="text-[12px] rounded-lg px-2 py-1"
                style={{
                  background: "rgba(10,10,15,0.9)",
                  border: "1px solid var(--walle-glass-border)",
                  color: "var(--walle-text-primary)",
                }}
                value={String(p.title ?? "")}
                onChange={(e) =>
                  onChange({ ...step, params: { ...p, title: e.target.value }, risk: step.risk })
                }
              />
              <input
                type="text"
                placeholder="Body"
                className="text-[12px] rounded-lg px-2 py-1"
                style={{
                  background: "rgba(10,10,15,0.9)",
                  border: "1px solid var(--walle-glass-border)",
                  color: "var(--walle-text-primary)",
                }}
                value={String(p.body ?? "")}
                onChange={(e) =>
                  onChange({ ...step, params: { ...p, body: e.target.value }, risk: step.risk })
                }
              />
            </div>
          )}
          {step.plugin.startsWith("git_") && (
            <div className="grid gap-1">
              <input
                type="text"
                placeholder="repo_path (absolute)"
                className="text-[12px] rounded-lg px-2 py-1 font-mono"
                style={{
                  background: "rgba(10,10,15,0.9)",
                  border: "1px solid var(--walle-glass-border)",
                  color: "var(--walle-text-primary)",
                }}
                value={String(p.repo_path ?? p.repoPath ?? "")}
                onChange={(e) =>
                  onChange({
                    ...step,
                    params: { ...p, repo_path: e.target.value },
                    risk: step.risk,
                  })
                }
              />
              {(step.plugin === "git_log" || step.plugin === "git_diff") && (
                <input
                  type="text"
                  placeholder={step.plugin === "git_log" ? "n (optional)" : "file (optional)"}
                  className="text-[12px] rounded-lg px-2 py-1"
                  style={{
                    background: "rgba(10,10,15,0.9)",
                    border: "1px solid var(--walle-glass-border)",
                    color: "var(--walle-text-primary)",
                  }}
                  value={String(
                    (step.plugin === "git_log" ? p.n : p.file) ?? "",
                  )}
                  onChange={(e) => {
                    const key = step.plugin === "git_log" ? "n" : "file";
                    const val = step.plugin === "git_log" ? Number(e.target.value) || 10 : e.target.value;
                    onChange({
                      ...step,
                      params: { ...p, [key]: val },
                      risk: step.risk,
                    });
                  }}
                />
              )}
              {step.plugin === "git_commit" && (
                <input
                  type="text"
                  placeholder="commit message"
                  className="text-[12px] rounded-lg px-2 py-1"
                  style={{
                    background: "rgba(10,10,15,0.9)",
                    border: "1px solid var(--walle-glass-border)",
                    color: "var(--walle-text-primary)",
                  }}
                  value={String(p.message ?? "")}
                  onChange={(e) =>
                    onChange({
                      ...step,
                      params: { ...p, message: e.target.value },
                      risk: step.risk,
                    })
                  }
                />
              )}
              {(step.plugin === "git_push" || step.plugin === "git_checkout") && (
                <>
                  <input
                    type="text"
                    placeholder="remote (push, optional)"
                    className="text-[12px] rounded-lg px-2 py-1"
                    style={{
                      background: "rgba(10,10,15,0.9)",
                      border: "1px solid var(--walle-glass-border)",
                      color: "var(--walle-text-primary)",
                    }}
                    value={String(p.remote ?? "")}
                    onChange={(e) =>
                      onChange({
                        ...step,
                        params: { ...p, remote: e.target.value },
                        risk: step.risk,
                      })
                    }
                  />
                  <input
                    type="text"
                    placeholder="branch"
                    className="text-[12px] rounded-lg px-2 py-1"
                    style={{
                      background: "rgba(10,10,15,0.9)",
                      border: "1px solid var(--walle-glass-border)",
                      color: "var(--walle-text-primary)",
                    }}
                    value={String(p.branch ?? "")}
                    onChange={(e) =>
                      onChange({
                        ...step,
                        params: { ...p, branch: e.target.value },
                        risk: step.risk,
                      })
                    }
                  />
                </>
              )}
            </div>
          )}
          {step.plugin === "external" && (
            <div className="grid gap-1">
              <input
                type="text"
                placeholder="plugin_id (manifest folder)"
                className="text-[12px] rounded-lg px-2 py-1 font-mono"
                style={{
                  background: "rgba(10,10,15,0.9)",
                  border: "1px solid var(--walle-glass-border)",
                  color: "var(--walle-text-primary)",
                }}
                value={String(p.plugin_id ?? p.pluginId ?? "")}
                onChange={(e) =>
                  onChange({
                    ...step,
                    params: { ...p, plugin_id: e.target.value },
                    risk: step.risk,
                  })
                }
              />
              <input
                type="text"
                placeholder="command name from manifest"
                className="text-[12px] rounded-lg px-2 py-1"
                style={{
                  background: "rgba(10,10,15,0.9)",
                  border: "1px solid var(--walle-glass-border)",
                  color: "var(--walle-text-primary)",
                }}
                value={String(p.command ?? "")}
                onChange={(e) =>
                  onChange({
                    ...step,
                    params: { ...p, command: e.target.value },
                    risk: step.risk,
                  })
                }
              />
              <textarea
                className="text-[11px] w-full rounded-lg px-2 py-1 font-mono min-h-[48px]"
                style={{
                  background: "rgba(10,10,15,0.9)",
                  border: "1px solid var(--walle-glass-border)",
                  color: "var(--walle-text-muted)",
                }}
                placeholder='Optional JSON for template vars, e.g. {"target":"world"}'
                value={String(p.extra_json ?? "")}
                onChange={(e) =>
                  onChange({
                    ...step,
                    params: { ...p, extra_json: e.target.value },
                    risk: step.risk,
                  })
                }
              />
            </div>
          )}
        </div>
        <button
          type="button"
          className="shrink-0 text-[12px] px-2 py-1"
          style={{ color: "var(--walle-text-muted)" }}
          onClick={onRemove}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function workflowsToJsonPayload(workflows: Workflow[]): unknown[] {
  return workflows.map((w) => ({
    name: w.name,
    description: w.description ?? "",
    steps: w.steps.map((s) => {
      const params = { ...(s.params as Record<string, unknown>) };
      delete params._uiId;
      if (s.plugin === "external") {
        const raw = params.extra_json;
        delete params.extra_json;
        if (typeof raw === "string" && raw.trim()) {
          try {
            const j = JSON.parse(raw.trim()) as Record<string, unknown>;
            for (const [k, v] of Object.entries(j)) {
              params[k] = v;
            }
          } catch {
            /* keep params without broken JSON */
          }
        }
      } else {
        delete params.extra_json;
      }
      return {
        plugin: s.plugin,
        label: s.label,
        risk: s.risk,
        params,
      };
    }),
    created_at: w.created_at,
  }));
}

interface WorkflowEditorProps {
  workflows: Workflow[];
  onWorkflowsChange: (next: Workflow[]) => void;
  onRun: (name: string) => void;
  onStatus: (msg: string) => void;
  /** Called after workflows are persisted to config (e.g. notify chat webview). */
  onAfterPersist?: () => void;
}

export default function WorkflowEditor({
  workflows,
  onWorkflowsChange,
  onRun,
  onStatus,
  onAfterPersist,
}: WorkflowEditorProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const persist = useCallback(
    async (next: Workflow[]) => {
      try {
        await invoke("save_workflows_to_config", {
          workflows: workflowsToJsonPayload(next),
        });
        onWorkflowsChange(next);
        onStatus("Workflows saved.");
        onAfterPersist?.();
      } catch (e) {
        onStatus(String(e));
      }
    },
    [onWorkflowsChange, onStatus, onAfterPersist],
  );

  const updateWorkflow = (idx: number, wf: Workflow) => {
    const next = workflows.map((w, i) => (i === idx ? wf : w));
    void persist(next);
  };

  const confirmRemoveWorkflow = () => {
    if (deleteIdx === null) return;
    const idx = deleteIdx;
    setDeleteIdx(null);
    const next = workflows.filter((_, i) => i !== idx);
    void persist(next);
    setOpenIdx(null);
  };

  const requestRemoveWorkflow = (idx: number) => {
    setDeleteIdx(idx);
  };

  const addWorkflow = () => {
    const name = newName.trim();
    if (!name) {
      onStatus("Enter a workflow name.");
      return;
    }
    if (workflows.some((w) => w.name.toLowerCase() === name.toLowerCase())) {
      onStatus("A workflow with that name already exists.");
      return;
    }
    const wf: Workflow = {
      name,
      description: "",
      steps: [emptyStep("notify")],
      created_at: new Date().toISOString(),
    };
    void persist([...workflows, wf]);
    setNewName("");
    setCreating(false);
    setOpenIdx(workflows.length);
  };

  const onDragEnd = (event: DragEndEvent, wfIdx: number) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const wf = workflows[wfIdx];
    const oldIndex = Number(active.id);
    const newIndex = Number(over.id);
    if (Number.isNaN(oldIndex) || Number.isNaN(newIndex)) return;
    const steps = arrayMove(wf.steps, oldIndex, newIndex).map((s) => ({
      ...s,
      risk: s.risk,
    }));
    updateWorkflow(wfIdx, { ...wf, steps });
  };

  return (
    <div className="grid gap-4" style={{ position: "relative" }}>
      {deleteIdx !== null && workflows[deleteIdx] && (
        <InlineConfirmDialog
          message={`Delete workflow “${workflows[deleteIdx].name}”?`}
          onConfirm={() => void confirmRemoveWorkflow()}
          onCancel={() => setDeleteIdx(null)}
        />
      )}
      <section style={sectionStyle}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div
            className="text-[10px] uppercase tracking-[0.22em]"
            style={{ color: "var(--walle-cyan)" }}
          >
            Workflows
          </div>
          <button
            type="button"
            className="text-[12px] px-3 py-1.5 rounded-xl font-medium"
            style={{
              border: "1px solid rgba(0,212,255,0.4)",
              color: "var(--walle-cyan)",
              background: "linear-gradient(180deg, rgba(0,212,255,0.15), rgba(0,212,255,0.05))",
            }}
            onClick={() => setCreating((c) => !c)}
          >
            {creating ? "Cancel" : "+ New workflow"}
          </button>
        </div>
        {creating && (
          <div className="flex flex-wrap gap-2 mb-3">
            <input
              type="text"
              placeholder="Workflow name"
              className="text-[13px] flex-1 min-w-[160px] rounded-lg px-3 py-2"
              style={{
                background: "rgba(10,10,15,0.9)",
                border: "1px solid var(--walle-glass-border)",
                color: "var(--walle-text-primary)",
              }}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button
              type="button"
              className="text-[12px] px-3 py-2 rounded-xl"
              style={{
                border: "1px solid var(--walle-glass-border)",
                color: "var(--walle-text-secondary)",
              }}
              onClick={() => void addWorkflow()}
            >
              Create
            </button>
          </div>
        )}

        {workflows.length === 0 ? (
          <div className="text-[12px]" style={{ color: "var(--walle-text-muted)" }}>
            No workflows yet. Create one here or ask WALLE in chat.
          </div>
        ) : (
          <ul className="grid gap-2" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {workflows.map((wf, wfIdx) => {
              const expanded = openIdx === wfIdx;
              return (
                <li
                  key={`${wf.name}-${wfIdx}`}
                  className="rounded-xl overflow-hidden"
                  style={{
                    border: "1px solid var(--walle-glass-border)",
                    background: "rgba(10,10,15,0.55)",
                  }}
                >
                  <div
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                    style={{ background: "rgba(0,0,0,0.2)" }}
                  >
                    <button
                      type="button"
                      className="text-left text-[13px] font-medium flex-1 min-w-0"
                      style={{ color: "var(--walle-text-primary)" }}
                      onClick={() => setOpenIdx(expanded ? null : wfIdx)}
                    >
                      {expanded ? "▼" : "▶"} {wf.name}
                    </button>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        className="text-[11px] px-2 py-1 rounded-lg"
                        style={{ color: "var(--walle-cyan)" }}
                        onClick={() => onRun(wf.name)}
                      >
                        Run
                      </button>
                      <button
                        type="button"
                        className="text-[11px] px-2 py-1 rounded-lg"
                        style={{ color: "var(--walle-text-muted)" }}
                        onClick={() => requestRemoveWorkflow(wfIdx)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {expanded && (
                    <div className="p-3 pt-1">
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(e) => onDragEnd(e, wfIdx)}
                      >
                        <SortableContext
                          items={wf.steps.map((_, i) => String(i))}
                          strategy={verticalListSortingStrategy}
                        >
                          {wf.steps.map((step, si) => (
                            <SortableStep
                              key={String((step.params as Record<string, unknown>)._uiId ?? `${wfIdx}-${si}`)}
                              id={String(si)}
                              index={si}
                              step={step}
                              onChange={(next) => {
                                const steps = wf.steps.map((s, j) => (j === si ? next : s));
                                updateWorkflow(wfIdx, { ...wf, steps });
                              }}
                              onRemove={() => {
                                const steps = wf.steps.filter((_, j) => j !== si);
                                updateWorkflow(wfIdx, { ...wf, steps });
                              }}
                            />
                          ))}
                        </SortableContext>
                      </DndContext>
                      <button
                        type="button"
                        className="text-[12px] mt-2 px-3 py-1.5 rounded-xl"
                        style={{
                          border: "1px solid var(--walle-glass-border)",
                          color: "var(--walle-text-secondary)",
                        }}
                        onClick={() => {
                          const steps = [...wf.steps, emptyStep("shell")];
                          updateWorkflow(wfIdx, { ...wf, steps });
                        }}
                      >
                        + Add step
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
