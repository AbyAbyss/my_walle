import { useCallback, useEffect, useRef } from "react";

import type { Animation } from "../../lib/animation";
import { ANIMATION_DURATION_MS } from "../../lib/animation";
import type { Emotion } from "../../lib/emotion";
import MascotRenderer from "./MascotRenderer";

function useAnimationController(animation: Animation, onComplete: () => void) {
  useEffect(() => {
    const duration = ANIMATION_DURATION_MS[animation];
    if (duration <= 0 || animation === "none") return;
    const t = window.setTimeout(() => {
      onComplete();
    }, duration);
    return () => window.clearTimeout(t);
  }, [animation, onComplete]);
}

interface EmotionEngineProps {
  emotion: Emotion;
  animation: Animation;
  soundsEnabled: boolean;
  onAnimationComplete: () => void;
  onPet: () => void;
}

export default function EmotionEngine({
  emotion,
  animation,
  soundsEnabled,
  onAnimationComplete,
  onPet,
}: EmotionEngineProps) {
  const mascotRef = useRef<HTMLDivElement>(null);
  const stableComplete = useCallback(() => {
    onAnimationComplete();
  }, [onAnimationComplete]);

  useAnimationController(animation, stableComplete);

  return (
    <MascotRenderer
      ref={mascotRef}
      emotion={emotion}
      animation={animation}
      soundsEnabled={soundsEnabled}
      onPet={onPet}
    />
  );
}
