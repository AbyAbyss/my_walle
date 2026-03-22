import { forwardRef, useCallback, useEffect, useRef } from "react";

import type { Animation } from "../../lib/animation";
import type { Emotion } from "../../lib/emotion";
import { playDuduLong, playDuduShort } from "../../lib/mascotSounds";
import { applyDuDuEmotionDom, setDuDuCrest } from "./mascotApplyEmotionDuDu";
import { spawnMascotParticles } from "./mascotParticles";

const DUDU_BUBBLE_MSGS: Record<Emotion, string[]> = {
  idle: ["Pip! 🦜", "Whatcha doing?", "Scratch my head?", "*chirp*", "Hello!!", "*whistle*"],
  thinking: ["Hmm...", "Pip pip...", "*head tilt*", "One sec~", "..."],
  happy: ["SQUAWK! 🎉", "Yay yay yay!", "*flaps wildly*", "WHEEE! ✨", "Best day ever!"],
  sad: ["Pip... 😞", "No scratchies?", "*sad chirp*", "Come back..."],
  alert: ["SQUAWK! ⚠️", "DANGER!", "*alarm call*", "Watch out!!", "INTRUDER!"],
  focused: ["Shhh...", "*stares intensely*", "On it.", "Pip.", "Concentrating."],
  sleeping: ["Zzz... 💤", "*tiny snore*", "Shhh~", "...zz"],
};

