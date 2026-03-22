import type { Emotion } from "../../lib/emotion";

/** Visual state table from cute mascot prototype (mouth, eyes, lids, etc.). */
const EMOTION_STATE: Record<
  Emotion,
  {
    ec: string;
    sm: number;
    fm: number;
    flm: number;
    om: number;
    ps: number;
    lid: number;
    sq: number;
    tear: number;
    td: number;
    zzz: number;
    qm: number;
    ar: number;
    bl: number;
  }
> = {
  idle: {
    ec: "url(#eG)",
    sm: 0.88,
    fm: 0,
    flm: 0,
    om: 0,
    ps: 10,
    lid: 0,
    sq: 0,
    tear: 0,
    td: 0,
    zzz: 0,
    qm: 0,
    ar: 0,
    bl: 0.75,
  },
  thinking: {
    ec: "url(#eG)",
    sm: 0,
    fm: 0,
    flm: 0.4,
    om: 0,
    ps: 7,
    lid: 0,
    sq: 0,
    tear: 0,
    td: 1,
    zzz: 0,
    qm: 0,
    ar: 0,
    bl: 0.35,
  },
  happy: {
    ec: "url(#eG)",
    sm: 0,
    fm: 0,
    flm: 0,
    om: 0.9,
    ps: 12,
    lid: 0,
    sq: 0,
    tear: 0,
    td: 0,
    zzz: 0,
    qm: 0,
    ar: 0,
    bl: 1,
  },
  sad: {
    ec: "url(#eG)",
    sm: 0,
    fm: 0.88,
    flm: 0,
    om: 0,
    ps: 7,
    lid: 0,
    sq: 0,
    tear: 0.85,
    td: 0,
    zzz: 0,
    qm: 0,
    ar: 0,
    bl: 0,
  },
  alert: {
    ec: "url(#eGC)",
    sm: 0,
    fm: 0,
    flm: 0,
    om: 0,
    ps: 5,
    lid: 0,
    sq: 0,
    tear: 0,
    td: 0,
    zzz: 0,
    qm: 0,
    ar: 0.92,
    bl: 0,
  },
  focused: {
    ec: "url(#eG)",
    sm: 0.3,
    fm: 0,
    flm: 0,
    om: 0,
    ps: 6,
    lid: 0,
    sq: 24,
    tear: 0,
    td: 0,
    zzz: 0,
    qm: 0,
    ar: 0,
    bl: 0.18,
  },
  sleeping: {
    ec: "url(#eG)",
    sm: 0,
    fm: 0,
    flm: 0.65,
    om: 0,
    ps: 0,
    lid: 66,
    sq: 0,
    tear: 0,
    td: 0,
    zzz: 1,
    qm: 0,
    ar: 0,
    bl: 0.28,
  },
};

export function applyMascotEmotion(root: HTMLElement, emotion: Emotion) {
  const s = EMOTION_STATE[emotion];
  if (!s) return;

  root.querySelectorAll(".eye-l, .eye-r").forEach((el) => {
    (el as SVGElement).setAttribute("fill", s.ec);
  });

  const mouthIds: Record<keyof Pick<typeof s, "sm" | "fm" | "flm" | "om">, string> = {
    sm: "m-smile",
    fm: "m-frown",
    flm: "m-flat",
    om: "m-open",
  };
  (Object.entries(mouthIds) as [keyof typeof mouthIds, string][]).forEach(([k, id]) => {
    const el = root.querySelector(`#${id}`) as SVGElement | null;
    if (el) el.style.opacity = String(s[k] ?? 0);
  });

  ["pL", "pR"].forEach((id) => {
    const el = root.querySelector(`#${id}`) as SVGCircleElement | null;
    if (el) el.setAttribute("r", String(s.ps));
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
    if (el) el.setAttribute("opacity", String(s.tear));
  });

  const tdots = root.querySelector("#tdots") as HTMLElement | null;
  if (tdots) tdots.style.opacity = String(s.td);

  const zzz = root.querySelector("#zzz") as HTMLElement | null;
  if (zzz) zzz.style.opacity = String(s.zzz);

  const qmark = root.querySelector("#qmark") as HTMLElement | null;
  if (qmark) qmark.style.opacity = String(s.qm);

  ["ar-l", "ar-r"].forEach((id) => {
    const el = root.querySelector(`#${id}`) as SVGRectElement | null;
    if (!el) return;
    el.setAttribute("stroke-width", s.ar > 0 ? "2.8" : "0");
    el.setAttribute("opacity", String(s.ar));
  });

  ["bl-l", "bl-r"].forEach((id) => {
    const el = root.querySelector(`#${id}`) as SVGElement | null;
    if (el) el.setAttribute("opacity", String(s.bl));
  });
}
