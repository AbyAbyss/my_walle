export type Emotion =
  | "idle"
  | "thinking"
  | "happy"
  | "sad"
  | "alert"
  | "focused"
  | "sleeping";

export const EMOTIONS: Emotion[] = [
  "idle",
  "thinking",
  "happy",
  "sad",
  "alert",
  "focused",
  "sleeping",
];

export function normalizeEmotion(e: string | undefined): Emotion {
  if (e && EMOTIONS.includes(e as Emotion)) return e as Emotion;
  return "idle";
}
