import { invoke } from "@tauri-apps/api/core";

import { useWalleStore } from "../../store/walleStore";

export default function ModeToggle() {
  const mode = useWalleStore((s) => s.mode);
  const setMode = useWalleStore((s) => s.setMode);

  const onToggle = async () => {
    const next = mode === "auto" ? "manual_review" : "auto";
    setMode(next);
    await invoke("save_agent_mode", { mode: next });
  };

  const isAuto = mode === "auto";

  return (
    <button
      type="button"
      onClick={() => void onToggle()}
      className="text-[11px] uppercase tracking-wide px-2 py-1 rounded-full"
      style={{
        border: "1px solid var(--walle-glass-border)",
        color: isAuto ? "var(--walle-cyan)" : "var(--walle-amber)",
        boxShadow: isAuto ? "var(--walle-cyan-glow)" : "var(--walle-amber-glow)",
      }}
    >
      {isAuto ? "auto" : "review"}
    </button>
  );
}
