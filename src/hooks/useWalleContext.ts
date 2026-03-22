import { useCallback } from "react";

import { fetchWalleContextForLlm } from "../lib/fetchContext";
import { useWalleStore } from "../store/walleStore";

/** Active window + clipboard preview; `refresh` updates Zustand for Phase 2 parity. */
export function useWalleContext() {
  const activeWindow = useWalleStore((s) => s.activeWindow);
  const clipboard = useWalleStore((s) => s.clipboardPreview);
  const setActiveWindow = useWalleStore((s) => s.setActiveWindow);
  const setClipboardPreview = useWalleStore((s) => s.setClipboardPreview);
  const setGitContext = useWalleStore((s) => s.setGitContext);

  const refresh = useCallback(async () => {
    const ctx = await fetchWalleContextForLlm();
    setActiveWindow(ctx.activeWindowTitle);
    setClipboardPreview(ctx.clipboardPreview);
    setGitContext(ctx.gitRepoPath ? { repoPath: ctx.gitRepoPath } : null);
  }, [setActiveWindow, setClipboardPreview, setGitContext]);

  return { activeWindow, clipboard, refresh };
}
