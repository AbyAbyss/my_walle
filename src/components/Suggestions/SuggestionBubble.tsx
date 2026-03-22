import { motion } from "framer-motion";

import type { Pattern } from "../../lib/patternEngine";

interface SuggestionBubbleProps {
  pattern: Pattern;
  onAccept: () => void;
  onDismiss: () => void;
}

export default function SuggestionBubble({ pattern, onAccept, onDismiss }: SuggestionBubbleProps) {
  const isProactive = pattern.source === "proactive";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4 }}
      className="glass-panel p-3 text-left max-w-[min(320px,calc(100vw-48px))]"
      style={{
        borderLeft: "3px solid var(--walle-amber)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
      }}
    >
      <div
        className="text-[11px] uppercase tracking-wide mb-1"
        style={{ color: "var(--walle-text-muted)" }}
      >
        {isProactive ? "Heads up" : "WALLE noticed"}
      </div>
      <p className="text-sm m-0 mb-2" style={{ color: "var(--walle-text-primary)" }}>
        {pattern.description}
      </p>
      <div className="flex flex-wrap gap-2 justify-end">
        <button
          type="button"
          className="px-3 py-1.5 rounded text-sm"
          style={{
            border: "1px solid var(--walle-text-muted)",
            color: "var(--walle-text-secondary)",
            background: "transparent",
          }}
          onClick={onDismiss}
        >
          {isProactive ? "Dismiss" : "No thanks"}
        </button>
        {!isProactive && (
          <button
            type="button"
            className="px-3 py-1.5 rounded text-sm"
            style={{
              border: "1px solid var(--walle-amber)",
              color: "var(--walle-amber)",
              background: "rgba(255, 180, 50, 0.08)",
            }}
            onClick={onAccept}
          >
            Yes, automate it
          </button>
        )}
      </div>
    </motion.div>
  );
}
