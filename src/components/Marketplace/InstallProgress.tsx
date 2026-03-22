export default function InstallProgress({ phase }: { phase: string }) {
  return (
    <div className="text-xs" style={{ color: "var(--walle-text-muted)" }}>
      {phase}
    </div>
  );
}
