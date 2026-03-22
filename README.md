# WALLE (Phase 2)

Desktop AI companion built with **Tauri v2**, **Rust**, and **React + TypeScript**. Runs on **Windows** and **macOS** (Linux: shell/workflows work; app launch is not wired).

## Prerequisites

- **Windows** 10/11 or **macOS** 11+
- [Rust](https://rustup.rs/) stable (add macOS targets on a Mac: `rustup target add aarch64-apple-darwin x86_64-apple-darwin`)
- Node.js 20+ and npm

## First run — API key

On first launch, WALLE opens a **setup** window. Enter your provider API key (e.g. Anthropic). Keys are stored in the **OS credential store** via the `keyring` crate — they are **not** written to `walle.config.json`.

To change settings later: open the chat panel (**Ctrl+Shift+Space** on Windows), click **Settings (⚙)**.

## Scripts

```bash
npm install
npm run tauri dev    # Vite + Tauri dev
npm run build        # Frontend production build only
npm run tauri build  # Full desktop bundle (e.g. .msi on Windows, .dmg on macOS)
```

**Windows:** `tauri build` produces an installer (e.g. `.msi`).

**macOS (run on a Mac):**

```bash
npm run tauri build -- --target aarch64-apple-darwin   # Apple Silicon
npm run tauri build -- --target x86_64-apple-darwin    # Intel
```

If `tauri build` fails with a `--ci` flag error, try `CI= npm run tauri build` (Git Bash) or unset `CI`.

## Phase 2 features (summary)

| Area | What it does |
|------|----------------|
| **SQLite** | Conversation history + memory store (`memory.db` under app data) |
| **Memory** | LLM can read/write durable preferences via the `memories` JSON field |
| **Context** | Optional active window title + clipboard preview in the system prompt |
| **Show your work** | Step-by-step narration panel; **Ctrl+Shift+W** to toggle |
| **Schedules** | Cron schedules in SQLite; background tick fires actions to chat |
| **Developer mode** | Git Tauri commands + `[GIT CONTEXT]` when repo is detected from the window title |
| **Plugins** | Settings → **Plugins**: enable/disable built-ins; `~/.walle/plugins` manifests + watcher |
| **Workflows** | Settings → **Workflows**: edit, reorder (drag), run saved workflows |

Shell execution uses **PowerShell** on Windows and **zsh -c** on macOS.

## Config (`walle.config.json`)

Key sections (non-exhaustive):

- `agent` — `mode` (`auto` / `manual_review`), `action_delay_ms`, etc.
- `context` — `inject_active_window`, `inject_clipboard`
- `show_work` — Show your work panel
- `developer_mode` — `enabled`, `watch_dir`, `auto_detect_repo`, `inject_git_status`
- `plugins.enabled` — e.g. `shell`, `app_launch`, `notify`, `git`
- `workflows` — saved multi-step workflows
- `memory` — SQLite memory settings

The app copies the bundled default from the repo on first launch if no config exists.

## Hotkeys (defaults)

| Shortcut | Action |
|----------|--------|
| Ctrl+Shift+Space | Toggle chat panel |
| Ctrl+Shift+V | Voice push-to-talk (from chat window) |
| Ctrl+Shift+W | Toggle Show your work |

## Project layout (high level)

- `mascot.html` / `chat.html` / `setup.html` — multi-page Vite entries
- `src-tauri/src/agent/llm.rs` — system prompt, tool JSON, provider calls
- `src-tauri/src/commands/` — shell, app launch, git, schedules, plugins, workflows
- `src/lib/riskClassifier.ts` — safe / moderate / dangerous gating for actions

## macOS notes

- **Active window** uses AppleScript (`osascript` + System Events). Usage descriptions are merged from `src-tauri/Info.plist`.
- **App launch** uses `open -a`.

## License

Private / your license here.
