import { emitTo } from "@tauri-apps/api/event";

import type { BubbleTrigger } from "./bubbleMessages";
import type { Animation } from "./animation";
import type { Emotion } from "./emotion";

/** Send an animation to the mascot webview (separate from chat Zustand). */
export async function emitMascotAnimation(animation: Animation): Promise<void> {
  await emitTo("mascot", "walle/animation", { animation });
}

export async function emitMascotEmotion(emotion: Emotion): Promise<void> {
  await emitTo("mascot", "walle/emotion", { emotion });
}

export async function emitMascotBubbleTrigger(trigger: BubbleTrigger): Promise<void> {
  await emitTo("mascot", "walle/bubble-trigger", { trigger });
}

export async function emitMascotBubbleLlm(text: string, emotion: Emotion): Promise<void> {
  await emitTo("mascot", "walle/bubble-llm", { text, emotion });
}
