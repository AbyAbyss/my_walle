import { emit } from "@tauri-apps/api/event";

/** Chat listens and reloads config / Zustand from disk. */
export async function notifyConfigChanged(): Promise<void> {
  await emit("walle/config-changed", null);
}

/** Chat listens and runs `run ${name}` like the workflow pill. */
export async function notifyRunWorkflow(name: string): Promise<void> {
  await emit("walle/run-workflow", { name });
}
