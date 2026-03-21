import { forwardRef, useRef } from "react";

import type { Animation } from "../../lib/animation";
import type { Emotion } from "../../lib/emotion";

/**
 * WALLE mascot — SVG + CSS keyframe emotions and overlay animations.
 */
const WalleMascot = forwardRef<
  SVGSVGElement,
  { emotion: Emotion; animation: Animation; onPet: () => void }
>(function WalleMascot({ emotion, animation, onPet }, ref) {
  const pointerDown = useRef<{ x: number; y: number } | null>(null);

  const className = [emotion, animation !== "none" ? animation : ""].filter(Boolean).join(" ");

  return (
    <svg
      ref={ref}
      id="walle"
      className={className}
      viewBox="0 0 160 200"
      xmlns="http://www.w3.org/2000/svg"
      width={160}
      height={168}
      aria-hidden
      style={{ cursor: "pointer", display: "block" }}
      onPointerDown={(e) => {
        pointerDown.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        const start = pointerDown.current;
        pointerDown.current = null;
        if (!start) return;
        const d = Math.hypot(e.clientX - start.x, e.clientY - start.y);
        if (d < 12) onPet();
      }}
    >
      <ellipse
        id="shadow"
        cx="80"
        cy="192"
        rx="48"
        ry="6"
        fill="#000000"
        opacity="0.35"
      />

      <g id="body">
        <rect
          id="chassis"
          x="30"
          y="80"
          width="100"
          height="90"
          rx="12"
          fill="#1a1d2e"
          stroke="#2a2f45"
          strokeWidth="1.5"
        />
        <path
          id="circuit-left"
          d="M 38 100 L 52 100 L 58 118 L 44 118 Z"
          fill="none"
          stroke="var(--walle-cyan)"
          strokeWidth="0.8"
          opacity="0.6"
        />
        <path
          id="circuit-right"
          d="M 122 100 L 108 100 L 102 118 L 116 118 Z"
          fill="none"
          stroke="var(--walle-cyan)"
          strokeWidth="0.8"
          opacity="0.6"
        />
        <rect
          id="arm-left"
          x="22"
          y="95"
          width="14"
          height="28"
          rx="4"
          fill="#141621"
        />
        <rect
          id="arm-right"
          x="124"
          y="95"
          width="14"
          height="28"
          rx="4"
          fill="#141621"
        />
        <rect
          id="tread"
          x="34"
          y="165"
          width="92"
          height="18"
          rx="8"
          fill="#0f1117"
          stroke="#2a3548"
          strokeWidth="1"
        />

        <g id="thumb" opacity="0" transform="translate(130, 130)">
          <rect
            x="0"
            y="0"
            width="8"
            height="16"
            rx="4"
            fill="#1a1d2e"
            stroke="#2a2f45"
            strokeWidth="1"
          />
          <circle cx="4" cy="-2" r="5" fill="#1a1d2e" stroke="#2a2f45" strokeWidth="1" />
        </g>

        <g id="arms-stretch" opacity="0">
          <rect id="arm-stretch-left" x="12" y="70" width="18" height="8" rx="4" fill="#141621" />
          <rect id="arm-stretch-right" x="130" y="70" width="18" height="8" rx="4" fill="#141621" />
        </g>
      </g>

      <g id="particles" opacity="0">
        <circle id="p1" cx="80" cy="60" r="3" fill="var(--walle-cyan)" />
        <circle id="p2" cx="80" cy="60" r="3" fill="var(--walle-amber)" />
        <circle id="p3" cx="80" cy="60" r="3" fill="var(--walle-green)" />
        <circle id="p4" cx="80" cy="60" r="3" fill="var(--walle-cyan)" />
        <circle id="p5" cx="80" cy="60" r="3" fill="var(--walle-amber)" />
        <circle id="p6" cx="80" cy="60" r="3" fill="var(--walle-green)" />
      </g>

      <g id="head">
        <rect
          id="head-box"
          x="35"
          y="20"
          width="90"
          height="65"
          rx="10"
          fill="#1a1d2e"
          stroke="#2a2f45"
          strokeWidth="1.5"
        />

        <g id="antenna">
          <line
            x1="80"
            y1="20"
            x2="80"
            y2="6"
            stroke="#2a2f45"
            strokeWidth="2"
          />
          <circle id="antenna-tip" cx="80" cy="4" r="4" fill="var(--walle-cyan)" />
        </g>

        <g id="eyes">
          <rect
            id="eye-housing-l"
            x="42"
            y="32"
            width="30"
            height="26"
            rx="6"
            fill="#0a0c14"
            stroke="#1e2235"
            strokeWidth="1"
          />
          <circle
            id="eye-l"
            cx="57"
            cy="45"
            r="9"
            fill="var(--walle-amber)"
            opacity="0.9"
          />
          <circle cx="61" cy="41" r="2.5" fill="white" opacity="0.6" />

          <rect
            id="eye-housing-r"
            x="88"
            y="32"
            width="30"
            height="26"
            rx="6"
            fill="#0a0c14"
            stroke="#1e2235"
            strokeWidth="1"
          />
          <circle
            id="eye-r"
            cx="103"
            cy="45"
            r="9"
            fill="var(--walle-amber)"
            opacity="0.9"
          />
          <circle cx="107" cy="41" r="2.5" fill="white" opacity="0.6" />
        </g>

        <path
          id="mouth"
          d="M60 72 Q80 78 100 72"
          fill="none"
          stroke="var(--walle-cyan)"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.7"
        />
      </g>

      <g id="question-bubble" opacity="0" transform="translate(112, 10)">
        <rect
          x="0"
          y="0"
          width="26"
          height="26"
          rx="8"
          fill="#1e2130"
          stroke="var(--walle-cyan)"
          strokeWidth="1"
        />
        <text
          x="13"
          y="18"
          textAnchor="middle"
          fontSize="14"
          fill="var(--walle-cyan)"
          fontFamily="var(--walle-font-ui)"
        >
          ?
        </text>
        <path d="M8 26 L4 32 L14 26Z" fill="#1e2130" />
      </g>

      <g id="speech-bubble" opacity="0" transform="translate(110, 0)">
        <rect
          x="0"
          y="20"
          width="40"
          height="24"
          rx="6"
          fill="var(--walle-bg-2)"
          stroke="var(--walle-glass-border)"
        />
      </g>
    </svg>
  );
});

export default WalleMascot;
