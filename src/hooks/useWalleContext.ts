import { useCallback, useState } from "react";

import { fetchWalleContextForLlm } from "../lib/fetchContext";

/** Active window + clipboard preview; call `refresh` when the chat panel opens or before sending. */
export function useWalleContext() {
  const [activeWindow, setActiveWindow] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const ctx = await fetchWalleContextForLlm();
    setActiveWindow(ctx.activeWindowTitle);
    setClipboard(ctx.clipboardPreview);
  }, []);

  return { activeWindow, clipboard, refresh };
}
