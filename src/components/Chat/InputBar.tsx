import { useEffect, useState } from "react";

import { useVoice } from "../../hooks/useVoice";

interface InputBarProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  voiceTrigger?: number;
}

export default function InputBar({ onSend, disabled, voiceTrigger }: InputBarProps) {
  const [text, setText] = useState("");
  const { listening, startListening, stopListening } = useVoice((t) => {
    onSend(t);
  });

  useEffect(() => {
    if (voiceTrigger && voiceTrigger > 0) {
      startListening();
    }
  }, [voiceTrigger, startListening]);

  return (
    <div
      className="flex shrink-0 items-center gap-2 px-3 py-2 border-t"
      style={{ borderColor: "var(--walle-glass-border)" }}
    >
      <button
        type="button"
        title="Voice (Ctrl+Shift+V)"
        className="rounded-full w-9 h-9 flex items-center justify-center"
        style={{
          background: "var(--walle-bg-2)",
          color: listening ? "var(--walle-cyan)" : "var(--walle-text-secondary)",
        }}
        onClick={() => {
          if (listening) stopListening();
          else startListening();
        }}
      >
        🎙
      </button>
      <input
        className="flex-1 min-w-0 px-3 py-2 rounded-lg text-sm"
        style={{
          background: "var(--walle-bg-2)",
          border: "1px solid var(--walle-glass-border)",
          color: "var(--walle-text-primary)",
        }}
        placeholder="Type a message..."
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (text.trim()) {
              onSend(text.trim());
              setText("");
            }
          }
        }}
      />
      <button
        type="button"
        className="rounded-lg px-3 py-2 text-sm"
        style={{
          background: "var(--walle-cyan-dim)",
          color: "var(--walle-cyan)",
          border: "1px solid var(--walle-cyan)",
        }}
        disabled={disabled || !text.trim()}
        onClick={() => {
          if (text.trim()) {
            onSend(text.trim());
            setText("");
          }
        }}
      >
        Send
      </button>
    </div>
  );
}
