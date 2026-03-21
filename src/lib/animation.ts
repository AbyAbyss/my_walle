/** Short one-shot (or looping) sequences layered on top of emotion CSS. */
export type Animation =
  | "dance"
  | "wave"
  | "thumbs_up"
  | "confused"
  | "excited_run"
  | "stretch"
  | "pet"
  | "hover_look"
  | "none";

export const ANIMATIONS: Animation[] = [
  "dance",
  "wave",
  "thumbs_up",
  "confused",
  "excited_run",
  "stretch",
  "pet",
  "hover_look",
  "none",
];

export const ANIMATION_DURATION_MS: Record<Animation, number> = {
  dance: 1200,
  wave: 1000,
  thumbs_up: 1000,
  confused: 1000,
  excited_run: 0,
  stretch: 1200,
  pet: 800,
  hover_look: 0,
  none: 0,
};

export function normalizeAnimation(value: string | undefined): Animation {
  if (value && ANIMATIONS.includes(value as Animation)) return value as Animation;
  return "none";
}
