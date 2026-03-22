export default function PersonaCard({ name }: { name: string }) {
  return (
    <div className="text-xs px-2 py-1 rounded" style={{ border: "1px solid var(--walle-glass-border)" }}>
      {name}
    </div>
  );
}
