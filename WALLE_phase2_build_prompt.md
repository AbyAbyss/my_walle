# WALLE — Phase 2 Build Prompt
## For AI Coding Agents (Claude Code / Cursor / Aider)

---

## Context — What Phase 1 Delivered

Before touching anything, understand what already exists:

- Tauri v2 app with two windows: `mascot` (transparent, always-on-top) and `chat` (glass panel)
- WALLE SVG mascot with 7 emotion states driven by CSS classes
- Text + voice input → Anthropic LLM → JSON action plan → executor
- Three built-in plugins: `shell`, `app_launch`, `notify`
- Risk classifier: `safe / moderate / dangerous` with hardcoded pattern rules
- Manual review mode (ActionCard per action) and Auto mode
- Basic workflow system: save named sequences to `walle.config.json`, run by name
- Global hotkeys, draggable mascot, position persistence
- Windows-first, all platform-specific code annotated for macOS swap
- Zero external databases — everything lives in `walle.config.json`

**Do not refactor or rewrite Phase 1 code unless a Phase 2 feature requires an explicit, minimal extension to an existing interface.**

---

## What You Are Building (Phase 2 Scope — Nothing More)

| Feature | Status |
|---|---|
| SQLite memory database | ✅ Build now |
| Structured memory types (habits, preferences, patterns, facts) | ✅ Build now |
| Context awareness (active window + clipboard injection) | ✅ Build now |
| Scheduled tasks (natural language cron) | ✅ Build now |
| "Show your work" mode (live action narration) | ✅ Build now |
| Developer superpower mode (git + repo awareness) | ✅ Build now |
| Plugin UX (non-dev friendly GUI manager) | ✅ Build now |
| Workflow UI editor (visual builder, Phase 1 was conversational only) | ✅ Build now |
| macOS port (complete the platform swap) | ✅ Build now |
| Multi-agent chaining | ❌ Phase 3 |
| Learning mode (observe → infer → suggest) | ❌ Phase 3 |
| Proactive intelligence (background watchers) | ❌ Phase 3 |
| Persona / skin marketplace | ❌ Phase 3 |
| Plugin recorder (watch me, make it a plugin) | ❌ Phase 3 |

---

## New Directory Structure (additions only — do not move Phase 1 files)

```
walle/
├── src-tauri/
│   └── src/
│       ├── commands/
│       │   ├── context.rs          # NEW: active window title + clipboard read
│       │   ├── git.rs              # NEW: git status, log, branch, diff
│       │   └── scheduler.rs        # NEW: cron-style task scheduler
│       ├── agent/
│       │   └── show_work.rs        # NEW: step-by-step narration emitter
│       └── memory/                 # NEW: entire memory subsystem
│           ├── mod.rs
│           ├── db.rs               # SQLite init, migrations
│           ├── writer.rs           # Write memories from conversation
│           └── reader.rs           # Query relevant memories for injection
│
├── src/
│   ├── components/
│   │   ├── Chat/
│   │   │   └── ShowWorkPanel.tsx   # NEW: live step narration display
│   │   ├── Plugins/                # NEW: entire plugin manager UI
│   │   │   ├── PluginManager.tsx
│   │   │   ├── PluginCard.tsx
│   │   │   └── PluginToggle.tsx
│   │   └── Workflows/              # NEW: visual workflow editor
│   │       ├── WorkflowEditor.tsx
│   │       ├── WorkflowStepCard.tsx
│   │       └── WorkflowList.tsx
│   ├── hooks/
│   │   ├── useContext.ts           # NEW: active window + clipboard hook
│   │   ├── useMemory.ts            # NEW: memory read/write hook
│   │   └── useScheduler.ts        # NEW: scheduled task management hook
│   └── lib/
│       ├── memory.ts               # NEW: memory types + query helpers
│       └── gitParser.ts            # NEW: parse git command output
```

---

## Feature 1 — SQLite Memory System

### Philosophy
Phase 1 WALLE had no persistent memory beyond the current session's chat messages and `walle.config.json`. Phase 2 WALLE remembers things across sessions. It knows your habits. It knows you always start Docker before opening VS Code. It knows you prefer concise answers. This is what makes WALLE feel like *your* WALLE over time.

