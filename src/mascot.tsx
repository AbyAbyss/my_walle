import { AnimatePresence } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import EmotionEngine from "./components/Mascot/EmotionEngine";
import SuggestionBubble from "./components/Suggestions/SuggestionBubble";
import MascotWindow from "./windows/MascotWindow";
import { useLearning } from "./hooks/useLearning";
import type { Animation } from "./lib/animation";
import { normalizeAnimation } from "./lib/animation";
import { EMOTIONS, type Emotion } from "./lib/emotion";
import { parseActiveMascotFromConfigJson, useWalleStore } from "./store/walleStore";
import "./styles/globals.css";
import "./styles/animations.css";

function MascotRoot() {
  const [emotion, setEmotion] = useState<Emotion>("idle");
  const [animation, setAnimation] = useState<Animation>("none");
  const prevEmotionRef = useRef<Emotion>("idle");
  const learningDismissSeconds = 30;
  const { pendingSuggestion, accept, dismiss } = useLearning(learningDismissSeconds);
  const patternEmotionLock = useRef(false);

  const hydrateActiveMascot = useCallback(async () => {
    try {
      const raw = await invoke<string>("get_walle_config");
      useWalleStore.setState({ activeMascot: parseActiveMascotFromConfigJson(raw) });
    } catch {
      useWalleStore.setState({ activeMascot: "walle" });
    }
  }, []);

  useEffect(() => {
    void hydrateActiveMascot();
  }, [hydrateActiveMascot]);

  useEffect(() => {
    let u: (() => void) | undefined;
    (async () => {
      u = await listen("walle/config-changed", () => {
        void hydrateActiveMascot();
      });
    })().catch(console.error);
    return () => u?.();
  }, [hydrateActiveMascot]);

  useEffect(() => {
    let unlistenEmotion: (() => void) | undefined;
    let unlistenAnimation: (() => void) | undefined;
    (async () => {
      unlistenEmotion = await listen<{ emotion: Emotion }>("walle/emotion", (ev) => {
        if (ev.payload?.emotion) setEmotion(ev.payload.emotion);
      });
      unlistenAnimation = await listen<{ animation: string }>("walle/animation", (ev) => {
        setAnimation(normalizeAnimation(ev.payload?.animation));
      });
    })().catch(console.error);
    return () => {
      unlistenEmotion?.();
      unlistenAnimation?.();
    };
  }, []);

  useEffect(() => {
    if (prevEmotionRef.current === "sleeping" && emotion !== "sleeping") {
      setAnimation("stretch");
    }
    prevEmotionRef.current = emotion;
  }, [emotion]);

  useEffect(() => {
    if (pendingSuggestion) {
      patternEmotionLock.current = true;
      setEmotion("alert");
    } else if (patternEmotionLock.current) {
      patternEmotionLock.current = false;
      setEmotion("idle");
    }
  }, [pendingSuggestion]);

  const onAnimationComplete = useCallback(() => {
    setAnimation("none");
  }, []);

  const handlePet = useCallback(() => {
    if (animation === "dance" || animation === "confused") return;
    setAnimation("pet");
  }, [animation]);

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
    <MascotWindow emotion={emotion} animation={animation}>
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <AnimatePresence>
          {pendingSuggestion && (
            <div
              key={pendingSuggestion.id}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: "100%",
                marginBottom: 8,
                zIndex: 50,
                display: "flex",
                justifyContent: "center",
                pointerEvents: "auto",
              }}
            >
              <SuggestionBubble
                pattern={pendingSuggestion}
                onAccept={() => void accept(pendingSuggestion)}
                onDismiss={() => void dismiss(pendingSuggestion)}
              />
            </div>
          )}
        </AnimatePresence>
        <EmotionEngine
          emotion={emotion}
          animation={animation}
          onAnimationComplete={onAnimationComplete}
          onPet={handlePet}
        />
      </div>
    </MascotWindow>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <MascotRoot />
  </React.StrictMode>,
);
