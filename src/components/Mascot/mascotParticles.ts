/** DOM confetti particles (matches mascot_test/walle_mascot_cute.html). */
export function spawnMascotParticles(
  walleEl: HTMLElement,
  particlesEl: HTMLElement,
  count: number,
) {
  const wr = walleEl.getBoundingClientRect();
  const cr = particlesEl.getBoundingClientRect();
  const cx = wr.left - cr.left + wr.width * 0.5;
  const cy = wr.top - cr.top + wr.height * 0.28;
  const cols = [
    "#00d4ff",
    "#ffb347",
    "#00ff88",
    "#ffe066",
    "#ff6eb4",
    "#fff",
    "#a78bff",
  ];

  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.className = "mascot-particle";
    const sz = 4 + Math.random() * 8;
    const ang = ((Math.PI * 2) / count) * i + Math.random() * 0.7;
    const d = 40 + Math.random() * 72;
    const px = Math.cos(ang) * d;
    const py = Math.sin(ang) * d - 30;
    const col = cols[i % cols.length];
    p.style.cssText = `width:${sz}px;height:${sz}px;left:${cx}px;top:${cy}px;background:${col};--px:${px}px;--py:${py}px;animation:mascot-p-fly 0.9s ease-out ${i * 0.065}s forwards;box-shadow:0 0 9px ${col};`;
    particlesEl.appendChild(p);
    window.setTimeout(() => p.remove(), 1100 + i * 65);
  }
}