### Database Setup

Use `tauri-plugin-sql` with SQLite. Database file lives at `~/.walle/memory.db`.

```rust
// src-tauri/src/memory/db.rs
// PLATFORM: path uses dirs::data_dir() — works on both Windows and macOS

pub async fn init_db(app: &AppHandle) -> Result<SqlitePool, Error> {
    let db_path = app
        .path()
        .app_data_dir()?
        .join("memory.db");

    let pool = SqlitePool::connect(&format!("sqlite://{}?mode=rwc", db_path.display())).await?;
    sqlx::migrate!("./migrations").run(&pool).await?;
    Ok(pool)
}
```

### Migrations (`src-tauri/migrations/001_initial.sql`)

```sql
CREATE TABLE IF NOT EXISTS memories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    type        TEXT NOT NULL,        -- 'habit' | 'preference' | 'fact' | 'pattern' | 'outcome'
    key         TEXT NOT NULL,        -- short identifier, e.g. "preferred_shell", "morning_workflow"
    value       TEXT NOT NULL,        -- the memory content
    confidence  REAL DEFAULT 1.0,     -- 0.0–1.0, decays over time if contradicted
    source      TEXT DEFAULT 'user',  -- 'user' | 'inferred' | 'observed'
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    last_used   TEXT,
    use_count   INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS conversations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL,
    role        TEXT NOT NULL,        -- 'user' | 'assistant'
    content     TEXT NOT NULL,
    emotion     TEXT,
    timestamp   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_outcomes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    plugin      TEXT NOT NULL,
    command     TEXT NOT NULL,
    success     INTEGER NOT NULL,     -- 1 | 0
    error_msg   TEXT,
    timestamp   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
CREATE INDEX IF NOT EXISTS idx_memories_key  ON memories(key);
CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_id);
```

### Memory Types — Canonical Definitions

```typescript
// src/lib/memory.ts

export type MemoryType =
  | 'habit'       // "user always runs npm install after git pull"
  | 'preference'  // "user prefers concise answers, no bullet points"
  | 'fact'        // "user's project is at C:/dev/myapp"
  | 'pattern'     // "user opens Slack every morning at ~9am"
  | 'outcome'     // "docker-compose up failed 3 times last week"

export interface Memory {
  id: number;
  type: MemoryType;
  key: string;
  value: string;
  confidence: number;   // 0.0–1.0
  source: 'user' | 'inferred' | 'observed';
  created_at: string;
  updated_at: string;
  last_used: string | null;
  use_count: number;
}
```

### Memory Writer — When and What to Write

The LLM response JSON gains an optional `memories` field in Phase 2:

```json
{
  "message": "Done. Docker is up.",
  "emotion": "happy",
  "actions": [...],
  "memories": [
    {
      "type": "habit",
      "key": "docker_before_vscode",
      "value": "User starts docker-compose before opening VS Code",
      "source": "observed"
    }
  ]
}
```

The executor extracts `memories` from every LLM response and writes them to SQLite via `memory/writer.rs`. Confidence starts at 0.7 for `inferred`/`observed`, 1.0 for `user`-sourced.

If a memory with the same `key` already exists: update `value`, bump `use_count`, set `confidence = min(1.0, existing + 0.1)`.

### Memory Reader — What Gets Injected Into Context

Before every LLM call, query the top 8 most relevant memories and inject them into the system prompt:

```rust
// src-tauri/src/memory/reader.rs
pub async fn get_relevant_memories(pool: &SqlitePool, user_message: &str) -> Vec<Memory> {
    // Simple relevance: keyword overlap between user_message and memory value
    // Sort by: use_count DESC, confidence DESC, last_used DESC
    // Limit: 8 memories max — don't bloat the context window
    sqlx::query_as!(Memory,
        "SELECT * FROM memories ORDER BY use_count DESC, confidence DESC LIMIT 8"
    ).fetch_all(pool).await.unwrap_or_default()
}
```

Injected into system prompt as:

```
What I know about you:
- [habit] You always run docker-compose before opening VS Code
- [preference] You prefer concise answers without bullet lists
- [fact] Your main project lives at C:/dev/myapp
- [pattern] You usually start coding sessions around 9am
```

