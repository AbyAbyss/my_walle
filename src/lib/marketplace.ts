import { invoke } from "@tauri-apps/api/core";

export interface RegistryPlugin {
  id: string;
  name: string;
  version: string;
  manifestUrl: string;
  packageUrl: string;
}

export async function searchPlugins(query: string): Promise<RegistryPlugin[]> {
  return invoke<RegistryPlugin[]>("marketplace_search", { query });
}
