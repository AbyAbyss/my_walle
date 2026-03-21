import { listen } from "@tauri-apps/api/event";
import React, { useCallback, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import EmotionEngine from "./components/Mascot/EmotionEngine";
import MascotWindow from "./windows/MascotWindow";
import { EMOTIONS, type Emotion } from "./lib/emotion";
import "./styles/globals.css";

function MascotRoot() {
  const [emotion, setEmotion] = useState<Emotion>("idle");

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      unlisten = await listen<{ emotion: Emotion }>("walle/emotion", (ev) => {
        if (ev.payload?.emotion) setEmotion(ev.payload.emotion);
      });
    })().catch(console.error);
    return () => unlisten?.();
  }, []);

  const cycleDev = useCallback(() => {
    setEmotion((e) => {
      const i = EMOTIONS.indexOf(e);
      return EMOTIONS[(i + 1) % EMOTIONS.length];
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        cycleDev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cycleDev]);

  return (
    <MascotWindow>
      <EmotionEngine emotion={emotion} />
    </MascotWindow>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <MascotRoot />
  </React.StrictMode>,
);