### Updated System Prompt Structure (Phase 2)

```
You are WALLE, a desktop AI companion for {user_name}.

[CONTEXT — injected if available]
Active window: {active_window_title}
Clipboard: {clipboard_preview_50_chars}

[MEMORY — injected from SQLite]
What I know about you:
{memory_list}

[WORKFLOWS]
Saved workflows: {workflow_list}

[PLUGINS]
Available tools: {plugin_list}

Operating system: {os}
Mode: {mode}
Time: {timestamp}

Respond ONLY with this JSON:
{
  "message": "...",
  "emotion": "...",
  "actions": [...],
  "memories": [...],   // NEW in Phase 2 — optional
  "requires_approval": false
}
```

---

## Feature 2 — Context Awareness

WALLE can now see what the user is currently looking at (active window title) and what's in their clipboard. This is injected into every LLM call automatically.

### Active Window Title

```rust
// src-tauri/src/commands/context.rs

#[tauri::command]
pub fn get_active_window() -> Option<String> {
    // PLATFORM: Windows
    use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowTextW};
    unsafe {
        let hwnd = GetForegroundWindow();
        let mut buf = [0u16; 256];
        let len = GetWindowTextW(hwnd, &mut buf);
        if len > 0 {
            Some(String::from_utf16_lossy(&buf[..len as usize]))
        } else {
            None
        }
    }
    // macOS swap: use CGWindowListCopyWindowInfo or NSWorkspace.shared.frontmostApplication
}
```

### Clipboard Read

```rust
#[tauri::command]
pub fn get_clipboard() -> Option<String> {
    // Use tauri-plugin-clipboard-manager (already in Phase 1 for notify)
    // Return first 200 chars only — don't dump huge clipboard content into context
    clipboard::read_text().ok().map(|s| s.chars().take(200).collect())
}
```

### Frontend Hook

```typescript
// src/hooks/useContext.ts
export function useWalleContext() {
  const [activeWindow, setActiveWindow] = useState<string | null>(null);
  const [clipboard, setClipboard]       = useState<string | null>(null);

  // Refresh every time chat panel opens — not on a constant timer
  const refresh = async () => {
    setActiveWindow(await invoke('get_active_window'));
    setClipboard(await invoke('get_clipboard'));
  };

  return { activeWindow, clipboard, refresh };
}
```

Context is injected into every LLM call. It is never shown in the chat UI — it's invisible to the user but visible to WALLE. If the active window title contains "WALLE" itself, omit it (don't inject self-references).

### Privacy Rule

Context injection is opt-in, configurable in `walle.config.json`:

```json
"context": {
  "inject_active_window": true,
  "inject_clipboard": false    // off by default — user must enable explicitly
}
```

Clipboard injection is **off by default**. Show a one-time prompt in the settings panel explaining what it does before the user enables it.

---

## Feature 3 — Scheduled Tasks

Natural language scheduling. "Remind me every day at 9am to review my PRs." WALLE writes it to the database and a background Rust thread fires it.

### Schedule Data Shape

```sql
-- Add to migrations (002_schedules.sql)
CREATE TABLE IF NOT EXISTS schedules (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    cron_expr   TEXT NOT NULL,        -- standard 5-field cron: "0 9 * * *"
    actions     TEXT NOT NULL,        -- JSON array of WalleAction
    enabled     INTEGER DEFAULT 1,
    last_run    TEXT,
    created_at  TEXT NOT NULL
);
```

### Natural Language → Cron

The LLM converts natural language to cron expressions. Add this to the system prompt:

```
When a user asks to schedule something, use the "schedule_create" plugin.
Convert their timing to a valid 5-field cron expression.
Examples:
  "every day at 9am"         → "0 9 * * *"
  "every Monday morning"     → "0 9 * * 1"
  "every hour"               → "0 * * * *"
  "every weekday at 6pm"     → "0 18 * * 1-5"
```

### Scheduler (Rust background thread)

