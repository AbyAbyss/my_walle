/** Join a watch root with a project folder name using the host path style. */
function joinWatchDir(watchDir: string, projectName: string): string {
  const root = watchDir.replace(/[/\\]+$/, "");
  const seg = projectName.replace(/^[/\\]+/, "").replace(/[/\\]+$/, "");
  if (!root || !seg) return "";
  const sep = root.includes("\\") ? "\\" : "/";
  return `${root}${sep}${seg}`;
}

/**
 * Best-effort repo root under `watchDir` from the foreground window title (VS Code, Cursor, IntelliJ-style).
 */
export function detectRepoFromWindow(windowTitle: string, watchDir: string): string | null {
  const root = watchDir.trim();
  const title = windowTitle.trim();
  if (!root || !title) return null;

  const vscodeLike = [
    /[—–]\s*(.+?)\s*[—–]\s*Visual Studio Code\s*$/i,
    /[—–]\s*(.+?)\s*[—–]\s*Cursor\s*$/i,
    /\s-\s(.+?)\s+-\s+Visual Studio Code\s*$/i,
  ];
  for (const re of vscodeLike) {
    const m = title.match(re);
    const project = m?.[1]?.trim();
    if (project) {
      const path = joinWatchDir(root, project);
      return path || null;
    }
  }

  const intellij = title.match(/^(.+?)\s+[—–]\s*.+IntelliJ IDEA\s*$/i);
  const projectIj = intellij?.[1]?.trim();
  if (projectIj) {
    const path = joinWatchDir(root, projectIj);
    return path || null;
  }

  return null;
}
