import { motion } from "framer-motion";
import { useState } from "react";

import type { WalleAction } from "../../lib/actionParser";
import { effectiveRisk } from "../../lib/riskClassifier";
import type { UserLevel } from "../../lib/uiPreferences";

interface ActionCardProps {
  action: WalleAction;
  userLevel: UserLevel;
  onApprove: () => void;
  onDeny: () => void;
}

export default function ActionCard({ action, userLevel, onApprove, onDeny }: ActionCardProps) {
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

  const showDetails = userLevel !== "simple";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel mb-3 p-3 text-left"
      style={{ borderLeft: border }}
    >
      {userLevel !== "simple" && (
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
      )}

      {userLevel === "simple" && (
        <div className="flex items-center justify-end gap-2 mb-2">
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
      )}

      <p
        className="text-sm m-0 mb-2"
        style={{ fontSize: "14px", color: "var(--walle-text-primary)" }}
      >
        {action.label}
      </p>

      {showDetails && (
        <>
          {userLevel === "standard" && (
            <>
              <button
                type="button"
                className="text-[11px] mb-2"
                style={{ color: "var(--walle-text-secondary)" }}
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? "Hide" : "Show"} details
              </button>
              {expanded && (
                <code
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontFamily: "var(--walle-font-mono)",
                    color: "var(--walle-cyan)",
                    marginTop: "4px",
                    padding: "6px",
                    background: "rgba(0,0,0,0.3)",
                    borderRadius: "var(--walle-radius-sm)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {JSON.stringify(action.params, null, 2)}
                </code>
              )}
            </>
          )}
          {userLevel === "developer" && (
            <div style={{ marginTop: "6px" }}>
              <div
                className="text-[11px] mb-1"
                style={{ color: "var(--walle-text-muted)" }}
              >
                Command
              </div>
              <code
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontFamily: "var(--walle-font-mono)",
                  color: "var(--walle-cyan)",
                  padding: "6px",
                  background: "rgba(0,0,0,0.3)",
                  borderRadius: "var(--walle-radius-sm)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {JSON.stringify(action.params, null, 2)}
              </code>
            </div>
          )}
        </>
      )}

      {isDanger && (
        <input
          className="w-full mb-2 px-2 py-1 rounded text-sm mt-2"
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
      <div className="flex gap-2 justify-end mt-2">
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