```rust
// src-tauri/src/commands/scheduler.rs
// Runs as a background task spawned at app startup
// Checks schedules every 60 seconds
// On match: emits "schedule:fire" event to frontend with the actions payload
// Frontend executor picks it up and runs through the normal action pipeline

pub fn start_scheduler(app: AppHandle, pool: SqlitePool) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(60)).await;
            let due = get_due_schedules(&pool).await;
            for schedule in due {
                app.emit_all("schedule:fire", &schedule).ok();
                update_last_run(&pool, schedule.id).await.ok();
            }
        }
    });
}
```

### New Plugin Types for Executor

- `schedule_create` — writes a new schedule to SQLite
- `schedule_list` — returns all active schedules
- `schedule_delete` — removes a schedule by name or id

### Schedule UI (minimal, in settings panel)

Show a list of active schedules. Each row: name, cron expression in human-readable form ("every day at 9:00 AM"), enabled toggle, delete button. No creation UI — creation is conversational.

---

## Feature 4 — "Show Your Work" Mode

When enabled, WALLE narrates every step of what it's doing in real time, like a live terminal but in plain English. This builds trust, especially for new users who aren't sure what WALLE is doing under the hood.

### How It Works

A new boolean in config: `"show_work": true`. When enabled, the executor emits a `work:step` event before and after every action:

```typescript
// Events emitted during execution
{ type: 'work:thinking',  text: 'Figuring out which apps to open...' }
{ type: 'work:action',    text: 'Running: Start-Process "Code"', plugin: 'app_launch' }
{ type: 'work:success',   text: 'VS Code opened successfully' }
{ type: 'work:action',    text: 'Running: docker-compose up -d', plugin: 'shell' }
{ type: 'work:output',    text: 'Container walle_db_1 started\nContainer walle_app_1 started' }
{ type: 'work:success',   text: 'Docker is up' }
{ type: 'work:done',      text: 'All done. Dev environment ready.' }
```

### ShowWorkPanel Component

Rendered inside the chat panel, below the message list, above the input bar. Only visible when `show_work` is true and an action is in progress.

```
┌─ WALLE is working ──────────────────────┐
│  ● Figuring out which apps to open...   │ ← thinking (pulsing dot)
│  ↳ Start-Process "Code"                 │ ← action (cyan, monospace)
│  ✓ VS Code opened                       │ ← success (green)
│  ↳ docker-compose up -d                 │ ← action
│    Container walle_db_1 started         │ ← output (muted, monospace)
│    Container walle_app_1 started        │
│  ✓ Docker is up                         │ ← v 
└─────────────────────────────────────────┘
```

Styling: dark glass card, `--walle-font-mono` for commands and output, `--walle-cyan` for actions, `--walle-green` for success, `--walle-red` for failures. Auto-scrolls to latest step. Collapses after 5 seconds when all steps complete.

Toggle via `Ctrl+Shift+W` (configurable). Also toggleable in settings.

---

## Feature 5 — Developer Superpower Mode

This is WALLE's biggest Phase 2 differentiator — the feature that makes WALLE genuinely useful for developers. When enabled, WALLE understands your current repo, your git state, and can act on it.

### Enable via Config

```json
"developer_mode": {
  "enabled": true,
  "watch_dir": "C:/dev",           // root dir to scan for git repos
  "auto_detect_repo": true,        // detect repo from active window title
  "inject_git_status": true        // include git status in every LLM call
}
```

### Git Context Injection

When `inject_git_status` is true, WALLE runs `git status --short` and `git log --oneline -5` in the detected repo directory before every LLM call, and injects the output:

```
[GIT CONTEXT]
Repo: C:/dev/myapp  (branch: feature/auth)
Status:
  M  src/auth/login.ts
  M  src/auth/logout.ts
  ?? src/auth/refresh.ts
Recent commits:
  a3f2b1c fix: correct token expiry logic
  9d1e4a2 feat: add refresh token endpoint
  ...
```

### New Tauri Commands (`src-tauri/src/commands/git.rs`)

