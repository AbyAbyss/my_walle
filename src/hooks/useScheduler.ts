import { invoke } from "@tauri-apps/api/core";
import { useCallback } from "react";

import type { Schedule } from "../store/walleStore";
import { useWalleStore } from "../store/walleStore";

/** Fetches cron schedules into Zustand (`setSchedules`). Call `refresh` when opening Settings or after edits. */
export function useScheduler() {
  const schedules = useWalleStore((s) => s.schedules);
  const setSchedules = useWalleStore((s) => s.setSchedules);

  const refresh = useCallback(async () => {
    const rows = await invoke<Schedule[]>("schedules_list_cmd");
    setSchedules(rows);
  }, [setSchedules]);

  return { schedules, refresh };
}