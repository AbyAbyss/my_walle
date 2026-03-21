import type { Workflow } from "../../store/walleStore";

interface WorkflowPillsProps {
  workflows: Workflow[];
  onRun: (name: string) => void;
}

export function WorkflowPills({ workflows, onRun }: WorkflowPillsProps) {
  if (!workflows.length) return null;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "6px",
        padding: "8px 12px",
        borderTop: "0.5px solid var(--walle-glass-border)",
      }}
    >
      {workflows.map((workflow) => (
        <button
          key={workflow.name}
          type="button"
          onClick={() => onRun(workflow.name)}
          style={{
            background: "var(--walle-cyan-dim)",
            border: "0.5px solid var(--walle-cyan)",
            borderRadius: "var(--walle-radius-pill)",
            color: "var(--walle-cyan)",
            fontSize: "11px",
            padding: "3px 10px",
            cursor: "pointer",
            fontFamily: "var(--walle-font-ui)",
          }}
        >
          {workflow.name}
        </button>
      ))}
    </div>
  );
}