```rust
// PLATFORM: git must be in PATH — same on Windows and macOS

#[tauri::command]
pub async fn git_status(repo_path: String) -> Result<String, String> {
    run_git(&["status", "--short"], &repo_path).await
}

#[tauri::command]
pub async fn git_log(repo_path: String, n: u32) -> Result<String, String> {
    run_git(&["log", "--oneline", &format!("-{}", n)], &repo_path).await
}

#[tauri::command]
pub async fn git_diff(repo_path: String, file: Option<String>) -> Result<String, String> {
    match file {
        Some(f) => run_git(&["diff", "--", &f], &repo_path).await,
        None    => run_git(&["diff", "--stat"], &repo_path).await,
    }
}

#[tauri::command]
pub async fn git_action(repo_path: String, args: Vec<String>) -> Result<String, String> {
    // Used by executor for: git add, git commit, git push
    // These are all 'moderate' risk — always shown in ActionCard
    run_git(&args.iter().map(|s| s.as_str()).collect::<Vec<_>>(), &repo_path).await
}

async fn run_git(args: &[&str], cwd: &str) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|e| e.to_string())?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
```

### New Plugin Types for Executor

```typescript
// All git plugins are 'moderate' risk minimum
// git push, git reset, git rebase are 'dangerous'

{ plugin: 'git_status',   params: { repo_path: string } }
{ plugin: 'git_commit',   params: { repo_path: string, message: string } }
{ plugin: 'git_push',     params: { repo_path: string, remote?: string, branch?: string } }
{ plugin: 'git_diff',     params: { repo_path: string, file?: string } }
{ plugin: 'git_checkout', params: { repo_path: string, branch: string } }
{ plugin: 'git_log',      params: { repo_path: string, n?: number } }
```

### Risk Classification Additions (extend Phase 1 riskClassifier.ts)

```typescript
// Add to RISK_RULES in riskClassifier.ts:
{ patterns: [/git\s+push/i, /git\s+reset\s+--hard/i, /git\s+rebase/i],
  level: 'dangerous', reason: 'Destructive or remote git operation' },
{ patterns: [/git\s+(commit|add|checkout|merge)/i],
  level: 'moderate', reason: 'Git state change' },
{ patterns: [/git\s+(status|log|diff|branch|stash\s+list)/i],
  level: 'safe', reason: 'Read-only git operation' },
```

### Repo Auto-Detection

When `auto_detect_repo` is true, WALLE checks the active window title for known IDE patterns and extracts the repo path:

```typescript
// src/lib/gitParser.ts
export function detectRepoFromWindow(windowTitle: string, watchDir: string): string | null {
  // VS Code pattern: "filename.ts — project-name — Visual Studio Code"
  // IntelliJ pattern: "project-name – ...IntelliJ IDEA"
  // Extract project name, find matching dir under watchDir
  const vscodeMatch = windowTitle.match(/—\s+(.+?)\s+—\s+Visual Studio Code/);
  if (vscodeMatch) {
    return path.join(watchDir, vscodeMatch[1]);
  }
  return null;
}
```

---

## Feature 6 — Plugin Manager UI

Phase 1 plugins were enabled/disabled only via `walle.config.json`. Phase 2 gives non-developers a proper UI. This is also the foundation for Phase 3's plugin marketplace.

### PluginManager Component

Accessible from the settings panel via a "Plugins" tab.

```
┌─ Plugins ───────────────────────────────────────────┐
│                                                      │
│  Built-in                                            │
│  ┌────────────────────────────────────────────────┐  │
│  │ [⬢] Shell          Run terminal commands  [ON] │  │
│  │ [⬢] App Launcher   Open apps by name     [ON] │  │
│  │ [⬢] Notifications  OS toast alerts       [ON] │  │
│  │ [⬢] Git            Repo-aware git ops    [ON] │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  Installed (from ~/.walle/plugins)                   │
│  ┌────────────────────────────────────────────────┐  │
│  │  No plugins installed yet                      │  │
│  │  [+ Open plugins folder]                       │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  [+ Install from folder]                             │
└──────────────────────────────────────────────────────┘
```

### PluginCard Component

Each plugin card shows:
- Icon (SVG from manifest, fallback to generic hex icon)
- Name + description (from manifest)
- Version badge
- Risk level indicator: which risk levels this plugin can trigger
- Enable/disable toggle — writes immediately to `walle.config.json`
- "Permissions" expandable: what system access this plugin needs

