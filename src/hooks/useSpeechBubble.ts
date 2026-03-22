import { emit, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState } from "react";

import type { Animation } from "../lib/animation";
import type { BubbleTrigger } from "../lib/bubbleMessages";
import { getTimeTrigger, pickMessage } from "../lib/bubbleMessages";
import { isChatVisible } from "../lib/chatVisibility";
import { emitMascotEmotion } from "../lib/mascotBridge";
import type { Emotion } from "../lib/emotion";
import { normalizeEmotion } from "../lib/emotion";

const IDLE_BORED_INTERVAL_MS = 8 * 60 * 1000;
const TIME_GREETING_DELAY_MS = 2000;

function animationAllowsBubble(animation: Animation): boolean {
  return animation === "none" || animation === "hover_look";
}

export interface UseSpeechBubbleArgs {
  animation: Animation;
}

export function useSpeechBubble({ animation }: UseSpeechBubbleArgs) {
  const [activeMessage, setActiveMessage] = useState<string | null>(null);
  const lastShownRef = useRef<string | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasGreetedRef = useRef(false);
  const lastIdleRef = useRef(0);
  const skipTimeGreetingRef = useRef(false);
  const onboardingCompleteRef = useRef(true);
  const [prefsReady, setPrefsReady] = useState(false);
  const activeMessageRef = useRef<string | null>(null);
  const showBubbleRef = useRef<(t: BubbleTrigger) => Promise<void>>(async () => {});

  activeMessageRef.current = activeMessage;

  const clearDismissTimer = () => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  };

  const emitBubbleEcho = useCallback(async (text: string) => {
    await emit("walle/bubble-echo", { text });
  }, []);

  const dismissBubble = useCallback(() => {
    clearDismissTimer();
    setActiveMessage(null);
  }, []);

  const canShowUnprompted = useCallback(async (): Promise<boolean> => {
    if (!prefsReady || !onboardingCompleteRef.current) return false;
    if (activeMessage !== null) return false;
    if (!animationAllowsBubble(animation)) return false;
    if (await isChatVisible()) return false;
    return true;
  }, [animation, activeMessage, prefsReady]);

  const canShowLlmMirror = useCallback(async (): Promise<boolean> => {
    if (activeMessage !== null) return false;
    if (!animationAllowsBubble(animation)) return false;
    if (await isChatVisible()) return false;
    return true;
  }, [animation, activeMessage]);

  const showBubble = useCallback(
    async (trigger: BubbleTrigger) => {
      if (!(await canShowUnprompted())) return;

      const msg = pickMessage(trigger, lastShownRef.current);
      lastShownRef.current = msg.text;

      await emitMascotEmotion(msg.emotion);
      await emitBubbleEcho(msg.text);

      clearDismissTimer();
      setActiveMessage(msg.text);
      dismissTimerRef.current = setTimeout(() => {
        setActiveMessage(null);
      }, msg.duration_ms);
    },
    [canShowUnprompted, emitBubbleEcho],
  );

  showBubbleRef.current = showBubble;

  const showLLMReply = useCallback(
    async (text: string, emotion: Emotion) => {
      if (!(await canShowLlmMirror())) return;

      const truncated =
        text.length > 120 ? `${text.slice(0, 117).trimEnd()}...` : text;

      clearDismissTimer();

      const hadBubble = activeMessageRef.current !== null;
      setActiveMessage(null);

      const gap = hadBubble ? 200 : 0;
      window.setTimeout(() => {
        void (async () => {
          lastShownRef.current = truncated;
          const em = normalizeEmotion(emotion);
          await emitMascotEmotion(em);
          await emitBubbleEcho(truncated);
          setActiveMessage(truncated);

          const wordCount = truncated.split(/\s+/).filter(Boolean).length;
          const duration = Math.min(12000, Math.max(4000, wordCount * 1000));

          dismissTimerRef.current = setTimeout(() => {
            setActiveMessage(null);
          }, duration);
        })();
      }, gap);
    },
    [canShowLlmMirror, emitBubbleEcho],
  );

  const showLLMReplyRef = useRef(showLLMReply);
  showLLMReplyRef.current = showLLMReply;

  useEffect(() => {
    void (async () => {
      try {
        const raw = await invoke<string>("get_walle_config");
        const j = JSON.parse(raw) as { onboarding_complete?: boolean; last_open_date?: string };
        onboardingCompleteRef.current = j.onboarding_complete !== false;
        const today = new Date().toDateString();
        if (j.last_open_date !== today) {
          skipTimeGreetingRef.current = true;
        }
      } catch {
        onboardingCompleteRef.current = true;
      }
      setPrefsReady(true);
    })();
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen("walle/session-first-open-today", () => {
      skipTimeGreetingRef.current = true;
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {});
    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    let unlistenTrigger: (() => void) | undefined;
    let unlistenLlm: (() => void) | undefined;
    void (async () => {
      unlistenTrigger = await listen<{ trigger: BubbleTrigger }>("walle/bubble-trigger", (ev) => {
        const t = ev.payload?.trigger;
        if (t) void showBubbleRef.current(t);
      });
      unlistenLlm = await listen<{ text: string; emotion?: Emotion }>("walle/bubble-llm", (ev) => {
        const p = ev.payload;
        if (p?.text) void showLLMReplyRef.current(p.text, normalizeEmotion(p.emotion));
      });
    })();
    return () => {
      unlistenTrigger?.();
      unlistenLlm?.();
    };
  }, []);

  useEffect(() => {
    if (!prefsReady) return;
    const t = window.setTimeout(() => {
      if (hasGreetedRef.current) return;
      if (skipTimeGreetingRef.current) return;
      if (!onboardingCompleteRef.current) return;
      hasGreetedRef.current = true;
      void showBubbleRef.current(getTimeTrigger());
    }, TIME_GREETING_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [prefsReady]);

  useEffect(() => {
    if (!prefsReady || !onboardingCompleteRef.current) return;
    idleTimerRef.current = window.setInterval(() => {
      void (async () => {
        const now = Date.now();
        if (now - lastIdleRef.current < IDLE_BORED_INTERVAL_MS) return;
        if (!(await canShowUnprompted())) return;
        lastIdleRef.current = now;
        await showBubbleRef.current("idle_bored");
      })();
    }, 60_000);
    return () => {
      if (idleTimerRef.current) window.clearInterval(idleTimerRef.current);
    };
  }, [prefsReady, canShowUnprompted]);

  useEffect(() => {
    if (!activeMessage) return;
    const id = window.setInterval(() => {
      void (async () => {
        if (await isChatVisible()) dismissBubble();
      })();
    }, 450);
    return () => window.clearInterval(id);
  }, [activeMessage, dismissBubble]);

  return { activeMessage, dismissBubble };
}

export function useMascotSide(): "left" | "right" {
  const [side, setSide] = useState<"left" | "right">("right");

  useEffect(() => {
    async function check() {
      try {
        const win = getCurrentWindow();
        const pos = await win.outerPosition();
        setSide(pos.x > 800 ? "right" : "left");
      } catch {
        /* ignore */
      }
    }
    void check();
    let unlisten: (() => void) | undefined;
    void getCurrentWindow()
      .onMoved(() => {
        void check();
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {});
    return () => {
      unlisten?.();
    };
  }, []);

  return side;
}
