import { useEffect, useRef } from "react";

import type { WorkStep } from "../../store/walleStore";
import { useWalleStore } from "../../store/walleStore";

function StepLine({ step }: { step: WorkStep }) {
  const mono = { fontFamily: "var(--walle-font-mono)" as const };
  switch (step.kind) {
    case "work:thinking":
      return (
        <div className="flex gap-2 items-start text-[12px]">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 animate-pulse"
            style={{ background: "var(--walle-cyan)", boxShadow: "0 0 8px var(--walle-cyan)" }}
          />
          <span style={{ color: "var(--walle-text-secondary)" }}>{step.text}</span>
        </div>
      );
    case "work:iteration":
      return (
        <div
          className="text-[11px] font-semibold uppercase tracking-wide pt-1"
          style={{ color: "var(--walle-cyan)" }}
        >
          {step.text}
        </div>
      );
    case "work:action":
      return (
        <div className="text-[12px] pl-4" style={{ ...mono, color: "var(--walle-cyan)" }}>
          {step.text}
        </div>
      );
    case "work:success":
      return (
        <div className="text-[12px] pl-1" style={{ color: "var(--walle-green)" }}>
          ✓ {step.text}
        </div>
      );
    case "work:output":
      return (
        <div
          className="text-[11px] pl-4 whitespace-pre-wrap break-words max-h-32 overflow-y-auto"
          style={{ ...mono, color: "var(--walle-text-secondary)" }}
        >
          {step.text}
        </div>
      );
    case "work:error":
      return (
        <div className="text-[12px] pl-1" style={{ color: "var(--walle-red)" }}>
          ✕ {step.text}
        </div>
      );
    case "work:done":
      return (
        <div className="text-[12px] pt-1 mt-1 border-t" style={{ borderColor: "var(--walle-glass-border)", color: "var(--walle-text-primary)" }}>
          {step.text}
        </div>
      );
    default:
      return (
        <div className="text-[12px]" style={{ color: "var(--walle-text-secondary)" }}>
          {step.text}
        </div>
      );
  }
}

/**
 * Steps are only pushed when the backend has show_work enabled, so we show whenever
 * there are steps — not gated on React config snapshot (avoids a race before loadConfig).
 */
export default function ShowWorkPanel() {
  const workSteps = useWalleStore((s) => s.workSteps);
  const clearWorkSteps = useWalleStore((s) => s.clearWorkSteps);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [workSteps]);

  useEffect(() => {
    const last = workSteps[workSteps.length - 1];
    if (!last || (last.kind !== "work:done" && last.kind !== "work:error")) return;
    const t = window.setTimeout(() => clearWorkSteps(), 5000);
    return () => window.clearTimeout(t);
  }, [workSteps, clearWorkSteps]);

  if (workSteps.length === 0) return null;

  return (
    <div className="px-3 shrink-0 pb-2">
      <div
        className="rounded-xl overflow-hidden border"
        style={{
          borderColor: "var(--walle-glass-border)",
          background: "linear-gradient(180deg, rgba(12,14,22,0.95), rgba(8,10,18,0.92))",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <div
          className="px-3 py-2 text-[11px] uppercase tracking-wider border-b"
          style={{ borderColor: "var(--walle-glass-border)", color: "var(--walle-cyan)" }}
        >
          WALLE is working
        </div>
        <div ref={scrollRef} className="px-3 py-2 space-y-1.5 max-h-[200px] overflow-y-auto">
          {workSteps.map((s) => (
            <StepLine key={s.id} step={s} />
          ))}
        </div>
      </div>
    </div>
  );
}
