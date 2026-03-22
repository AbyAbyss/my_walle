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
  dance: 1400,
  wave: 1100,
  thumbs_up: 1100,
  confused: 1100,
  excited_run: 1800,
  stretch: 1300,
  pet: 900,
  hover_look: 0,
  none: 0,
};

export function normalizeAnimation(value: string | undefined): Animation {
  if (value && ANIMATIONS.includes(value as Animation)) return value as Animation;
  return "none";
}
