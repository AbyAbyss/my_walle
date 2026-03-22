import { useEffect } from "react";

import type { Animation } from "../lib/animation";
import type { Emotion } from "../lib/emotion";
import type { ActiveMascot } from "../store/walleStore";

const WALLE_HOVER_DIST = 260;
const WALLE_HEAD_ORIGIN = "95px 78px";

const DUDU_HOVER_DIST = 270;
const DUDU_HEAD_ORIGIN = "110px 104px";

/** Head turn + pupil track toward cursor when idle (mascot-specific geometry). */
export function useMascotHover(
  rootRef: React.RefObject<HTMLDivElement | null>,
  animation: Animation,
  emotion: Emotion,
  activeMascot: ActiveMascot,
) {
  useEffect(() => {
    if (animation !== "none" || emotion !== "idle") return;

    const handleMouseMove = (e: MouseEvent) => {
      const root = rootRef.current;
      if (!root) return;

      const rect = root.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height * 0.38;
      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;
      const dist = Math.hypot(dx, dy);

      const head = root.querySelector(".head-grp") as SVGElement | null;
      const pL = root.querySelector("#pL") as SVGCircleElement | null;
      const pR = root.querySelector("#pR") as SVGCircleElement | null;
      if (!head) return;

      if (activeMascot === "walle") {
        if (dist > WALLE_HOVER_DIST) {
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

        const t = Math.max(0, 1 - dist / WALLE_HOVER_DIST);
        const rx = (dx / WALLE_HOVER_DIST) * 9 * t;
        head.style.transform = `rotate(${rx}deg)`;
        head.style.transformOrigin = WALLE_HEAD_ORIGIN;
        head.style.transition = "transform 0.15s ease-out";

        if (pL && pR) {
          const ox = (dx / dist) * 3.5 * Math.min(1, t * 2.4);
          const oy = (dy / dist) * 3 * Math.min(1, t * 2.4);
          pL.setAttribute("cx", String(52 + ox));
          pL.setAttribute("cy", String(71 + oy));
          pR.setAttribute("cx", String(138 + ox));
          pR.setAttribute("cy", String(71 + oy));
        }
        return;
      }

      /* DuDu — ported from mascot_test/walle_mascot_bird.html */
      if (dist > DUDU_HOVER_DIST) {
        head.removeAttribute("style");
        if (pL) {
          pL.setAttribute("cx", "83");
          pL.setAttribute("cy", "104");
        }
        if (pR) {
          pR.setAttribute("cx", "137");
          pR.setAttribute("cy", "104");
        }
        return;
      }

      const t = Math.max(0, 1 - dist / DUDU_HOVER_DIST);
      const rx = (dx / DUDU_HOVER_DIST) * 10 * t;
      head.style.transform = `rotate(${rx}deg)`;
      head.style.transformOrigin = DUDU_HEAD_ORIGIN;
      head.style.transition = "transform 0.15s ease-out";

      if (pL && pR) {
        const ox = (dx / dist) * 3.2 * Math.min(1, t * 2.5);
        const oy = (dy / dist) * 2.8 * Math.min(1, t * 2.5);
        pL.setAttribute("cx", String(83 + ox));
        pL.setAttribute("cy", String(104 + oy));
        pR.setAttribute("cx", String(137 + ox));
        pR.setAttribute("cy", String(104 + oy));
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      const root = rootRef.current;
      const head = root?.querySelector(".head-grp") as SVGElement | null;
      head?.removeAttribute("style");
    };
  }, [rootRef, animation, emotion, activeMascot]);
}
