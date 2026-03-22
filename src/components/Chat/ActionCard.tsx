import { motion } from "framer-motion";
import { useState } from "react";

import type { WalleAction } from "../../lib/actionParser";
import { effectiveRisk } from "../../lib/riskClassifier";
import type { TrustScoreRow } from "../../lib/trustScore";
import type { UserLevel } from "../../lib/uiPreferences";

interface ActionCardProps {
  action: WalleAction;
  userLevel: UserLevel;
  trust: TrustScoreRow | null;
  onApprove: () => void;
  onDeny: () => void;
}

function formatTrustDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

export default function ActionCard({ action, userLevel, trust, onApprove, onDeny }: ActionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [confirm, setConfirm] = useState("");
  const risk = effectiveRisk(action);
  const isDanger = risk === "dangerous";
  const canAllow = !isDanger || confirm === "confirm";
  const trustScore = trust?.pinned === "whitelist" ? 100 : trust?.pinned === "blacklist" ? 0 : (trust?.score ?? 50);
  const trustRuns = trust?.totalRuns ?? 0;
  const nearAuto = risk === "moderate" && trustScore >= 75 && trustRuns >= 3;

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

      {userLevel !== "simple" && (
        <div
          className="mb-2 text-[11px] rounded px-2 py-1.5"
          style={{
            background: "rgba(0,0,0,0.25)",
            border: nearAuto ? "1px solid var(--walle-cyan)" : "1px solid transparent",
            color: "var(--walle-text-secondary)",
          }}
        >
          <div className="flex justify-between gap-2 mb-1">
            <span>Trust</span>
            <span style={{ color: "var(--walle-cyan)" }}>
              {Math.round(trustScore)}/100
              {trust?.pinned === "whitelist" ? " (pinned)" : trust?.pinned === "blacklist" ? " (blocked)" : ""}
            </span>
          </div>
          <div
            className="h-1.5 rounded overflow-hidden mb-1"
            style={{ background: "var(--walle-bg-3)" }}
          >
            <div
              className="h-full rounded transition-all"
              style={{
                width: `${Math.min(100, Math.max(0, trustScore))}%`,
                background:
                  trustScore >= 70
                    ? "var(--walle-cyan)"
                    : trustScore >= 40
                      ? "var(--walle-yellow)"
                      : "var(--walle-red)",
              }}
            />
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5" style={{ color: "var(--walle-text-muted)" }}>
            <span>Runs {trustRuns}</span>
            <span>Failures {trust?.failedRuns ?? 0}</span>
            {trust?.lastFailure && <span>Last fail {formatTrustDate(trust.lastFailure)}</span>}
          </div>
          {nearAuto && (
            <div className="mt-1" style={{ color: "var(--walle-cyan)" }}>
              Almost at auto-execute threshold for moderate risk
            </div>
          )}
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
