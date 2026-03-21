# WALLE (Phase 1 MVP)

Desktop AI companion built with **Tauri v2**, **Rust**, and **React + TypeScript**.

## Prerequisites

- Windows 10/11 (primary target)
- [Rust](https://rustup.rs/) stable
- Node.js 20+ and npm

## First run — API key

On first launch, WALLE opens a **setup** window. Enter your [Anthropic API key](https://console.anthropic.com/). The key is stored in the **OS credential store** via the `keyring` crate — it is **never** written to `walle.config.json` or other project files.

For local development only, you may keep secrets in a **`.env`** file (gitignored). The shipped app does **not** rely on `.env` for the API key.

To change the key later: open the chat panel (**Ctrl+Shift+Space**), click **Settings (⚙)**, use **Change Anthropic API key** (clears the old key, then saves the new one).

## Scripts

```bash
npm install
npm run tauri dev    # Vite + Tauri dev
npm run build        # Frontend production build only
npm run tauri build  # Full desktop installer (e.g. .msi on Windows)
```

If `tauri build` fails with a `--ci` flag error, your environment may be setting `CI` in a way the CLI rejects. Try `CI= npm run tauri build` (Git Bash) or unset `CI`, then run `npm run tauri build` again. The Rust backend can always be built with `cd src-tauri && cargo build --release`.

## Hotkeys (defaults)

| Shortcut | Action |
|----------|--------|
| Ctrl+Shift+Space | Toggle chat panel |
| Ctrl+Shift+V | Voice push-to-talk (from chat window) |

## Project layout (high level)

- `mascot.html` / `chat.html` / `setup.html` — multi-page Vite entries
- `src-tauri/src/agent/llm.rs` — Anthropic Messages API (key read from keychain every call)
- `src-tauri/src/commands/` — shell, app launch, notifications, plugins, workflows
- `src/lib/riskClassifier.ts` — safe / moderate / dangerous gating + confirm typing for dangerous actions

## License

Private / your license here.