### External Plugin Loader (Phase 2 foundation)

Scan `~/.walle/plugins/` on startup and on file system watch. Each plugin directory must contain `manifest.json`:

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Does something useful",
  "author": "you",
  "permissions": ["shell:execute", "fs:read"],
  "commands": [
    {
      "name": "do_thing",
      "description": "Does the thing",
      "risk": "safe",
      "params": { "target": { "type": "string", "required": true } }
    }
  ]
}
```

In Phase 2, external plugins can only be manifest-declared shell wrappers — they declare a command name and WALLE maps it to a shell command template. Full JS sandbox execution is Phase 3.

---

## Feature 7 — Workflow UI Editor

Phase 1 workflows were created conversationally and stored in JSON. Phase 2 adds a visual editor in the settings panel — users can see, edit, reorder, and delete workflows without talking to WALLE.

### WorkflowEditor Component (Settings Panel → Workflows Tab)

```
┌─ Workflows ─────────────────────────────────────────┐
│                                                      │
│  [+ New Workflow]                                    │
│                                                      │
│  ▼ start work                         [▶ Run] [✎] [✕]│
│    1. Open VS Code      app_launch    [safe]         │
│    2. Open Slack        app_launch    [safe]         │
│    3. docker-compose up shell         [moderate]     │
│    4. Ready notification notify       [safe]         │
│                                                      │
│  ▶ end of day                         [▶ Run] [✎] [✕]│
│                                                      │
└──────────────────────────────────────────────────────┘
```

### WorkflowStepCard

Each step shows: step number, label, plugin type badge, risk badge. Drag to reorder (use `@dnd-kit/core`). Click trash to remove. Click the step to edit params inline.

### New Workflow Creation UI

"+ New Workflow" opens a creation panel:
- Name input
- "Add step" button — opens a step type picker: Shell / App Launch / Notify / Git
- Each step type shows its relevant param inputs (command field, app name field, etc.)
- Save writes to `walle.config.json` and syncs to Zustand store

Conversational creation from Phase 1 still works — the UI is additive, not a replacement.

---

## Feature 8 — macOS Port

Phase 1 annotated every platform-specific line. Phase 2 executes the swap and makes WALLE fully dual-platform.

### Platform Detection (Rust)

```rust
// src-tauri/src/lib.rs
// Use cfg! macro everywhere platform branching is needed

#[cfg(target_os = "windows")]
fn get_shell_cmd(command: &str) -> Command {
    let mut cmd = Command::new("powershell");
    cmd.args(["-NoProfile", "-Command", command]);
    cmd
}

#[cfg(target_os = "macos")]
fn get_shell_cmd(command: &str) -> Command {
    let mut cmd = Command::new("zsh");
    cmd.args(["-c", command]);
    cmd
}
```

### App Launch — macOS

```rust
#[cfg(target_os = "macos")]
pub async fn launch_app(app_name: String) -> Result<(), String> {
    Command::new("open")
        .args(["-a", &app_name])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}
```

### Active Window — macOS

```rust
#[cfg(target_os = "macos")]
pub fn get_active_window() -> Option<String> {
    // Use NSWorkspace.shared.frontmostApplication via objc crate
    // or run: osascript -e 'tell application "System Events" to get name of first process where frontmost is true'
    let output = Command::new("osascript")
        .args(["-e", "tell application \"System Events\" to get name of first process where frontmost is true"])
        .output()
        .ok()?;
    Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
}
```

### Window Transparency — macOS

```rust
// In WebviewWindowBuilder for mascot window — macOS addition
#[cfg(target_os = "macos")]
window.set_window_level(NSFloatingWindowLevel); // stays above all apps
```

### Tauri Config (`tauri.conf.json`) — macOS entitlements

```json
{
  "bundle": {
    "macOS": {
      "entitlements": "entitlements.plist",
      "infoPlist": {
        "NSMicrophoneUsageDescription": "WALLE uses the microphone for voice input",
        "NSAppleEventsUsageDescription": "WALLE uses AppleScript to detect the active application"
      }
    }
  }
}
```

### System Prompt OS Injection

Update the dynamic `{os}` injection to include the shell type:

```typescript
// Windows: "Windows 11 — use PowerShell syntax for shell commands"
// macOS:   "macOS Sonoma — use zsh syntax for shell commands"
const osContext = platform === 'win32'
  ? `Windows — use PowerShell syntax`
  : `macOS — use zsh/bash syntax`;
