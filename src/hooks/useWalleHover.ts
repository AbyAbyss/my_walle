import { useEffect } from "react";

import type { Animation } from "../lib/animation";
import type { Emotion } from "../lib/emotion";

/** Subtle head turn toward cursor when nearby (idle, no overlay animation). */
export function useWalleHover(
  svgRef: React.RefObject<SVGSVGElement | null>,
  animation: Animation,
  emotion: Emotion,
) {
  useEffect(() => {
    if (animation !== "none" || emotion !== "idle") return;

    const handleMouseMove = (e: MouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const walleCenterX = rect.left + rect.width / 2;
      const walleCenterY = rect.top + rect.height / 2;

      const dx = e.clientX - walleCenterX;
      const dy = e.clientY - walleCenterY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const head = svg.querySelector("#head") as SVGElement | null;
      if (!head) return;

      if (distance > 200) {
        head.removeAttribute("style");
        return;
      }

      const intensity = Math.max(0, 1 - distance / 200);
      const rotateY = (dx / 200) * 8 * intensity;

      head.style.transform = `rotate(${rotateY}deg)`;
      head.style.transformOrigin = "80px 52px";
      head.style.transition = "transform 0.15s ease-out";
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      const svg = svgRef.current;
      svg?.querySelector("#head")?.removeAttribute("style");
    };
  }, [svgRef, animation, emotion]);
}
