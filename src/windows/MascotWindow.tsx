import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef } from "react";

const SAVE_DEBOUNCE_MS = 320;

export default function MascotWindow({ children }: { children: React.ReactNode }) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const savePosition = useCallback(async () => {
    const win = getCurrentWindow();
    const pos = await win.outerPosition();
    const factor = await win.scaleFactor();
    const x = pos.x / factor;
    const y = pos.y / factor;
    await invoke("save_mascot_position", { x, y });
  }, []);

  useEffect(() => {
    const win = getCurrentWindow();
    let unlisten: (() => void) | undefined;

    (async () => {
      unlisten = await win.onMoved(() => {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          void savePosition();
        }, SAVE_DEBOUNCE_MS);
      });
    })().catch(console.error);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      unlisten?.();
    };
  }, [savePosition]);

  const onDragMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    void getCurrentWindow().startDragging();
  };

  return (
    <div
      style={{
        width: 160,
        height: 200,
        background: "transparent",
        cursor: "grab",
        userSelect: "none",
      }}
      onMouseDown={onDragMouseDown}
    >
      {children}
    </div>
  );
}
