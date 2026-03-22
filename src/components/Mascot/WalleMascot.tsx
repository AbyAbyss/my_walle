import { forwardRef, useCallback, useEffect, useRef } from "react";

import type { Animation } from "../../lib/animation";
import type { Emotion } from "../../lib/emotion";
import { playWalleAnimation } from "../../lib/mascotSounds";
import { applyMascotEmotion } from "./mascotApplyEmotion";
import { spawnMascotParticles } from "./mascotParticles";

/**
 * WALLE mascot — cute SVG from mascot_test/walle_mascot_cute.html + emotion/animation CSS.
 */
const WalleMascot = forwardRef<
  HTMLDivElement,
  { emotion: Emotion; animation: Animation; soundsEnabled: boolean; onPet: () => void }
>(function WalleMascot({ emotion, animation, soundsEnabled, onPet }, ref) {
  const pointerDown = useRef<{ x: number; y: number } | null>(null);
  const prevAnimationRef = useRef<Animation>("none");
  const prevSoundsEnabledRef = useRef(soundsEnabled);
  const particlesRef = useRef<HTMLDivElement>(null);
  const walleRef = useRef<HTMLDivElement>(null);
  const setWalleRef = useCallback(
    (node: HTMLDivElement | null) => {
      walleRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [ref],
  );

  const className = [emotion, animation !== "none" ? animation : ""]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    const root = walleRef.current;
    if (!root) return;
    applyMascotEmotion(root, emotion);
  }, [emotion]);

  useEffect(() => {
    if (emotion !== "sad") return;
    const root = walleRef.current;
    if (!root) return;

    const tick = () => {
      ["tear-l", "tear-r"].forEach((id, i) => {
        const el = root.querySelector(`#${id}`) as SVGElement | null;
        if (!el) return;
        el.animate(
          [
            { opacity: 0.9, transform: "translateY(0) scaleY(1)" },
            { opacity: 0, transform: "translateY(32px) scaleY(1.5)" },
          ],
          { duration: 1200, delay: i * 380, fill: "none" },
        );
      });
    };
    tick();
    const id = window.setInterval(tick, 1400);
    return () => window.clearInterval(id);
  }, [emotion]);

  useEffect(() => {
    if (animation !== "dance" && animation !== "pet") return;
    const root = walleRef.current;
    const particles = particlesRef.current;
    if (!root || !particles) return;

    let cancelled = false;
    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      const n = animation === "dance" ? 12 : 8;
      spawnMascotParticles(root, particles, n);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [animation]);

  useEffect(() => {
    if (prevSoundsEnabledRef.current === false && soundsEnabled) {
      prevAnimationRef.current = "none";
    }
    prevSoundsEnabledRef.current = soundsEnabled;

    if (!soundsEnabled) {
      prevAnimationRef.current = animation;
      return;
    }
    if (animation === "none") {
      prevAnimationRef.current = animation;
      return;
    }
    if (prevAnimationRef.current === animation) return;
    prevAnimationRef.current = animation;
    playWalleAnimation(soundsEnabled, animation);
  }, [animation, soundsEnabled]);

  return (
    <div className="mascot-scene">
      <div
        ref={particlesRef}
        className="mascot-particles"
        id="mascot-particles"
        aria-hidden
      />
      <div
        ref={setWalleRef}
        id="walle"
        className={className}
        style={{
          position: "relative",
          width: 190,
          height: 262,
          cursor: "pointer",
          userSelect: "none",
        }}
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
        <svg
          className="walle-svg"
          viewBox="0 0 190 262"
          xmlns="http://www.w3.org/2000/svg"
          width={190}
          height={262}
          aria-hidden
          style={{ display: "block", overflow: "visible" }}
        >
          <defs>
            <linearGradient id="bG" x1="0%" y1="0%" x2="55%" y2="100%">
              <stop offset="0%" stopColor="#1c2038" />
              <stop offset="100%" stopColor="#0b0d18" />
            </linearGradient>
            <linearGradient id="fG" x1="0%" y1="0%" x2="30%" y2="100%">
              <stop offset="0%" stopColor="#22253e" />
              <stop offset="100%" stopColor="#10121e" />
            </linearGradient>
            <linearGradient id="tG" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#181b2c" />
              <stop offset="100%" stopColor="#08090f" />
            </linearGradient>
            <radialGradient id="eG" cx="38%" cy="32%">
              <stop offset="0%" stopColor="#ffe9aa" />
              <stop offset="40%" stopColor="#ffb347" />
              <stop offset="100%" stopColor="#b85c00" />
            </radialGradient>
            <radialGradient id="eGC" cx="38%" cy="32%">
              <stop offset="0%" stopColor="#b0f5ff" />
              <stop offset="55%" stopColor="#00d4ff" />
              <stop offset="100%" stopColor="#005f7a" />
            </radialGradient>
            <radialGradient id="blG">
              <stop offset="0%" stopColor="#ff6eb4" stopOpacity=".5" />
              <stop offset="100%" stopColor="#ff6eb4" stopOpacity="0" />
            </radialGradient>
            <filter id="eF">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="cF">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <ellipse cx="95" cy="256" rx="56" ry="6" fill="#00d4ff" opacity=".07" />

          <g className="whole">
            <rect
              x="18"
              y="210"
              width="154"
              height="38"
              rx="19"
              fill="url(#tG)"
              stroke="#22253e"
              strokeWidth="1.5"
            />
            <rect x="30" y="214" width="13" height="30" rx="6.5" fill="#06070d" opacity=".8" />
            <rect x="50" y="214" width="13" height="30" rx="6.5" fill="#06070d" opacity=".8" />
            <rect x="70" y="214" width="13" height="30" rx="6.5" fill="#06070d" opacity=".8" />
            <rect x="90" y="214" width="13" height="30" rx="6.5" fill="#06070d" opacity=".8" />
            <rect x="110" y="214" width="13" height="30" rx="6.5" fill="#06070d" opacity=".8" />
            <rect x="130" y="214" width="13" height="30" rx="6.5" fill="#06070d" opacity=".8" />
            <rect x="150" y="214" width="13" height="30" rx="6.5" fill="#06070d" opacity=".8" />
            <rect x="20" y="226" width="150" height="3" rx="1.5" fill="#00d4ff" opacity=".18" />
            <circle cx="28" cy="229" r="10" fill="#0d0f1a" stroke="#1e2235" strokeWidth="1.2" />
            <circle cx="162" cy="229" r="10" fill="#0d0f1a" stroke="#1e2235" strokeWidth="1.2" />
            <circle cx="28" cy="229" r="4.5" fill="#181b28" />
            <circle cx="162" cy="229" r="4.5" fill="#181b28" />

            <rect
              x="26"
              y="138"
              width="138"
              height="78"
              rx="26"
              fill="url(#bG)"
              stroke="#22253e"
              strokeWidth="1.5"
            />
            <rect
              x="40"
              y="151"
              width="110"
              height="55"
              rx="16"
              fill="#09091a"
              stroke="#181b2c"
              strokeWidth="1"
            />

            <circle cx="58" cy="165" r="3" fill="#00d4ff" opacity=".55" />
            <circle cx="72" cy="165" r="3" fill="#00d4ff" opacity=".38" />
            <circle cx="86" cy="165" r="3" fill="#00d4ff" opacity=".55" />
            <circle cx="100" cy="165" r="3" fill="#00d4ff" opacity=".38" />
            <circle cx="114" cy="165" r="3" fill="#00d4ff" opacity=".55" />
            <circle cx="128" cy="165" r="3" fill="#00d4ff" opacity=".38" />
            <circle cx="58" cy="179" r="2.5" fill="#00d4ff" opacity=".3" />
            <circle cx="72" cy="179" r="3" fill="#ffb347" opacity=".48" />
            <circle cx="86" cy="179" r="2.5" fill="#00d4ff" opacity=".3" />
            <circle cx="100" cy="179" r="3" fill="#00ff88" opacity=".42" />
            <circle cx="114" cy="179" r="2.5" fill="#00d4ff" opacity=".3" />
            <circle cx="128" cy="179" r="2.5" fill="#ffe066" opacity=".4" />

            <rect
              x="52"
              y="191"
              width="34"
              height="8"
              rx="4"
              fill="none"
              stroke="#00d4ff"
              strokeWidth="1.2"
              opacity=".65"
            />
            <rect
              x="104"
              y="191"
              width="34"
              height="8"
              rx="4"
              fill="none"
              stroke="#00d4ff"
              strokeWidth="1.2"
              opacity=".65"
            />

            <circle cx="32" cy="144" r="3.5" fill="#181b2c" stroke="#252840" strokeWidth="1" />
            <circle cx="158" cy="144" r="3.5" fill="#181b2c" stroke="#252840" strokeWidth="1" />
            <circle cx="32" cy="208" r="3.5" fill="#181b2c" stroke="#252840" strokeWidth="1" />
            <circle cx="158" cy="208" r="3.5" fill="#181b2c" stroke="#252840" strokeWidth="1" />

            <g className="arm-l">
              <rect
                x="2"
                y="130"
                width="28"
                height="50"
                rx="14"
                fill="#13162a"
                stroke="#22253e"
                strokeWidth="1.5"
              />
              <rect x="5" y="134" width="10" height="20" rx="5" fill="#1c2038" opacity=".7" />
              <rect
                x="4"
                y="171"
                width="24"
                height="9"
                rx="4.5"
                fill="#08090f"
                stroke="#00d4ff"
                strokeWidth="1"
                opacity=".65"
              />
            </g>

            <g className="arm-r">
              <rect
                x="160"
                y="130"
                width="28"
                height="50"
                rx="14"
                fill="#13162a"
                stroke="#22253e"
                strokeWidth="1.5"
              />
              <rect x="175" y="134" width="10" height="20" rx="5" fill="#1c2038" opacity=".7" />
              <rect
                x="162"
                y="171"
                width="24"
                height="9"
                rx="4.5"
                fill="#08090f"
                stroke="#00d4ff"
                strokeWidth="1"
                opacity=".65"
              />
            </g>

            <rect x="70" y="130" width="50" height="14" rx="7" fill="#13162a" stroke="#22253e" strokeWidth="1" />
            <rect x="78" y="133" width="34" height="4" rx="2" fill="#00d4ff" opacity=".16" />

            <g className="head-grp">
              <g className="ant-grp">
                <rect
                  x="91.5"
                  y="5"
                  width="7"
                  height="24"
                  rx="3.5"
                  fill="#1a1e30"
                  stroke="#22253e"
                  strokeWidth="1"
                />
                <circle
                  className="ant-dot"
                  cx="95"
                  cy="4.5"
                  r="7"
                  fill="#00d4ff"
                  opacity=".92"
                  filter="url(#cF)"
                />
                <circle cx="95" cy="4.5" r="10" fill="none" stroke="#00d4ff" strokeWidth=".7" opacity=".28" />
                <line x1="95" y1="-4" x2="95" y2="-9" stroke="#00d4ff" strokeWidth="1.2" opacity=".4" />
                <line x1="102" y1="0" x2="107" y2="-3" stroke="#00d4ff" strokeWidth="1.2" opacity=".3" />
                <line x1="88" y1="0" x2="83" y2="-3" stroke="#00d4ff" strokeWidth="1.2" opacity=".3" />
                <line x1="103" y1="7" x2="108" y2="8" stroke="#00d4ff" strokeWidth=".8" opacity=".2" />
                <line x1="87" y1="7" x2="82" y2="8" stroke="#00d4ff" strokeWidth=".8" opacity=".2" />
              </g>

              <rect
                x="10"
                y="26"
                width="170"
                height="108"
                rx="40"
                fill="url(#fG)"
                stroke="#22253e"
                strokeWidth="1.5"
              />
              <ellipse cx="95" cy="35" rx="56" ry="12" fill="white" opacity=".022" />
              <rect x="14" y="30" width="162" height="100" rx="36" fill="none" stroke="#181b2c" strokeWidth="1" />

              <rect
                x="18"
                y="38"
                width="68"
                height="66"
                rx="26"
                fill="#07070f"
                stroke="#1e2235"
                strokeWidth="1.5"
              />
              <rect
                x="104"
                y="38"
                width="68"
                height="66"
                rx="26"
                fill="#07070f"
                stroke="#1e2235"
                strokeWidth="1.5"
              />
              <rect
                x="20"
                y="40"
                width="64"
                height="62"
                rx="24"
                fill="none"
                stroke="#ffb347"
                strokeWidth=".6"
                opacity=".14"
              />
              <rect
                x="106"
                y="40"
                width="64"
                height="62"
                rx="24"
                fill="none"
                stroke="#ffb347"
                strokeWidth=".6"
                opacity=".14"
              />

              <circle cx="52" cy="71" r="24" fill="#ffb347" opacity=".07" />
              <circle cx="138" cy="71" r="24" fill="#ffb347" opacity=".07" />

              <circle className="eye-l" cx="52" cy="71" r="22" fill="url(#eG)" filter="url(#eF)" />
              <circle id="pL" cx="52" cy="71" r="10" fill="#180800" opacity=".88" />
              <circle cx="60" cy="63" r="7" fill="white" opacity=".62" />
              <circle cx="57" cy="62" r="2.5" fill="white" opacity=".96" />
              <circle cx="66" cy="76" r="2" fill="white" opacity=".25" />

              <circle className="eye-r" cx="138" cy="71" r="22" fill="url(#eG)" filter="url(#eF)" />
              <circle id="pR" cx="138" cy="71" r="10" fill="#180800" opacity=".88" />
              <circle cx="146" cy="63" r="7" fill="white" opacity=".62" />
              <circle cx="143" cy="62" r="2.5" fill="white" opacity=".96" />
              <circle cx="152" cy="76" r="2" fill="white" opacity=".25" />

              <ellipse id="bl-l" cx="22" cy="92" rx="16" ry="11" fill="url(#blG)" opacity=".75" />
              <ellipse id="bl-r" cx="168" cy="92" rx="16" ry="11" fill="url(#blG)" opacity=".75" />

              <rect id="lid-l" x="19" y="38" width="68" height="0" rx="24" fill="#07070f" opacity="0" />
              <rect id="lid-r" x="105" y="38" width="68" height="0" rx="24" fill="#07070f" opacity="0" />
              <rect id="sq-l" x="19" y="71" width="68" height="0" fill="#07070f" opacity="0" />
              <rect id="sq-r" x="105" y="71" width="68" height="0" fill="#07070f" opacity="0" />

              <ellipse id="tear-l" cx="42" cy="90" rx="3.5" ry="5" fill="#7adeff" opacity="0" />
              <ellipse id="tear-r" cx="128" cy="90" rx="3.5" ry="5" fill="#7adeff" opacity="0" />

              <g id="tdots" opacity="0">
                <circle cx="76" cy="118" r="4.5" fill="#00d4ff">
                  <animate attributeName="opacity" values=".12;1;.12" dur="1.1s" begin="0s" repeatCount="indefinite" />
                </circle>
                <circle cx="95" cy="118" r="4.5" fill="#00d4ff">
                  <animate attributeName="opacity" values=".12;1;.12" dur="1.1s" begin=".37s" repeatCount="indefinite" />
                </circle>
                <circle cx="114" cy="118" r="4.5" fill="#00d4ff">
                  <animate attributeName="opacity" values=".12;1;.12" dur="1.1s" begin=".74s" repeatCount="indefinite" />
                </circle>
              </g>

              <g id="zzz" opacity="0">
                <text
                  id="zzz-a"
                  x="162"
                  y="38"
                  fontSize="14"
                  fill="#00d4ff"
                  fontFamily="Nunito,sans-serif"
                  fontWeight="900"
                  opacity="0"
                >
                  z
                </text>
                <text
                  id="zzz-b"
                  x="173"
                  y="20"
                  fontSize="20"
                  fill="#00d4ff"
                  fontFamily="Nunito,sans-serif"
                  fontWeight="900"
                  opacity="0"
                >
                  Z
                </text>
              </g>

              <g id="qmark" opacity="0">
                <rect x="158" y="10" width="30" height="30" rx="10" fill="#10121e" stroke="#00d4ff" strokeWidth="1.3" />
                <text x="173" y="31" textAnchor="middle" fontSize="17" fill="#00d4ff" fontFamily="Nunito,sans-serif" fontWeight="900">
                  ?
                </text>
              </g>

              <rect
                id="ar-l"
                x="14"
                y="34"
                width="76"
                height="74"
                rx="28"
                fill="none"
                stroke="#00d4ff"
                strokeWidth="0"
                opacity="0"
              />
              <rect
                id="ar-r"
                x="100"
                y="34"
                width="76"
                height="74"
                rx="28"
                fill="none"
                stroke="#00d4ff"
                strokeWidth="0"
                opacity="0"
              />

              <path
                id="m-smile"
                d="M62 112 Q95 128 128 112"
                fill="none"
                stroke="#00d4ff"
                strokeWidth="2.8"
                strokeLinecap="round"
                opacity=".88"
              />
              <path
                id="m-open"
                d="M65 110 Q95 130 125 110"
                fill="#040408"
                stroke="#00d4ff"
                strokeWidth="2.8"
                strokeLinecap="round"
                opacity="0"
              />
              <path
                id="m-frown"
                d="M65 120 Q95 106 125 120"
                fill="none"
                stroke="#00d4ff"
                strokeWidth="2.8"
                strokeLinecap="round"
                opacity="0"
              />
              <line
                id="m-flat"
                x1="76"
                y1="115"
                x2="114"
                y2="115"
                stroke="#00d4ff"
                strokeWidth="2.2"
                strokeLinecap="round"
                opacity="0"
              />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
});

export default WalleMascot;
