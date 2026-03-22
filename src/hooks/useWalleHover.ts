import { useEffect } from "react";

import type { Animation } from "../lib/animation";
import type { Emotion } from "../lib/emotion";

const HOVER_DIST = 260;
const HEAD_ORIGIN = "95px 78px";

/** Subtle head turn toward cursor when nearby (idle, no overlay animation). */
export function useWalleHover(
  rootRef: React.RefObject<HTMLDivElement | null>,
  animation: Animation,
  emotion: Emotion,
) {
  useEffect(() => {
    if (animation !== "none" || emotion !== "idle") return;

    const handleMouseMove = (e: MouseEvent) => {
      const root = rootRef.current;
      if (!root) return;

      const rect = root.getBoundingClientRect();
      const walleCenterX = rect.left + rect.width / 2;
      const walleCenterY = rect.top + rect.height * 0.38;
      const dx = e.clientX - walleCenterX;
      const dy = e.clientY - walleCenterY;
      const dist = Math.hypot(dx, dy);

      const head = root.querySelector(".head-grp") as SVGElement | null;
      const pL = root.querySelector("#pL") as SVGCircleElement | null;
      const pR = root.querySelector("#pR") as SVGCircleElement | null;
      if (!head) return;

      if (dist > HOVER_DIST) {
        head.removeAttribute("style");
        if (pL) {
          pL.setAttribute("cx", "52");
          pL.setAttribute("cy", "71");
        }
        if (pR) {
          pR.setAttribute("cx", "138");
          pR.setAttribute("cy", "71");
        }
        return;
      }

      const t = Math.max(0, 1 - dist / HOVER_DIST);
      const rx = (dx / HOVER_DIST) * 9 * t;
      head.style.transform = `rotate(${rx}deg)`;
      head.style.transformOrigin = HEAD_ORIGIN;
      head.style.transition = "transform 0.15s ease-out";

      if (pL && pR) {
        const ox = (dx / dist) * 3.5 * Math.min(1, t * 2.4);
        const oy = (dy / dist) * 3 * Math.min(1, t * 2.4);
        pL.setAttribute("cx", String(52 + ox));
        pL.setAttribute("cy", String(71 + oy));
        pR.setAttribute("cx", String(138 + ox));
        pR.setAttribute("cy", String(71 + oy));
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      const root = rootRef.current;
      const head = root?.querySelector(".head-grp") as SVGElement | null;
      head?.removeAttribute("style");
    };
  }, [rootRef, animation, emotion]);
}
