import { invoke } from "@tauri-apps/api/core";

interface RecorderBarProps {
  stepCount: number;
  onStop: () => void;
}

export default function RecorderBar({ stepCount, onStop }: RecorderBarProps) {
  return (
    <div
      className="flex items-center justify-between gap-2 px-3 py-2 text-xs shrink-0 border-b"
      style={{
        borderColor: "var(--walle-glass-border)",
        background: "rgba(180, 40, 40, 0.12)",
      }}
    >
      <span style={{ color: "var(--walle-red)" }}>● REC</span>
      <span style={{ color: "var(--walle-text-secondary)" }}>{stepCount} steps</span>
      <button
        type="button"
        className="px-2 py-1 rounded text-[11px]"
        onClick={() => {
          void invoke("recorder_stop");
          onStop();
        }}
      >
        Stop
      </button>
    </div>
  );
}