const ANIM_BUBBLE: Partial<Record<Animation, string>> = {
  dance: "SQUAWK!! 🎉",
  wave: "Pip pip! 👋",
  thumbs_up: "*approving chirp* 👍",
  confused: "Huh?? 🤔",
  stretch: "Ahhh~ ☀️",
  excited_run: "WHEEE! 🦜",
  pet: "*happy chirp* 💚",
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

const DuDuMascot = forwardRef<
  HTMLDivElement,
  { emotion: Emotion; animation: Animation; soundsEnabled: boolean; onPet: () => void }
>(function DuDuMascot({ emotion, animation, soundsEnabled, onPet }, ref) {
  const pointerDown = useRef<{ x: number; y: number } | null>(null);
  const particlesRef = useRef<HTMLDivElement>(null);
  const duduRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const beakOpenRef = useRef(0);
  const beakTargetRef = useRef(0);
  const chirpTimersRef = useRef<number[]>([]);
  const rafRef = useRef<number | null>(null);
  const busyRef = useRef(false);

  const setDuduRef = useCallback(
    (node: HTMLDivElement | null) => {
      duduRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [ref],
  );

  const showBubble = useCallback((text: string) => {
    const el = bubbleRef.current;
    if (!el) return;
    if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    el.textContent = text;
    el.classList.add("show");
    bubbleTimerRef.current = setTimeout(() => {
      el.classList.remove("show");
      bubbleTimerRef.current = null;
    }, 2700);
  }, []);

  const setBeakTarget = useCallback((v: number) => {
    beakTargetRef.current = v;
  }, []);

  const clearChirp = useCallback(() => {
    chirpTimersRef.current.forEach((id) => clearTimeout(id));
    chirpTimersRef.current = [];
  }, []);

  const chirp = useCallback(
    (syllables: number) => {
      playDuduShort(soundsEnabled, syllables);
      const root = duduRef.current;
      if (!root) return;
      const seq = [0.9, 0, 0.75, 0, 0.6, 0].slice(0, syllables * 2);
      let i = 0;
      const step = () => {
        if (i >= seq.length) {
          setBeakTarget(0);
          return;
        }
        const v = seq[i++]!;
        setBeakTarget(v);
        const head = root.querySelector(".head-grp") as HTMLElement | null;
        if (head) head.style.transform = v > 0 ? "translateY(1.5px)" : "";
        const t = window.setTimeout(step, 80 + (v === 0 ? 30 : 50));
        chirpTimersRef.current.push(t);
      };
      step();
    },
    [setBeakTarget, soundsEnabled],
  );

  const longChirp = useCallback(
    (onDone?: () => void) => {
      playDuduLong(soundsEnabled);
      const root = duduRef.current;
      if (!root) return;
      const seq = [0.85, 0, 0.7, 0, 0.9, 0, 0.5, 0, 0.75, 0];
      let i = 0;
      const step = () => {
        if (i >= seq.length) {
          setBeakTarget(0);
          onDone?.();
          return;
        }
        const v = seq[i++]!;
        setBeakTarget(v);
        const head = root.querySelector(".head-grp") as HTMLElement | null;
        if (head) head.style.transform = v > 0 ? "translateY(2px)" : "";
        const t = window.setTimeout(step, 70 + (v === 0 ? 25 : 55));
        chirpTimersRef.current.push(t);
      };
      step();
    },
    [setBeakTarget, soundsEnabled],
  );

  useEffect(() => {
    const loop = () => {
      const root = duduRef.current;
      const diff = beakTargetRef.current - beakOpenRef.current;
      beakOpenRef.current += diff * 0.22;
      const open = beakOpenRef.current;
      const lowerDeg = open * 22;
      const upperDeg = open * -4;
      const tongueOp = open > 0.35 ? (open - 0.35) * 1.5 : 0;
      if (root) {
        const beakLower = root.querySelector("#beak-lower") as SVGGElement | null;
        const beakUpper = root.querySelector("#beak-upper") as SVGGElement | null;
        const tongue = root.querySelector("#tongue") as SVGEllipseElement | null;
        if (beakLower) beakLower.style.transform = `rotate(${lowerDeg}deg)`;
        if (beakUpper) beakUpper.style.transform = `rotate(${upperDeg}deg)`;
        if (tongue) tongue.style.opacity = String(tongueOp);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    busyRef.current = animation !== "none";
  }, [animation]);

  useEffect(() => {
    const root = duduRef.current;
    if (!root) return;
    if (animation !== "none") return;
    applyDuDuEmotionDom(root, emotion, { setBeakTarget, clearChirp });
  }, [emotion, animation, setBeakTarget, clearChirp]);

  useEffect(() => {
    if (emotion !== "happy" || animation !== "none") return;
    const t = window.setTimeout(() => {
      longChirp();
    }, 300);
    return () => clearTimeout(t);
  }, [emotion, animation, longChirp]);

  useEffect(() => {
    const msgs = DUDU_BUBBLE_MSGS[emotion];
    if (!msgs?.length) return;
    showBubble(pick(msgs));
  }, [emotion, showBubble]);

  useEffect(() => {
    if (emotion !== "sad") return;
    const root = duduRef.current;
    if (!root) return;

    const tick = () => {
      ["tear-l", "tear-r"].forEach((id, i) => {
        const el = root.querySelector(`#${id}`) as SVGElement | null;
        if (!el) return;
        el.animate(
          [
            { opacity: 0.9, transform: "translateY(0) scaleY(1)" },
            { opacity: 0, transform: "translateY(36px) scaleY(1.6)" },
          ],
          { duration: 1200, delay: i * 400, fill: "none" },
        );
      });
    };
    tick();
    const id = window.setInterval(tick, 1400);
    return () => window.clearInterval(id);
  }, [emotion]);

  useEffect(() => {
    if (animation !== "dance" && animation !== "pet") return;
    const root = duduRef.current;
    const particles = particlesRef.current;
    if (!root || !particles) return;

    let cancelled = false;
    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      const n = animation === "dance" ? 14 : 8;
      spawnMascotParticles(root, particles, n);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [animation]);

  useEffect(() => {
    if (emotion !== "alert") return;
    const root = duduRef.current;
    if (!root) return;
    const id = window.setInterval(() => {
      const ar = root.querySelector("#alert-ring") as SVGCircleElement | null;
      if (!ar) return;
      ar.animate(
        [
          { r: "60px", opacity: 0.9, strokeWidth: "2" },
          { r: "75px", opacity: 0, strokeWidth: "1" },
        ],
        { duration: 700, fill: "none" },
      );
    }, 800);
    return () => window.clearInterval(id);
  }, [emotion]);

  const emotionRef = useRef(emotion);
  const animationRef = useRef(animation);
  emotionRef.current = emotion;
  animationRef.current = animation;

  useEffect(() => {
    const root = duduRef.current;
    if (!root) return;
    const id = window.setInterval(() => {
      const em = emotionRef.current;
      const anim = animationRef.current;
      if (busyRef.current || em !== "idle" || anim !== "none") return;
      const r = Math.random();

      if (r < 0.35) {
        root.querySelectorAll(".eye-l, .eye-r").forEach((el) => {
          el.animate(
            [{ transform: "scaleY(1)" }, { transform: "scaleY(0.04)" }, { transform: "scaleY(1)" }],
            { duration: 110, fill: "none" },
          );
        });
      }

      if (r > 0.55 && r < 0.72) {
        chirp(1 + Math.floor(Math.random() * 2));
        if (Math.random() > 0.5) {
          showBubble(pick(["*chirp*", "Pip!", "*whistle*", "♪"]));
        }
      }

      if (r > 0.78) {
        setDuDuCrest(root, "raised");
        window.setTimeout(() => {
          if (duduRef.current === root && emotionRef.current === "idle") setDuDuCrest(root, "rest");
        }, 600);
      }

      if (r > 0.88) {
        setBeakTarget(0.3);
        window.setTimeout(() => {
          setBeakTarget(0);
        }, 400);
      }
    }, 2800);
    return () => window.clearInterval(id);
  }, [chirp, showBubble, setBeakTarget]);

  useEffect(() => {
    const root = duduRef.current;
    if (!root) return;

    if (animation === "none") {
      return;
    }

    const msg = ANIM_BUBBLE[animation];
    if (msg) showBubble(msg);

    if (animation === "dance") {
      setDuDuCrest(root, "excited");
      longChirp();
    }
    if (animation === "wave") {
      window.setTimeout(() => chirp(2), 300);
    }
    if (animation === "thumbs_up") {
      window.setTimeout(() => chirp(1), 400);
    }
    if (animation === "confused") {
      setBeakTarget(0.15);
      setDuDuCrest(root, "flattened");
    }
    if (animation === "stretch") {
      setDuDuCrest(root, "raised");
      window.setTimeout(() => chirp(2), 500);
    }
    if (animation === "excited_run") {
      setDuDuCrest(root, "excited");
      window.setTimeout(() => longChirp(), 200);
    }
    if (animation === "pet") {
      setDuDuCrest(root, "excited");
      longChirp();
    }
  }, [animation, chirp, longChirp, setBeakTarget, showBubble]);

  const className = [emotion, animation !== "none" ? animation : ""].filter(Boolean).join(" ");

  return (
    <div className="mascot-scene">
      <div ref={particlesRef} className="mascot-particles" id="mascot-particles-dudu" aria-hidden />
      <div
        ref={setDuduRef}
        id="dudu"
        className={className}
        style={{
          position: "relative",
          width: 230,
          height: 310,
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
        <div ref={bubbleRef} className="dudu-bubble" />
        <svg
          className="dudu-svg"
          viewBox="0 0 220 300"
          xmlns="http://www.w3.org/2000/svg"
          width={220}
          height={300}
          aria-hidden
          style={{ display: "block", overflow: "visible" }}
        >
          <defs>
            <radialGradient id="dudu-bodyG" cx="38%" cy="30%">
              <stop offset="0%" stopColor="#5dd96a" />
              <stop offset="55%" stopColor="#3db84a" />
              <stop offset="100%" stopColor="#1e7028" />
            </radialGradient>
            <radialGradient id="dudu-headG" cx="40%" cy="30%">
              <stop offset="0%" stopColor="#62e070" />
              <stop offset="55%" stopColor="#3db84a" />
              <stop offset="100%" stopColor="#22802e" />
            </radialGradient>
            <linearGradient id="dudu-wingLG" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6dd97a" />
              <stop offset="100%" stopColor="#2a8a36" />
            </linearGradient>
            <radialGradient id="dudu-bellyG" cx="50%" cy="35%">
              <stop offset="0%" stopColor="#e8503e" />
              <stop offset="60%" stopColor="#c0392b" />
              <stop offset="100%" stopColor="#8b1a1a" />
            </radialGradient>
            <linearGradient id="dudu-tailG" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#a03a3a" />
              <stop offset="100%" stopColor="#5a1a1a" />
            </linearGradient>
            <radialGradient id="dudu-eyeG" cx="35%" cy="30%">
              <stop offset="0%" stopColor="#3a2800" />
              <stop offset="100%" stopColor="#1a1000" />
            </radialGradient>
            <radialGradient id="dudu-blG">
              <stop offset="0%" stopColor="#ff6eb4" stopOpacity="0.52" />
              <stop offset="100%" stopColor="#ff6eb4" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="dudu-footG" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#c8a060" />
              <stop offset="100%" stopColor="#a07840" />
            </linearGradient>
            <linearGradient id="dudu-beakUpG" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ddd8b0" />
              <stop offset="100%" stopColor="#a8a480" />
            </linearGradient>
            <linearGradient id="dudu-beakLoG" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#b8b490" />
              <stop offset="100%" stopColor="#888870" />
            </linearGradient>
            <filter id="dudu-ds">
              <feDropShadow dx="0" dy="3" stdDeviation="6" floodColor="#000" floodOpacity="0.32" />
            </filter>
            <clipPath id="dudu-eyeLc">
              <circle cx="83" cy="104" r="12" />
            </clipPath>
            <clipPath id="dudu-eyeRc">
              <circle cx="137" cy="104" r="12" />
            </clipPath>
          </defs>

          <ellipse cx="110" cy="296" rx="52" ry="7" fill="#000" opacity="0.2" />

          <g className="whole" filter="url(#dudu-ds)">
            <g className="tail">
              <ellipse cx="110" cy="248" rx="14" ry="42" fill="url(#dudu-tailG)" />
              <ellipse
                cx="96"
                cy="245"
                rx="9"
                ry="38"
                fill="#8b2828"
                transform="rotate(-8 96 210)"
                opacity="0.9"
              />
              <ellipse
                cx="124"
                cy="245"
                rx="9"
                ry="38"
                fill="#8b2828"
                transform="rotate(8 124 210)"
                opacity="0.9"
              />
              <ellipse
                cx="84"
                cy="242"
                rx="6"
                ry="34"
                fill="#6a1c1c"
                transform="rotate(-16 84 210)"
                opacity="0.8"
              />
              <ellipse
                cx="136"
                cy="242"
                rx="6"
                ry="34"
                fill="#6a1c1c"
                transform="rotate(16 136 210)"
                opacity="0.8"
              />
              <ellipse cx="110" cy="282" rx="6" ry="9" fill="#4a6cb5" opacity="0.68" />
              <ellipse cx="96" cy="278" rx="4" ry="7" fill="#4a6cb5" opacity="0.5" />
              <ellipse cx="124" cy="278" rx="4" ry="7" fill="#4a6cb5" opacity="0.5" />
            </g>

            <rect x="52" y="236" width="116" height="10" rx="5" fill="#6b4c28" stroke="#3e2a12" strokeWidth="1" />
            <line x1="70" y1="237" x2="70" y2="245" stroke="#3e2a12" strokeWidth="0.7" opacity="0.5" />
            <line x1="94" y1="237" x2="94" y2="245" stroke="#3e2a12" strokeWidth="0.7" opacity="0.5" />
            <line x1="118" y1="237" x2="118" y2="245" stroke="#3e2a12" strokeWidth="0.7" opacity="0.5" />
            <line x1="142" y1="237" x2="142" y2="245" stroke="#3e2a12" strokeWidth="0.7" opacity="0.5" />

            <line x1="92" y1="226" x2="88" y2="238" stroke="url(#dudu-footG)" strokeWidth="4" strokeLinecap="round" />
            <line x1="128" y1="226" x2="132" y2="238" stroke="url(#dudu-footG)" strokeWidth="4" strokeLinecap="round" />
            <g stroke="url(#dudu-footG)" strokeWidth="2.5" strokeLinecap="round" fill="none">
              <line x1="88" y1="238" x2="78" y2="243" />
              <line x1="88" y1="238" x2="84" y2="246" />
              <line x1="88" y1="238" x2="94" y2="244" />
              <line x1="88" y1="238" x2="98" y2="240" />
            </g>
            <g stroke="url(#dudu-footG)" strokeWidth="2.5" strokeLinecap="round" fill="none">
              <line x1="132" y1="238" x2="122" y2="243" />
              <line x1="132" y1="238" x2="128" y2="246" />
              <line x1="132" y1="238" x2="138" y2="244" />
              <line x1="132" y1="238" x2="142" y2="240" />
            </g>

            <g className="wing-l">
              <ellipse cx="72" cy="168" rx="26" ry="56" fill="url(#dudu-wingLG)" transform="rotate(-12 72 168)" />
              <ellipse cx="60" cy="205" rx="10" ry="18" fill="#1e7028" transform="rotate(-12 60 205)" />
              <ellipse cx="68" cy="212" rx="8" ry="16" fill="#1e7028" transform="rotate(-8 68 212)" />
              <ellipse cx="56" cy="196" rx="5" ry="14" fill="#8fd44a" transform="rotate(-18 56 196)" opacity="0.7" />
              <ellipse cx="78" cy="155" rx="8" ry="22" fill="#7de88a" transform="rotate(-12 78 155)" opacity="0.38" />
            </g>
            <g className="wing-r">
              <ellipse cx="148" cy="168" rx="26" ry="56" fill="url(#dudu-wingLG)" transform="rotate(12 148 168)" />
              <ellipse cx="160" cy="205" rx="10" ry="18" fill="#1e7028" transform="rotate(12 160 205)" />
              <ellipse cx="152" cy="212" rx="8" ry="16" fill="#1e7028" transform="rotate(8 152 212)" />
              <ellipse cx="164" cy="196" rx="5" ry="14" fill="#8fd44a" transform="rotate(18 164 196)" opacity="0.7" />
              <ellipse cx="142" cy="155" rx="8" ry="22" fill="#7de88a" transform="rotate(12 142 155)" opacity="0.38" />
            </g>

            <g id="body-puff">
              <ellipse cx="110" cy="185" rx="52" ry="58" fill="url(#dudu-bodyG)" />
              <ellipse cx="94" cy="158" rx="18" ry="24" fill="#7de88a" opacity="0.26" />
              <ellipse cx="110" cy="196" rx="30" ry="34" fill="url(#dudu-bellyG)" />
              <ellipse cx="104" cy="183" rx="10" ry="14" fill="#f06050" opacity="0.32" />
              <path
                d="M88 175 Q110 170 132 175"
                fill="none"
                stroke="#2a8a36"
                strokeWidth="1.2"
                opacity="0.38"
              />
              <path
                d="M84 183 Q110 177 136 183"
                fill="none"
                stroke="#2a8a36"
                strokeWidth="1.2"
                opacity="0.32"
              />
              <path d="M86 165 Q110 160 134 165" fill="none" stroke="#2a8a36" strokeWidth="1" opacity="0.28" />
            </g>

            <g className="head-grp">
              <circle cx="110" cy="108" r="56" fill="url(#dudu-headG)" />
              <ellipse cx="96" cy="82" rx="22" ry="16" fill="#7de88a" opacity="0.28" />
              <ellipse cx="110" cy="70" rx="38" ry="26" fill="#1a3020" opacity="0.62" />
              <ellipse cx="110" cy="64" rx="30" ry="18" fill="#122018" opacity="0.58" />
              <ellipse cx="110" cy="76" rx="22" ry="16" fill="#3a4a8a" opacity="0.2" />

              <circle cx="83" cy="104" r="20" fill="white" opacity="0.92" />
              <circle cx="137" cy="104" r="20" fill="white" opacity="0.92" />
              <circle cx="83" cy="104" r="18" fill="#e8e4d8" opacity="0.55" />
              <circle cx="137" cy="104" r="18" fill="#e8e4d8" opacity="0.55" />

              <circle cx="83" cy="104" r="13" fill="#0a0800" opacity="0.14" />
              <circle className="eye-l" cx="83" cy="104" r="12" fill="url(#dudu-eyeG)" />
              <circle cx="83" cy="104" r="12" fill="none" stroke="#3a2000" strokeWidth="1.5" opacity="0.45" />
              <circle id="pL" cx="83" cy="104" r="6" fill="#050300" />
              <circle cx="88" cy="99" r="4.5" fill="white" opacity="0.7" />
              <circle cx="86" cy="98" r="1.8" fill="white" opacity="0.94" />
              <circle cx="79" cy="109" r="1.5" fill="white" opacity="0.28" />

              <circle cx="137" cy="104" r="13" fill="#0a0800" opacity="0.14" />
              <circle className="eye-r" cx="137" cy="104" r="12" fill="url(#dudu-eyeG)" />
              <circle cx="137" cy="104" r="12" fill="none" stroke="#3a2000" strokeWidth="1.5" opacity="0.45" />
              <circle id="pR" cx="137" cy="104" r="6" fill="#050300" />
              <circle cx="142" cy="99" r="4.5" fill="white" opacity="0.7" />
              <circle cx="140" cy="98" r="1.8" fill="white" opacity="0.94" />
              <circle cx="133" cy="109" r="1.5" fill="white" opacity="0.28" />

              <rect
                id="lid-l"
                x="71"
                y="92"
                width="24"
                height="0"
                fill="#1a3020"
                opacity="0"
                clipPath="url(#dudu-eyeLc)"
              />
              <rect
                id="lid-r"
                x="125"
                y="92"
                width="24"
                height="0"
                fill="#1a3020"
                opacity="0"
                clipPath="url(#dudu-eyeRc)"
              />
              <rect
                id="sq-l"
                x="71"
                y="104"
                width="24"
                height="0"
                fill="#0a0800"
                opacity="0"
                clipPath="url(#dudu-eyeLc)"
              />
              <rect
                id="sq-r"
                x="125"
                y="104"
                width="24"
                height="0"
                fill="#0a0800"
                opacity="0"
                clipPath="url(#dudu-eyeRc)"
              />

              <ellipse id="tear-l" cx="76" cy="116" rx="3" ry="4.5" fill="#7adeff" opacity="0" />
              <ellipse id="tear-r" cx="130" cy="116" rx="3" ry="4.5" fill="#7adeff" opacity="0" />

              <ellipse cx="64" cy="118" rx="14" ry="10" fill="#3db84a" opacity="0.85" transform="rotate(-5 64 118)" />
              <ellipse cx="64" cy="118" rx="9" ry="6" fill="#5dd96a" opacity="0.48" transform="rotate(-5 64 118)" />
              <ellipse cx="156" cy="118" rx="14" ry="10" fill="#3db84a" opacity="0.85" transform="rotate(5 156 118)" />
              <ellipse cx="156" cy="118" rx="9" ry="6" fill="#5dd96a" opacity="0.48" transform="rotate(5 156 118)" />

              <ellipse id="bl-l" cx="60" cy="112" rx="12" ry="8" fill="url(#dudu-blG)" opacity="0.7" />
              <ellipse id="bl-r" cx="160" cy="112" rx="12" ry="8" fill="url(#dudu-blG)" opacity="0.7" />

              <g id="beak-upper">
                <path
                  d="M99 120 Q110 113 121 120 Q119 130 110 136 Q101 130 99 120Z"
                  fill="url(#dudu-beakUpG)"
                />
                <path
                  d="M104 119 Q110 115 116 119"
                  fill="none"
                  stroke="white"
                  strokeWidth="1.2"
                  opacity="0.35"
                  strokeLinecap="round"
                />
                <path d="M108 134 Q110 138 112 134 Q111 140 110 141 Q109 140 108 134Z" fill="#989870" />
                <ellipse cx="106.5" cy="119" rx="1.4" ry="1" fill="#9a9878" opacity="0.8" />
                <ellipse cx="113.5" cy="119" rx="1.4" ry="1" fill="#9a9878" opacity="0.8" />
                <path d="M104 118 Q110 115 116 118" fill="none" stroke="#b0ac88" strokeWidth="0.7" opacity="0.5" />
              </g>

              <g id="beak-lower">
                <path
                  d="M102 127 Q110 132 118 127 Q115 136 110 138 Q105 136 102 127Z"
                  fill="url(#dudu-beakLoG)"
                />
                <path
                  d="M106 129 Q110 133 114 129"
                  fill="none"
                  stroke="white"
                  strokeWidth="0.8"
                  opacity="0.2"
                  strokeLinecap="round"
                />
                <ellipse id="tongue" cx="110" cy="133" rx="4" ry="2.5" fill="#c05050" opacity="0" />
              </g>

              <g id="tdots" opacity="0">
                <circle cx="96" cy="150" r="4" fill="#3db84a">
                  <animate attributeName="opacity" values="0.1;1;0.1" dur="1.1s" begin="0s" repeatCount="indefinite" />
                </circle>
                <circle cx="110" cy="150" r="4" fill="#3db84a">
                  <animate
                    attributeName="opacity"
                    values="0.1;1;0.1"
                    dur="1.1s"
                    begin="0.37s"
                    repeatCount="indefinite"
                  />
                </circle>
                <circle cx="124" cy="150" r="4" fill="#3db84a">
                  <animate
                    attributeName="opacity"
                    values="0.1;1;0.1"
                    dur="1.1s"
                    begin="0.74s"
                    repeatCount="indefinite"
                  />
                </circle>
              </g>

              <g id="zzz" opacity="0">
                <text
                  id="zzz-a"
                  x="158"
                  y="76"
                  fontSize="14"
                  fill="#3db84a"
                  fontFamily="Nunito,sans-serif"
                  fontWeight="900"
                  opacity="0"
                >
                  z
                </text>
                <text
                  id="zzz-b"
                  x="170"
                  y="58"
                  fontSize="20"
                  fill="#3db84a"
                  fontFamily="Nunito,sans-serif"
                  fontWeight="900"
                  opacity="0"
                >
                  Z
                </text>
              </g>

              <g id="qmark" opacity="0">
                <rect x="158" y="48" width="32" height="32" rx="10" fill="#0d1117" stroke="#3db84a" strokeWidth="1.5" />
                <text
                  x="174"
                  y="71"
                  textAnchor="middle"
                  fontSize="18"
                  fill="#3db84a"
                  fontFamily="Nunito,sans-serif"
                  fontWeight="900"
                >
                  ?
                </text>
              </g>

              <circle id="alert-ring" cx="110" cy="104" r="0" fill="none" stroke="#ff4444" strokeWidth="0" opacity="0" />

              <g id="heart-float" opacity="0">
                <path
                  d="M168 78 C168 74 162 70 158 76 C154 70 148 74 148 78 C148 86 158 92 158 92 C158 92 168 86 168 78Z"
                  fill="#ff6eb4"
                  opacity="0.9"
                />
              </g>

              <g id="music-notes" opacity="0">
                <text x="162" y="92" fontSize="16" fill="#f5d84a" fontFamily="Nunito,sans-serif">
                  ♪
                </text>
                <text x="148" y="76" fontSize="12" fill="#5dd96a" fontFamily="Nunito,sans-serif">
                  ♫
                </text>
              </g>

              <g id="crest-l">
                <ellipse cx="104" cy="56" rx="3.5" ry="11" fill="#1e7028" transform="rotate(-12 104 56)" opacity="0.82" />
                <ellipse cx="103" cy="46" rx="2.5" ry="4" fill="#5dd96a" transform="rotate(-12 103 46)" opacity="0.8" />
              </g>
              <g id="crest-c">
                <ellipse cx="110" cy="52" rx="4" ry="13" fill="#2a8a36" opacity="0.9" />
                <ellipse cx="110" cy="40" rx="2.5" ry="5" fill="#6de87a" opacity="0.9" />
              </g>
              <g id="crest-r">
                <ellipse cx="116" cy="56" rx="3.5" ry="11" fill="#1e7028" transform="rotate(12 116 56)" opacity="0.82" />
                <ellipse cx="117" cy="46" rx="2.5" ry="4" fill="#5dd96a" transform="rotate(12 117 46)" opacity="0.8" />
              </g>
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
});

export default DuDuMascot;
