import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";

export function useRecorder() {
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const on = await invoke<boolean>("recorder_is_active");
        setRecording(on);
      } catch {
        setRecording(false);
      }
    })();
  }, []);

  const start = useCallback(async () => {
    await invoke("recorder_start");
    setRecording(true);
  }, []);

  const stop = useCallback(async () => {
    const steps = await invoke<unknown[]>("recorder_stop");
    setRecording(false);
    return steps;
  }, []);

  return { isRecording: recording, startRecording: start, stopRecording: stop };
}
