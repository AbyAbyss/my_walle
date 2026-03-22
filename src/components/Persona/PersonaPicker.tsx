/** Persona selection — uses `persona.active` in walle.config.json (Phase 3). */
export default function PersonaPicker() {
  return (
    <div className="text-xs" style={{ color: "var(--walle-text-muted)" }}>
      Install personas under ~/.walle/personas/&lt;id&gt;/persona.json and set{" "}
      <code>persona.active</code> in config.
    </div>
  );
}
