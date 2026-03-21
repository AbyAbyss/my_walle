import { emitTo } from "@tauri-apps/api/event";

import type { Animation } from "./animation";

/** Send an animation to the mascot webview (separate from chat Zustand). */
export async function emitMascotAnimation(animation: Animation): Promise<void> {
  await emitTo("mascot", "walle/animation", { animation });
}
