import type { Emotion } from "../../lib/emotion";

export type DuDuCrestState = "rest" | "raised" | "alert" | "flattened" | "excited";

const CREST_TRANSFORMS: Record<DuDuCrestState, [string, string, string]> = {
  rest: ["rotate(0)", "translateY(0) scaleY(1)", "rotate(0)"],
  raised: [
    "rotate(-18deg) translateY(-8px)",
    "translateY(-12px) scaleY(1.3)",
    "rotate(18deg) translateY(-8px)",
  ],
  alert: [
    "rotate(-28deg) translateY(-14px)",
    "translateY(-18px) scaleY(1.5)",
    "rotate(28deg) translateY(-14px)",
  ],
  flattened: [
    "rotate(8deg) translateY(5px)",
    "translateY(4px) scaleY(0.6)",
    "rotate(-8deg) translateY(5px)",
  ],
  excited: [
    "rotate(-22deg) translateY(-10px)",
    "translateY(-16px) scaleY(1.4)",
    "rotate(22deg) translateY(-10px)",
  ],
};

export function setDuDuCrest(root: HTMLElement, state: DuDuCrestState) {
  const crestL = root.querySelector("#crest-l") as SVGGElement | null;
  const crestC = root.querySelector("#crest-c") as SVGGElement | null;
  const crestR = root.querySelector("#crest-r") as SVGGElement | null;
  const [l, c, r] = CREST_TRANSFORMS[state];
  if (crestL) crestL.style.transform = l;
  if (crestC) crestC.style.transform = c;
  if (crestR) crestR.style.transform = r;
}

function setDuDuPuff(root: HTMLElement, scale: number) {
  const bodyPuf = root.querySelector("#body-puff") as SVGGElement | null;
  if (!bodyPuf) return;
  bodyPuf.style.transform = scale !== 1 ? `scale(${scale})` : "";
}

function setDuDuPinEyes(root: HTMLElement, on: boolean, pupilR: number) {
  ["pL", "pR"].forEach((id) => {
    const el = root.querySelector(`#${id}`) as SVGCircleElement | null;
    if (!el) return;
    el.setAttribute("r", on ? "3" : String(pupilR));
  });
  root.querySelectorAll(".eye-l, .eye-r").forEach((el) => {
    const c = el as SVGCircleElement;
    if (on) {
      c.style.filter = "drop-shadow(0 0 8px #ff4444)";
      c.setAttribute("fill", "#050300");
    } else {
      c.style.filter = "";
      c.setAttribute("fill", "url(#dudu-eyeG)");
    }
  });
}

/** Per-emotion visual state (ported from mascot_test/walle_mascot_bird.html). */
const ES: Record<
  Emotion,
  {
    ps: number;
    lid: number;
    sq: number;
    tear: number;
    td: number;
    zzz: number;
    qm: number;
    ar: number;
    bl: number;
    heart: number;
    music: number;
    crest: DuDuCrestState;
    puff: number;
    pin: boolean;
  }
> = {
  idle: {
    ps: 6,
    lid: 0,
    sq: 0,
    tear: 0,
    td: 0,
    zzz: 0,
    qm: 0,
    ar: 0,
    bl: 0.7,
    heart: 0,
    music: 0,
    crest: "rest",
    puff: 1,
    pin: false,
  },
  thinking: {
    ps: 5,
    lid: 0,
    sq: 0,
    tear: 0,
    td: 1,
    zzz: 0,
    qm: 0,
    ar: 0,
    bl: 0.3,
    heart: 0,
    music: 0,
    crest: "rest",
    puff: 1,
    pin: false,
  },
  happy: {
    ps: 8,
    lid: 0,
    sq: 0,
    tear: 0,
    td: 0,
    zzz: 0,
    qm: 0,
    ar: 0,
    bl: 1,
    heart: 1,
    music: 1,
    crest: "excited",
    puff: 1.08,
    pin: false,
  },
  sad: {
    ps: 4,
    lid: 0,
    sq: 0,
    tear: 0.9,
    td: 0,
    zzz: 0,
    qm: 0,
    ar: 0,
    bl: 0,
    heart: 0,
    music: 0,
    crest: "flattened",
    puff: 1,
    pin: false,
  },
  alert: {
    ps: 3,
    lid: 0,
    sq: 0,
    tear: 0,
    td: 0,
    zzz: 0,
    qm: 0,
    ar: 0.9,
    bl: 0,
    heart: 0,
    music: 0,
    crest: "alert",
    puff: 1.05,
    pin: true,
  },
  focused: {
    ps: 5,
    lid: 0,
    sq: 14,
    tear: 0,
    td: 0,
    zzz: 0,
    qm: 0,
    ar: 0,
    bl: 0.2,
    heart: 0,
    music: 0,
    crest: "raised",
    puff: 1,
    pin: false,
  },
  sleeping: {
    ps: 0,
    lid: 12,
    sq: 0,
    tear: 0,
    td: 0,
    zzz: 1,
    qm: 0,
    ar: 0,
    bl: 0.25,
    heart: 0,
    music: 0,
    crest: "flattened",
    puff: 1.1,
    pin: false,
  },
};