```

### Build Both Targets

```bash
# Windows
tauri build --target x86_64-pc-windows-msvc

# macOS (run on Mac)
tauri build --target aarch64-apple-darwin   # Apple Silicon
tauri build --target x86_64-apple-darwin    # Intel Mac
```

---

## Updated Config File (`walle.config.json`)

Phase 2 adds these new top-level keys to the existing config:

```json
{
  "context": {
    "inject_active_window": true,
    "inject_clipboard": false
  },
  "developer_mode": {
    "enabled": false,
    "watch_dir": "",
    "auto_detect_repo": true,
    "inject_git_status": true
  },
  "memory": {
    "enabled": true,
    "max_conversation_history": 200,
    "max_memory_injection": 8,
    "db_path": ""
  },
  "show_work": false,
  "schedules": []
}
```

All existing Phase 1 keys remain unchanged.

---

## Updated Zustand Store (additions only)

```typescript
// Add to walleStore.ts — do not remove or rename Phase 1 fields

interface WalleStore {
  // ... all Phase 1 fields unchanged ...

  // Phase 2 additions
  memories: Memory[];
  schedules: Schedule[];
  activeWindow: string | null;
  showWork: boolean;
  workSteps: WorkStep[];
  gitContext: GitContext | null;

  // Actions
  addMemory: (m: Memory) => void;
  updateMemory: (key: string, value: string) => void;
  addSchedule: (s: Schedule) => void;
  removeSchedule: (id: number) => void;
  setActiveWindow: (title: string | null) => void;
  setGitContext: (ctx: GitContext | null) => void;
  addWorkStep: (step: WorkStep) => void;
  clearWorkSteps: () => void;
  toggleShowWork: () => void;
}
```

---

## Build Order — Follow This Exactly

Each step must be complete and committed before starting the next.

### Step 1 — SQLite Foundation
- Add `sqlx` + `tauri-plugin-sql` to `Cargo.toml`
- Create `memory/db.rs`, run migrations
- Verify `memory.db` is created at `~/.walle/memory.db` on first launch
- Write a simple test: insert a memory, read it back

### Step 2 — Conversation Persistence
- Write every user message + WALLE response to `conversations` table
- On app startup, load last 20 messages and restore to chat UI
- Test: close app, reopen, see last conversation

### Step 3 — Memory Writer
- Extract `memories` array from LLM response JSON
- Write to `memories` table with correct type + source
- Test: say "I prefer dark themes" → memory appears in DB with type=`preference`

### Step 4 — Memory Reader + Injection
- Query top 8 relevant memories before each LLM call
- Inject into system prompt
- Test: set a memory manually in DB → WALLE references it in next response

### Step 5 — Context Awareness (Active Window)
- Implement `get_active_window` Tauri command
- Call on chat panel open, inject into system prompt
- Test: have Notepad focused, open WALLE, ask "what am I doing?" → WALLE mentions Notepad

### Step 6 — Context Awareness (Clipboard)
- Implement `get_clipboard` Tauri command  
- Add privacy toggle to settings (off by default)
- Test: copy some text, enable clipboard, ask WALLE "what did I just copy?"

### Step 7 — Show Your Work Mode
- Add `show_work` toggle to config + settings panel
- Implement `work:step` event emitter in executor
- Build `ShowWorkPanel` component
- Test: run a 3-step workflow with `show_work: true` → each step narrated live

### Step 8 — Scheduled Tasks
- Create `schedules` table migration
- Implement background scheduler thread in Rust
- Add `schedule_create`, `schedule_list`, `schedule_delete` plugin types
- Build schedule list UI in settings panel
- Test: "remind me every minute to test" → notification fires every minute → delete it

### Step 9 — Git Commands (Developer Mode)
- Implement all git Tauri commands in `commands/git.rs`
- Add git plugin types to executor
- Extend riskClassifier with git rules
- Test: "what's my git status?" → correct output from actual repo

### Step 10 — Git Context Injection
- Implement `detectRepoFromWindow` in `gitParser.ts`
- Inject git context into system prompt when developer mode is on
- Test: have VS Code open on a git repo → WALLE knows the branch + dirty files

### Step 11 — Plugin Manager UI
- Build `PluginManager`, `PluginCard`, `PluginToggle` components
- Wire enable/disable to `walle.config.json`
- Implement `~/.walle/plugins/` folder watcher
- Implement manifest-declared external plugin loader
- Test: disable Shell plugin → WALLE can no longer run shell commands

### Step 12 — Workflow UI Editor
- Build `WorkflowEditor`, `WorkflowStepCard`, `WorkflowList` components
- Wire to `walle.config.json` workflows array
- Add drag-to-reorder with `@dnd-kit/core`
- Test: create a workflow via UI → run it → all steps execute

### Step 13 — macOS Port
- Replace all `// PLATFORM:` annotated code with `#[cfg(target_os)]` branches
- Test active window detection on macOS
- Test app launch via `open -a` on macOS
- Test shell commands via `zsh -c` on macOS
- Build `.dmg` for both Apple Silicon and Intel

