import type { RegistryPlugin } from "../../lib/marketplace";

export default function PluginListing({ plugin }: { plugin: RegistryPlugin }) {
  return (
    <div className="text-xs" style={{ color: "var(--walle-text-secondary)" }}>
      <strong>{plugin.name}</strong> · {plugin.version}
    </div>
  );
}
