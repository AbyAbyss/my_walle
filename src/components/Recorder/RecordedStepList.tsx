interface Step {
  label: string;
  plugin: string;
  command?: string | null;
}

export default function RecordedStepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="text-xs space-y-1 text-left pl-4">
      {steps.map((s, i) => (
        <li key={`${s.label}-${i}`}>
          {s.plugin}: {s.label}
          {s.command ? <code className="block opacity-70">{s.command}</code> : null}
        </li>
      ))}
    </ol>
  );
}