### Step 14 — Integration Pass
- Memory injection is working in every LLM call
- Context injection is working (window + clipboard when enabled)
- Git context injection works when developer mode is on
- All Phase 1 features still work unchanged
- No regressions: run through Phase 1 Definition of Done checklist

### Step 15 — Polish Pass
- ShowWorkPanel animations feel smooth and readable
- Plugin Manager UI matches dark glass design system
- Workflow Editor drag-and-drop is responsive
- Schedule list human-readable cron formatting
- macOS window chrome is clean, no visual artifacts

### Step 16 — Build & Package
- Windows: `.msi` installer (same as Phase 1, with new features)
- macOS: `.dmg` for Apple Silicon + Intel
- Update README with Phase 2 features and config options

---

## What NOT to Build in Phase 2

If you find yourself building any of the following, stop:

- Full JS sandbox execution for plugins (Phase 3)
- Plugin marketplace / store (Phase 3)
- Learning mode — observe patterns and suggest automations (Phase 3)
- Proactive intelligence — background watchers that nudge the user (Phase 3)
- Multi-agent chaining (Phase 3)
- Plugin recorder — "watch me do this, make it a plugin" (Phase 3)
- Trust score per action (Phase 3)
- Persona / skin marketplace (Phase 3)
- AI-generated mascot skins (Phase 3)

Phase 2 is about: **know me, see what I'm doing, act on my dev environment, and show me what you're doing.**

---

## Definition of Done (Phase 2)

WALLE v0.2 is complete when:

- [ ] `memory.db` is created on first launch at `~/.walle/memory.db`
- [ ] Every conversation is persisted and restored on app reopen
- [ ] LLM responses can write memories to SQLite
- [ ] Relevant memories are injected into every LLM call
- [ ] WALLE references past preferences without being asked
- [ ] Active window title is injected into LLM context on chat open
- [ ] Clipboard injection works and is off by default with opt-in prompt
- [ ] Show Your Work mode narrates each action step live in the chat panel
- [ ] Scheduled tasks fire at the correct time via background thread
- [ ] Schedules persist across app restarts
- [ ] `git status`, `git log`, `git diff`, `git commit`, `git push` all work via WALLE
- [ ] Git context (branch + dirty files) is injected when developer mode is on
- [ ] Repo is auto-detected from active VS Code window title
- [ ] Plugin Manager UI shows all built-in plugins with enable/disable toggles
- [ ] External plugins in `~/.walle/plugins/` are loaded and shown in Plugin Manager
- [ ] Workflow Editor shows all saved workflows
- [ ] Workflows can be created, edited, reordered, and deleted via UI
- [ ] All Phase 1 features still work without regression
- [ ] App builds and runs correctly on both Windows and macOS
- [ ] macOS `.dmg` produced for both Apple Silicon and Intel

---

*WALLE v0.2 — Know me. See me. Work with me.*
