import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";

import { isChatVisible } from "../lib/chatVisibility";
import type { Pattern } from "../lib/patternEngine";
import { notifyConfigChanged } from "../lib/settingsCrossWindow";

interface NudgePayload {
  kind: string;
  watcherId: string;
  pattern: Pattern;
}

export function useLearning(autoDismissSeconds: number) {
  const [pending, setPending] = useState<Pattern | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const armTimer = () => {
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      setPending(null);
    }, autoDismissSeconds * 1000);
  };

  useEffect(() => {
    let unlistenPattern: (() => void) | undefined;
    let unlistenNudge: (() => void) | undefined;
    (async () => {
      unlistenPattern = await listen<Pattern>("pattern:detected", async (ev) => {
        const payload = ev.payload;
        if (!payload?.id) return;
        if (await isChatVisible()) return;
        clearTimer();
        setPending({ ...payload, source: "pattern" });
        armTimer();
      });
      unlistenNudge = await listen<NudgePayload>("proactive:nudge", async (ev) => {
        const payload = ev.payload;
        if (!payload?.pattern?.id) return;
        if (await isChatVisible()) return;
        clearTimer();
        setPending({
          ...payload.pattern,
          watcherId: payload.watcherId,
          source: "proactive",
        });
        armTimer();
      });
    })().catch(console.error);
    return () => {
      unlistenPattern?.();
      unlistenNudge?.();
      clearTimer();
    };
  }, [autoDismissSeconds]);

  const dismiss = useCallback(async (p: Pattern) => {
    clearTimer();
    setPending(null);
    try {
      if (p.source === "proactive" && p.watcherId) {
        await invoke("proactive_watcher_dismiss", { watcherId: p.watcherId });
      } else {
        await invoke("pattern_dismiss", { id: p.id });
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const accept = useCallback(async (p: Pattern) => {
    if (p.source === "proactive") return;
    clearTimer();
    setPending(null);
    try {
      await invoke("pattern_accept", { id: p.id });
      await notifyConfigChanged();
    } catch (e) {
      console.error(e);
    }
  }, []);

  return { pendingSuggestion: pending, accept, dismiss };
}
