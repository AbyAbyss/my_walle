import { motion } from "framer-motion";
import { useState } from "react";

import type { WalleAction } from "../../lib/actionParser";
import { effectiveRisk } from "../../lib/riskClassifier";

interface ActionCardProps {
  action: WalleAction;
  onApprove: () => void;
  onDeny: () => void;
}

export default function ActionCard({ action, onApprove, onDeny }: ActionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [confirm, setConfirm] = useState("");
  const risk = effectiveRisk(action);
  const isDanger = risk === "dangerous";
  const canAllow = !isDanger || confirm === "confirm";

  const border =
    risk === "dangerous"
      ? "2px solid var(--walle-red)"
      : risk === "moderate"
        ? "2px solid var(--walle-yellow)"
        : "2px solid var(--walle-cyan)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel mb-3 p-3 text-left"
      style={{ borderLeft: border }}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-sm font-medium" style={{ color: "var(--walle-text-primary)" }}>
          {action.plugin}: {action.label}
        </span>
        <span
          className="text-[11px] uppercase px-2 py-0.5 rounded"
          style={{
            background: "var(--walle-bg-3)",
            color:
              risk === "dangerous"
                ? "var(--walle-red)"
                : risk === "moderate"
                  ? "var(--walle-yellow)"
                  : "var(--walle-cyan)",
          }}
        >
          {risk}
        </span>
      </div>
      <button
        type="button"
        className="text-[11px] mb-2"
        style={{ color: "var(--walle-text-secondary)" }}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? "Hide" : "Show"} raw params
      </button>
      {expanded && (
        <pre
          className="text-[11px] p-2 rounded mb-2 overflow-x-auto"
          style={{
            background: "var(--walle-bg-0)",
            color: "var(--walle-text-secondary)",
          }}
        >
          {JSON.stringify(action.params, null, 2)}
        </pre>
      )}
      {isDanger && (
        <input
          className="w-full mb-2 px-2 py-1 rounded text-sm"
          style={{
            background: "var(--walle-bg-2)",
            border: "1px solid var(--walle-glass-border)",
            color: "var(--walle-text-primary)",
          }}
          placeholder='Type "confirm" to enable Allow'
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      )}
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          className="px-3 py-1.5 rounded text-sm"
          style={{
            border: "1px solid var(--walle-red)",
            color: "var(--walle-red)",
            background: "transparent",
          }}
          onClick={onDeny}
        >
          Deny
        </button>
        <button
          type="button"
          disabled={!canAllow}
          className="px-3 py-1.5 rounded text-sm disabled:opacity-40"
          style={{
            border: "1px solid var(--walle-cyan)",
            color: "var(--walle-cyan)",
            background: "transparent",
          }}
          onClick={onApprove}
        >
          Allow
        </button>
      </div>
    </motion.div>
  );
}
