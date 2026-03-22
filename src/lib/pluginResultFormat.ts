const MAX_DISPLAY_CHARS = 12_000;

export function truncateForDisplay(s: string, max = MAX_DISPLAY_CHARS): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n\n… (truncated)`;
}

/** Format run_plugin_action JSON for a chat line (shell, workflow, generic). */
export function formatPluginResult(plugin: string, result: unknown): string {
  if (result === null || typeof result !== "object") {
    return `**Result** (${plugin}): ${String(result)}`;
  }
  const o = result as Record<string, unknown>;

  switch (plugin) {
    case "shell": {
      const stdout = String(o.stdout ?? "");
      const stderr = String(o.stderr ?? "");
      const exit = o.exit_code;
      const parts: string[] = [];
      if (stdout) parts.push(`stdout:\n${truncateForDisplay(stdout)}`);
      if (stderr) parts.push(`stderr:\n${truncateForDisplay(stderr)}`);
      const body = parts.length > 0 ? parts.join("\n\n") : "(no output)";
      return `**Result** (shell, exit ${exit ?? "?"}):\n${body}`;
    }
    case "run_workflow": {
      const summary = String(o.summary ?? JSON.stringify(result));
      return `**Result** (workflow):\n${truncateForDisplay(summary)}`;
    }
    case "app_launch":
      return "**Result** (app_launch): Launched.";
    case "notify": {
      if (o.scheduled === true && typeof o.delay_seconds === "number") {
        const m = Math.round(o.delay_seconds / 60);
        const human =
          o.delay_seconds >= 60 && o.delay_seconds % 60 === 0
            ? `${m} minute${m === 1 ? "" : "s"}`
            : `${o.delay_seconds} seconds`;
        return `**Result** (notify): Scheduled — toast in ${human}.`;
      }
      return "**Result** (notify): Sent.";
    }
    case "save_workflow":
      return "**Result** (save_workflow): Saved.";
    case "schedule_create":
      return "**Result** (schedule_create): Saved.";
    case "schedule_list": {
      const rows = o.schedules;
      if (Array.isArray(rows)) {
        return `**Result** (schedule_list): ${rows.length} schedule(s).`;
      }
      return "**Result** (schedule_list): (no list)";
    }
    case "schedule_delete": {
      const n = o.deleted;
      return `**Result** (schedule_delete): removed ${typeof n === "number" ? n : "?"} row(s).`;
    }
    case "git_status":
    case "git_log":
    case "git_diff":
    case "git_commit":
    case "git_push":
    case "git_checkout": {
      const out = String(o.stdout ?? "").trim();
      return `**Result** (${plugin}):\n${truncateForDisplay(out || "(no output)")}`;
    }
    case "external":
    case "ext_shell": {
      const stdout = String(o.stdout ?? "");
      const stderr = String(o.stderr ?? "");
      const exit = o.exit_code;
      const parts: string[] = [];
      if (stdout) parts.push(`stdout:\n${truncateForDisplay(stdout)}`);
      if (stderr) parts.push(`stderr:\n${truncateForDisplay(stderr)}`);
      const body = parts.length > 0 ? parts.join("\n\n") : "(no output)";
      return `**Result** (external shell, exit ${exit ?? "?"}):\n${body}`;
    }
    default:
      return `**Result** (${plugin}):\n${truncateForDisplay(JSON.stringify(result, null, 2))}`;
  }
}