export interface DuDuEmotionApi {
  setBeakTarget: (v: number) => void;
  clearChirp: () => void;
}

export function applyDuDuEmotionDom(root: HTMLElement, emotion: Emotion, api: DuDuEmotionApi) {
  const s = ES[emotion];
  if (!s) return;

  api.clearChirp();
  api.setBeakTarget(0);

  ["pL", "pR"].forEach((id) => {
    const el = root.querySelector(`#${id}`) as SVGCircleElement | null;
    if (!el) return;
    el.setAttribute("r", String(s.ps));
  });

  ["lid-l", "lid-r"].forEach((id) => {
    const el = root.querySelector(`#${id}`) as SVGRectElement | null;
    if (!el) return;
    el.setAttribute("height", String(s.lid));
    el.setAttribute("opacity", s.lid > 0 ? "1" : "0");
  });

  ["sq-l", "sq-r"].forEach((id) => {
    const el = root.querySelector(`#${id}`) as SVGRectElement | null;
    if (!el) return;
    el.setAttribute("height", String(s.sq));
    el.setAttribute("opacity", s.sq > 0 ? "1" : "0");
  });

  ["tear-l", "tear-r"].forEach((id) => {
    const el = root.querySelector(`#${id}`) as SVGElement | null;
    if (!el) return;
    el.setAttribute("opacity", String(s.tear));
  });

  const tdots = root.querySelector("#tdots") as SVGGElement | null;
  if (tdots) tdots.style.opacity = String(s.td);

  const zzz = root.querySelector("#zzz") as SVGGElement | null;
  if (zzz) zzz.style.opacity = String(s.zzz);

  const qmark = root.querySelector("#qmark") as SVGGElement | null;
  if (qmark) qmark.style.opacity = String(s.qm);

  const ar = root.querySelector("#alert-ring") as SVGCircleElement | null;
  if (ar) {
    ar.setAttribute("r", s.ar > 0 ? "65" : "0");
    ar.setAttribute("stroke-width", s.ar > 0 ? "3" : "0");
    ar.setAttribute("opacity", String(s.ar));
    ar.setAttribute("stroke", s.ar > 0 ? "#ff4444" : "transparent");
  }

  ["bl-l", "bl-r"].forEach((id) => {
    const el = root.querySelector(`#${id}`) as SVGElement | null;
    if (!el) return;
    el.setAttribute("opacity", String(s.bl));
  });

  const heart = root.querySelector("#heart-float") as SVGGElement | null;
  if (heart) heart.style.opacity = String(s.heart);

  const music = root.querySelector("#music-notes") as SVGGElement | null;
  if (music) music.style.opacity = String(s.music);

  setDuDuCrest(root, s.crest);
  setDuDuPuff(root, s.puff);
  setDuDuPinEyes(root, s.pin, s.ps);

  if (emotion === "alert") api.setBeakTarget(0.4);
  if (emotion === "sleeping") api.setBeakTarget(0);
  if (emotion === "sad") api.setBeakTarget(0.1);
}
