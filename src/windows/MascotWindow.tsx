import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState } from "react";

import type { Animation } from "../lib/animation";
import type { Emotion } from "../lib/emotion";

const SAVE_DEBOUNCE_MS = 320;
const DRAG_STRIP_PX = 32;

interface MascotWindowProps {
  children: React.ReactNode;
  emotion: Emotion;
  animation: Animation;
}

export default function MascotWindow({ children, emotion, animation }: MascotWindowProps) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [idleWander, setIdleWander] = useState(true);
  const [wander, setWander] = useState({ x: 0, y: 0 });

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

  useEffect(() => {
    (async () => {
      try {
        const raw = await invoke<string>("get_walle_config");
        const j = JSON.parse(raw) as { mascot?: { idle_wander?: boolean } };
        setIdleWander(j.mascot?.idle_wander !== false);
      } catch {
        setIdleWander(true);
      }
    })().catch(console.error);
  }, []);

  useEffect(() => {
    if (emotion !== "idle" || animation !== "none" || !idleWander) return;
    const id = window.setInterval(() => {
      setWander({
        x: (Math.random() - 0.5) * 24,
        y: (Math.random() - 0.5) * 16,
      });
    }, 3000);
    return () => window.clearInterval(id);
  }, [emotion, animation, idleWander]);

  const onDragMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    void getCurrentWindow().startDragging();
  };

  return (
    <div
      style={{
        width: 220,
        height: 300,
        background: "transparent",
        userSelect: "none",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "visible",
          transform: `translate(${wander.x}px, ${wander.y}px)`,
          transition: "transform 2.5s cubic-bezier(0.45, 0, 0.55, 1)",
        }}
      >
        {children}
      </div>
      <div
        style={{
          height: DRAG_STRIP_PX,
          flexShrink: 0,
          cursor: "grab",
          background: "transparent",
        }}
        onMouseDown={onDragMouseDown}
        aria-hidden
      />
    </div>
  );
}
