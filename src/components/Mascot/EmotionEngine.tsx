import { useCallback, useEffect, useRef } from "react";

import { useWalleHover } from "../../hooks/useWalleHover";
import type { Animation } from "../../lib/animation";
import { ANIMATION_DURATION_MS } from "../../lib/animation";
import type { Emotion } from "../../lib/emotion";
import WalleMascot from "./WalleMascot";

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
  onAnimationComplete: () => void;
  onPet: () => void;
}

export default function EmotionEngine({
  emotion,
  animation,
  onAnimationComplete,
  onPet,
}: EmotionEngineProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const stableComplete = useCallback(() => {
    onAnimationComplete();
  }, [onAnimationComplete]);

  useAnimationController(animation, stableComplete);
  useWalleHover(svgRef, animation, emotion);

  return (
    <WalleMascot
      ref={svgRef}
      emotion={emotion}
      animation={animation}
      onPet={onPet}
    />
  );
}
