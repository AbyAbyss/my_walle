import { useState } from "react";

import type { UserLevel } from "../../lib/uiPreferences";

const CHIPS_SIMPLE = [
  "Open Spotify",
  "What's using the most memory?",
  "Open my project folder",
  "Remind me in 10 minutes",
  "Run my start work workflow",
  "What can you do?",
];

const CHIPS_DEVELOPER = [
  "Open Spotify",
  "List top processes by memory",
  "Open my project folder",
  "Remind me in 10 minutes",
  "Run my start work workflow",
  "What shell commands can you run?",
];

interface SuggestionChipsProps {
  userLevel: UserLevel;
  onSelect: (text: string) => void;
}

export default function SuggestionChips({ userLevel, onSelect }: SuggestionChipsProps) {
  const [open, setOpen] = useState(false);
  const chips = userLevel === "developer" ? CHIPS_DEVELOPER : CHIPS_SIMPLE;

  return (
    <div className="px-3 pt-1 pb-0 shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-[11px]"
        style={{
          color: "var(--walle-text-muted)",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "4px 8px",
        }}
      >
        {open ? "✕ close" : "💡 what can I ask?"}
      </button>

      {open && (
        <div
          className="flex flex-wrap gap-1.5 mt-2 pb-2"
          style={{
            borderTop: "0.5px solid var(--walle-glass-border)",
            paddingTop: "8px",
          }}
        >
          {chips.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => {
                onSelect(chip);
                setOpen(false);
              }}
              className="text-[12px] px-3 py-1 rounded-full"
              style={{
                background: "var(--walle-bg-2)",
                border: "0.5px solid var(--walle-glass-border-hover)",
                color: "var(--walle-text-secondary)",
                fontFamily: "var(--walle-font-ui)",
                cursor: "pointer",
                transition: "var(--walle-transition)",
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
