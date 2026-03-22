import { invoke } from "@tauri-apps/api/core";

import { detectRepoFromWindow } from "./gitParser";

/** Snapshot read on the Rust side for LLM injection (window + clipboard + optional git root). */
export interface WalleContextPayload {
  activeWindowTitle: string | null;
  clipboardPreview: string | null;
  /** Resolved when developer mode + auto-detect + inject are enabled in config. */
  gitRepoPath: string | null;
}

interface DeveloperModeConfig {
  enabled?: boolean;
  watch_dir?: string;
  auto_detect_repo?: boolean;
  inject_git_status?: boolean;
}

export async function fetchWalleContextForLlm(): Promise<WalleContextPayload> {
  try {
    const [active, clip, raw] = await Promise.all([
      invoke<string | null>("get_active_window"),
      invoke<string | null>("get_clipboard"),
      invoke<string>("get_walle_config"),
    ]);

    let gitRepoPath: string | null = null;
    try {
      const cfg = JSON.parse(raw) as { developer_mode?: DeveloperModeConfig };
      const dm = cfg.developer_mode;
      if (
        dm?.enabled &&
        dm.inject_git_status !== false &&
        dm.auto_detect_repo !== false &&
        typeof dm.watch_dir === "string" &&
        dm.watch_dir.trim()
      ) {
        gitRepoPath = detectRepoFromWindow(active ?? "", dm.watch_dir.trim());
      }
    } catch {
      /* ignore bad config */
    }

    return {
      activeWindowTitle: active ?? null,
      clipboardPreview: clip ?? null,
      gitRepoPath,
    };
  } catch {
    return { activeWindowTitle: null, clipboardPreview: null, gitRepoPath: null };
  }
}
