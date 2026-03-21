import { invoke } from "@tauri-apps/api/core";

export type UserLevel = "simple" | "standard" | "developer";

export function normalizeUserLevel(value: string | undefined): UserLevel {
  if (value === "simple" || value === "standard" || value === "developer") {
    return value;
  }
  return "standard";
}

export interface UiPreferencesPatch {
  onboarding_complete?: boolean;
  last_open_date?: string;
  user_level?: UserLevel | string;
  idle_wander?: boolean;
}

export async function saveUiPreferences(prefs: UiPreferencesPatch): Promise<void> {
  await invoke("save_ui_preferences", { prefs });
}
