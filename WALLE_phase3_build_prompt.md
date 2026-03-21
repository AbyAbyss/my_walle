# WALLE — Phase 3 Build Prompt
## For AI Coding Agents (Claude Code / Cursor / Aider)

---

## Context — What Phases 1 & 2 Delivered

Read this carefully before touching anything. Phase 3 builds on a fully working, dual-platform application.

**Phase 1 delivered:**
- Tauri v2 app, two windows: transparent mascot + glass chat panel
- SVG mascot with 7 emotion states (CSS-driven)
- Text + voice → Anthropic LLM → JSON action plan → executor
- Plugins: `shell`, `app_launch`, `notify`
- Risk classifier: `safe / moderate / dangerous` with pattern rules
- Manual review mode (ActionCard) + Auto mode
- Basic workflow system (conversational save + run by name)
- Global hotkeys, draggable mascot, `walle.config.json`

**Phase 2 delivered:**
- SQLite memory: `habits`, `preferences`, `facts`, `patterns`, `outcomes`
- Conversation persistence across sessions
- Memory injection into every LLM call
- Context awareness: active window title + opt-in clipboard injection
- Scheduled tasks: natural language → cron → background Rust thread
- Show Your Work mode: live step narration in chat panel
- Developer mode: git commands, repo auto-detection, git context injection
- Plugin Manager UI: enable/disable built-in + manifest-declared external plugins
- Workflow UI editor: visual drag-and-drop builder
- Full macOS port alongside Windows

**Do not refactor or rewrite Phase 1 or Phase 2 code unless a Phase 3 feature requires an explicit, minimal, clearly-documented extension.**

---

## What You Are Building (Phase 3 Scope — Nothing More)

| Feature | Status |
|---|---|
| Learning mode (pattern engine: observe → infer → suggest) | ✅ Build now |
| Proactive intelligence (configurable background watchers) | ✅ Build now |
| Multi-agent chaining (sub-agent task delegation) | ✅ Build now |
| Full JS plugin sandbox (QuickJS embedded in Rust) | ✅ Build now |
| Plugin marketplace (community install from registry) | ✅ Build now |
| Plugin recorder (watch me → make it a plugin) | ✅ Build now |
| Trust score system (per-action, per-plugin confidence) | ✅ Build now |
| Persona system (swappable mascot skins + voice personalities) | ✅ Build now |
| WALLE Insights dashboard (usage analytics, memory browser) | ✅ Build now |
| Linux port | ✅ Build now |

---

## New Directory Structure (additions only)

```
walle/
├── src-tauri/
│   └── src/
│       ├── agent/
│       │   ├── learning.rs          # NEW: pattern engine, suggestion generator
│       │   ├── proactive.rs         # NEW: background watcher threads
│       │   ├── multi_agent.rs       # NEW: sub-agent spawner + result collector
│       │   └── trust.rs             # NEW: trust score calculator + updater
│       ├── plugins/
│       │   ├── sandbox.rs           # NEW: QuickJS runtime for JS plugins
│       │   ├── registry.rs          # NEW: marketplace registry client
│       │   └── recorder.rs          # NEW: action sequence recorder
│       └── persona/
│           ├── mod.rs               # NEW: persona loader
│           └── voice.rs             # NEW: TTS voice adapter
│
├── src/
│   ├── components/
│   │   ├── Suggestions/             # NEW: proactive suggestion UI
│   │   │   ├── SuggestionBubble.tsx
│   │   │   └── SuggestionDismiss.tsx
│   │   ├── Marketplace/             # NEW: plugin marketplace UI
│   │   │   ├── MarketplacePanel.tsx
│   │   │   ├── PluginListing.tsx
│   │   │   └── InstallProgress.tsx
│   │   ├── Recorder/                # NEW: plugin recorder UI
│   │   │   ├── RecorderBar.tsx
│   │   │   └── RecordedStepList.tsx
│   │   ├── Insights/                # NEW: insights dashboard
│   │   │   ├── InsightsDashboard.tsx
│   │   │   ├── MemoryBrowser.tsx
│   │   │   ├── UsageChart.tsx
│   │   │   └── TrustScorePanel.tsx
│   │   └── Persona/                 # NEW: persona picker + preview
│   │       ├── PersonaPicker.tsx
│   │       └── PersonaCard.tsx
│   ├── hooks/
│   │   ├── useLearning.ts           # NEW: suggestion state + dismiss
│   │   ├── useMultiAgent.ts         # NEW: sub-agent status tracking
│   │   └── useRecorder.ts           # NEW: recording state management
│   └── lib/
│       ├── trustScore.ts            # NEW: trust score types + helpers
│       ├── patternEngine.ts         # NEW: pattern detection on memory data
│       └── marketplace.ts           # NEW: registry API client
```

---

## Feature 1 — Learning Mode (Pattern Engine)

### Philosophy
Phase 2 gave WALLE memory — it knows your habits and preferences. Phase 3 makes WALLE *use* that memory to proactively get smarter. Learning mode observes what you do repeatedly, infers automatable patterns, and offers suggestions once it's confident enough. It never acts without permission. It never nags.

### Pattern Detection Engine

```typescript
// src/lib/patternEngine.ts

export interface Pattern {
  id: string;
  description: string;       // "You run npm install after every git pull"
  trigger: string;           // what precedes the pattern
  action: string;            // what the pattern does
  occurrences: number;       // how many times observed
  confidence: number;        // 0.0–1.0
  last_seen: string;
  suggested: boolean;        // has a suggestion been shown yet?
  accepted: boolean | null;  // null = not responded to yet
}

// Minimum threshold before suggesting
const SUGGEST_THRESHOLD = {
  occurrences: 3,    // seen at least 3 times
  confidence: 0.75,  // 75%+ confidence
};

export function detectPatterns(outcomes: TaskOutcome[]): Pattern[] {
  // Sliding window analysis over task_outcomes table
  // Look for: same command appearing within 60s of another command, 3+ times
  // Look for: same app launched at the same time window on multiple days
  // Look for: same sequence of plugins always executed together
  // Return patterns above SUGGEST_THRESHOLD that haven't been suggested yet
}
```

### New SQLite Table

```sql
-- 003_learning.sql migration
CREATE TABLE IF NOT EXISTS patterns (
    id           TEXT PRIMARY KEY,
    description  TEXT NOT NULL,
    trigger      TEXT NOT NULL,
    action       TEXT NOT NULL,
    occurrences  INTEGER DEFAULT 0,
    confidence   REAL DEFAULT 0.0,
    last_seen    TEXT NOT NULL,
    suggested    INTEGER DEFAULT 0,
    accepted     INTEGER           -- NULL | 1 | 0
);
```

### When Patterns Are Detected

After every task execution, the Rust backend runs the pattern scanner against the last 30 days of `task_outcomes`. New patterns above threshold are written to the `patterns` table and emitted as `pattern:detected` events to the frontend.

The frontend learning hook picks these up:

```typescript
// src/hooks/useLearning.ts
export function useLearning() {
  const [pendingSuggestion, setPendingSuggestion] = useState<Pattern | null>(null);

  useEffect(() => {
    const unlisten = listen<Pattern>('pattern:detected', (e) => {
      // Only show one suggestion at a time — don't stack
      // Don't show if user is mid-conversation
      setPendingSuggestion(e.payload);
    });
    return () => { unlisten.then(f => f()); };
  }, []);

  const accept  = (p: Pattern) => { invoke('pattern_accept', { id: p.id }); setPendingSuggestion(null); };
  const dismiss = (p: Pattern) => { invoke('pattern_dismiss', { id: p.id }); setPendingSuggestion(null); };

  return { pendingSuggestion, accept, dismiss };
}
```

### Suggestion UX — SuggestionBubble

Appears as a small floating card near WALLE's mascot — not inside the chat panel. WALLE's emotion shifts to `alert` while a suggestion is pending.

```
┌─ WALLE noticed ────────────────────────────────┐
│  You always run npm install after git pull.    │
│  Want me to do that automatically?             │
│                                                │
│  [Yes, automate it]        [No thanks]         │
└────────────────────────────────────────────────┘
```

- Appears only when the chat panel is closed (never interrupts active conversations)
- Auto-dismisses after 30 seconds if no response
- "Yes, automate it" → creates a workflow for the detected pattern
- "No thanks" → marks `accepted = 0`, never suggests this pattern again
- WALLE returns to `idle` emotion after dismissal

### Config

```json
"learning": {
  "enabled": true,
  "min_occurrences": 3,
  "min_confidence": 0.75,
  "suggest_while_busy": false,
  "auto_dismiss_seconds": 30
}
```

---

## Feature 2 — Proactive Intelligence

### Philosophy
WALLE can now watch things in the background and tell you when something needs your attention. This is the most powerful and most dangerous Phase 3 feature. The design principle is: **one nudge, configurable, never spammy, always dismissable.** Users control exactly what WALLE watches. Nothing is on by default.

### Watcher Architecture

Each watcher is a named Rust background task. All watchers are off by default. Users enable them individually in settings.

```rust
// src-tauri/src/agent/proactive.rs

pub enum WatcherKind {
    GitUncommitted,      // "You have uncommitted changes for X hours"
    TestFailures,        // "npm test has failed 3 times since your last commit"
    LongRunningProcess,  // "docker-compose has been running for 8 hours"
    IdleReminder,        // "You haven't committed anything today"
    ScheduledDigest,     // "Here's what you did today" (end-of-day summary)
}

pub struct Watcher {
    kind: WatcherKind,
    enabled: bool,
    check_interval_secs: u64,
    last_nudge: Option<Instant>,
    min_gap_between_nudges_secs: u64,  // prevents spamming
}
```

### Watchers Available in Phase 3

| Watcher | Default | What it does |
|---|---|---|
| `git_uncommitted` | off | Fires if dirty files exist for > `threshold_minutes` without a commit |
| `test_failures` | off | Watches `task_outcomes` for repeated test command failures |
| `long_process` | off | Fires if a shell process has been running longer than `threshold_hours` |
| `idle_digest` | off | End-of-day summary: what you did, what's unfinished |
| `memory_nudge` | off | "You said you'd do X — did you?" (based on user's own past statements) |

### Anti-Spam Rules (hardcoded, not configurable)

These rules are enforced in the watcher loop regardless of user settings:

1. Maximum 1 nudge per watcher per hour
2. Maximum 3 total nudges per day across all watchers
3. No nudges while the chat panel is open
4. No nudges during user-defined quiet hours (set in config)
5. Any watcher that is dismissed 3 times in a row for the same trigger is auto-disabled

### Nudge UX

Same `SuggestionBubble` component as learning mode, with a different icon. WALLE plays `alert` emotion, bubble shows the nudge message, WALLE returns to `idle` after dismissal.

```
┌─ WALLE noticed ────────────────────────────────┐
│  You have 4 uncommitted files in walle/        │
│  Last commit was 3 hours ago.                  │
│                                                │
│  [Open terminal]    [Commit now]    [Dismiss]  │
└────────────────────────────────────────────────┘
```

Action buttons are optional — only shown if WALLE can suggest a direct action. "Commit now" triggers a `git_commit` action through the normal executor (with ActionCard if in manual review mode).

### Config

```json
"proactive": {
  "enabled": false,
  "quiet_hours_start": "22:00",
  "quiet_hours_end": "08:00",
  "max_nudges_per_day": 3,
  "watchers": {
    "git_uncommitted": { "enabled": false, "threshold_minutes": 120 },
    "test_failures":   { "enabled": false, "failure_threshold": 3 },
    "long_process":    { "enabled": false, "threshold_hours": 8 },
    "idle_digest":     { "enabled": false, "trigger_time": "18:00" },
    "memory_nudge":    { "enabled": false }
  }
}
```

---

## Feature 3 — Multi-Agent Chaining

### Philosophy
Some tasks are too big for a single LLM call. Multi-agent chaining lets WALLE break a complex request into sub-tasks, delegate them to parallel or sequential sub-agents, and synthesize the results. The user sees a progress view in the chat panel. Each sub-agent is sandboxed — it can only use the plugins the orchestrator assigns it.

### When WALLE Uses Chaining

The orchestrator LLM decides when to chain. A hint in the system prompt guides it:

```
If a task requires more than 5 sequential actions OR requires parallel work
(e.g. "research X while also setting up Y"), use the "chain" plugin to
delegate to sub-agents. Each sub-agent gets a specific goal and a limited
plugin set. Never chain for tasks that a single plan can handle.
```

### Chain Plugin Type

```typescript
// New plugin type for executor
{
  plugin: 'chain',
  label: 'Delegating to sub-agents',
  risk: 'moderate',
  params: {
    agents: [
      {
        id: 'agent_1',
        goal: 'Find all TODO comments in src/ and list them with file + line',
        plugins: ['shell'],          // limited plugin access
        depends_on: [],              // can run immediately
      },
      {
        id: 'agent_2',
        goal: 'Check if there are open GitHub issues matching these TODOs',
        plugins: ['shell', 'browser'],
        depends_on: ['agent_1'],     // waits for agent_1 result
      },
      {
        id: 'agent_3',
        goal: 'Write a summary report combining both findings',
        plugins: ['notify'],
        depends_on: ['agent_1', 'agent_2'],
      },
    ]
  }
}
```

### Multi-Agent Executor (`src-tauri/src/agent/multi_agent.rs`)

```rust
pub struct SubAgent {
    id: String,
    goal: String,
    allowed_plugins: Vec<String>,
    depends_on: Vec<String>,
    status: AgentStatus,
    result: Option<String>,
}

pub enum AgentStatus {
    Waiting,     // dependency not complete yet
    Running,
    Done(String),
    Failed(String),
}

// Execution:
// 1. Build dependency graph from agents array
// 2. Run agents with no dependencies in parallel (tokio::spawn)
// 3. When a dependency completes, pass its result as context to dependent agents
// 4. Each sub-agent is a fresh LLM call with: goal + result from dependencies + limited plugin list
// 5. Emit progress events to frontend after each agent completes
// 6. Final orchestrator call synthesizes all results into one response
```

### Multi-Agent Progress UI

Inside the chat panel, a chain execution shows as a collapsible progress tree:

```
┌─ WALLE is coordinating ────────────────────────┐
│  ✓  Agent 1: Found 12 TODOs in src/           │
│  ↻  Agent 2: Checking GitHub issues...        │ ← spinner
│  ○  Agent 3: Waiting for agents 1 + 2         │ ← dim, not started
└────────────────────────────────────────────────┘
```

Each row is expandable — click to see the sub-agent's full output. The orchestrator's final synthesis appears as a normal WALLE message after all agents complete.

### Safety Rules for Multi-Agent

- Sub-agents can only use plugins explicitly listed in their `plugins` array
- A sub-agent cannot spawn its own sub-agents (max depth = 1)
- Total chain timeout: 5 minutes — if any agent hangs, the chain fails gracefully
- Each sub-agent's actions go through the same risk classifier and ActionCard flow
- `dangerous` actions within a chain always require approval even in auto mode

---

## Feature 4 — Full JS Plugin Sandbox (QuickJS)

### Philosophy
Phase 2 external plugins were manifest-declared shell wrappers. Phase 3 gives plugin authors real JavaScript execution with a controlled API surface. This is the foundation for the plugin marketplace.

### QuickJS Integration

Use the `rquickjs` crate to embed a QuickJS runtime in Rust.

```rust
// src-tauri/src/plugins/sandbox.rs
use rquickjs::{Context, Runtime, Function, Value};

pub async fn run_plugin_script(
    script: &str,
    input: serde_json::Value,
    allowed_apis: &[&str],        // only expose APIs the plugin declared in manifest
    app: &AppHandle,
) -> Result<serde_json::Value, String> {
    let rt = Runtime::new().unwrap();
    let ctx = Context::full(&rt).unwrap();

    ctx.with(|ctx| {
        // Inject WALLE API surface based on declared permissions
        if allowed_apis.contains(&"shell") {
            inject_shell_api(&ctx, app);
        }
        if allowed_apis.contains(&"notify") {
            inject_notify_api(&ctx, app);
        }
        if allowed_apis.contains(&"storage") {
            inject_storage_api(&ctx, app);
        }
        // Never inject: fs:write, git, system — these require explicit user grants

        // Inject input as global
        ctx.globals().set("input", input).unwrap();

        // Run with timeout — kill if > 10 seconds
        ctx.eval::<Value, _>(script)
    });
}
```

### Plugin JS API Surface

Available to plugin scripts based on declared manifest permissions:

```javascript
// phantom.shell(command) — requires "shell:execute" permission
const result = await phantom.shell("Get-Process | Select-Object -First 5");
// returns: { stdout, stderr, exit_code }

// phantom.notify(title, body) — requires "notify" permission
await phantom.notify("Build complete", "All tests passed");

// phantom.storage.get(key) — requires "storage" permission
const pref = await phantom.storage.get("my_setting");

// phantom.storage.set(key, value) — requires "storage" permission
await phantom.storage.set("last_run", new Date().toISOString());

// phantom.http(url, options) — requires "http" permission
const data = await phantom.http("https://api.github.com/repos/user/repo", {
  method: "GET",
  headers: { "Authorization": "Bearer token" }
});

// NOT available to plugins under any circumstance:
// - File system write outside ~/.walle/plugin-data/
// - Registry access
// - Process spawning beyond phantom.shell()
// - Network access to localhost (prevent SSRF)
```

### Plugin Manifest — Full Format (Phase 3)

```json
{
  "id": "github-issues",
  "name": "GitHub Issues",
  "version": "1.2.0",
  "description": "List, create, and comment on GitHub issues",
  "author": "dev@example.com",
  "license": "MIT",
  "permissions": ["shell:execute", "http", "storage", "notify"],
  "commands": [
    {
      "name": "list_issues",
      "description": "List open issues for the current repo",
      "risk": "safe",
      "params": {
        "repo": { "type": "string", "required": false, "description": "owner/repo (auto-detected if omitted)" }
      },
      "script": "commands/list_issues.js"
    }
  ],
  "icon": "icon.svg",
  "homepage": "https://github.com/dev/walle-github-issues",
  "registry_id": "github-issues@1.2.0"
}
```

### Sandbox Security Rules (hardcoded)

1. Every plugin runs in a fresh QuickJS context — no state shared between runs
2. Execution timeout: 10 seconds hard limit
3. Memory limit: 32MB per execution
4. No access to `localhost` or `127.0.0.1` via `phantom.http`
5. File writes restricted to `~/.walle/plugin-data/{plugin-id}/`
6. Plugin cannot access other plugins' storage namespaces
7. On manifest install: user sees a permission prompt listing every permission. User must explicitly approve each. No approval = plugin not installed.

---

## Feature 5 — Plugin Marketplace

### Architecture

WALLE connects to a hosted registry (a simple JSON API — can be self-hosted or use GitHub Releases as the backend). The registry client is read-only from WALLE's side — no tracking, no analytics sent.

```typescript
// src/lib/marketplace.ts

const REGISTRY_URL = 'https://registry.walle.dev/v1';   // hosted, or self-hostable

export interface RegistryPlugin {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  downloads: number;
  rating: number;         // 1–5, community-sourced
  tags: string[];
  manifest_url: string;   // URL to manifest.json
  package_url: string;    // URL to .walle-plugin zip
  verified: boolean;      // manually reviewed by WALLE team
  last_updated: string;
}

export async function searchPlugins(query: string, page = 1): Promise<RegistryPlugin[]> {
  const res = await fetch(`${REGISTRY_URL}/plugins?q=${query}&page=${page}`);
  return res.json();
}

export async function installPlugin(plugin: RegistryPlugin, app: AppHandle): Promise<void> {
  // 1. Download .walle-plugin zip to temp dir
  // 2. Verify SHA256 checksum against registry
  // 3. Extract to ~/.walle/plugins/{plugin-id}/
  // 4. Show permission prompt — list every requested permission
  // 5. User approves → enable plugin
  // 6. User denies → delete extracted files, do not install
}
```

### Marketplace UI (`MarketplacePanel.tsx`)

Accessible from the Plugin Manager via a "Browse Marketplace" button.

```
┌─ Marketplace ───────────────────────────────────────┐
│  [🔍 Search plugins...]                    [✕]      │
│                                                      │
│  ★ Featured                                          │
│  ┌──────────────────────────────────────────────┐   │
│  │ [✓] GitHub Issues    ★4.8  12k installs      │   │
│  │     List, create, close GitHub issues        │   │
│  │     Permissions: http, storage               │   │
│  │     [Install]                                │   │
│  └──────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────┐   │
│  │ [⬢] Jira Tasks       ★4.3  8k installs       │   │
│  │     Manage Jira tickets from WALLE           │   │
│  │     Permissions: http, notify                │   │
│  │     [Install]                                │   │
│  └──────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

- `[✓]` = verified by WALLE team (green badge)
- `[⬢]` = community plugin (gray badge)
- Permission list shown on every card before install
- Install triggers the full permission approval flow
- Installed plugins appear in the main Plugin Manager tab

### Permission Approval Modal

```
┌─ Install GitHub Issues? ───────────────────────────┐
│                                                     │
│  This plugin is requesting:                         │
│                                                     │
│  ● http        Make outbound HTTP requests          │
│  ● storage     Read/write plugin data               │
│                                                     │
│  ● NOT requesting: shell, git, notify               │
│                                                     │
│  [Install and grant permissions]    [Cancel]        │
└─────────────────────────────────────────────────────┘
```

"NOT requesting" section is shown deliberately — it builds trust by showing what the plugin cannot do.

---

## Feature 6 — Plugin Recorder

### Philosophy
The most powerful plugins aren't ones downloaded from a marketplace — they're the ones that automate exactly your own workflow. Plugin Recorder watches you perform a sequence of actions in WALLE, then turns that sequence into a reusable plugin with a name, description, and command. No coding required.

### How It Works

1. User says "WALLE, record what I'm about to do" OR clicks the record button in the toolbar
2. WALLE enters recording mode — every action the user triggers is captured
3. User performs their workflow normally (through WALLE or manually in terminal — WALLE captures what it can see via active window + clipboard changes)
4. User says "stop recording" or clicks stop
5. WALLE shows the captured steps and asks for a plugin name
6. User approves → plugin is saved to `~/.walle/plugins/{name}/`
7. Plugin is immediately available in Plugin Manager

### Recorder Architecture

```rust
// src-tauri/src/plugins/recorder.rs

pub struct RecordingSession {
    id: String,
    steps: Vec<RecordedStep>,
    started_at: Instant,
    active: bool,
}

pub struct RecordedStep {
    timestamp: Instant,
    source: StepSource,       // 'walle_action' | 'shell_detected' | 'window_change'
    plugin: Option<String>,
    command: Option<String>,
    label: String,
}

pub enum StepSource {
    WalleAction,       // user asked WALLE to do something
    ShellDetected,     // terminal window change detected
    WindowChange,      // active window changed (captured as context step)
}
```

### RecorderBar Component

Thin banner that appears at the top of the chat panel during recording:

```
● REC  Recording your actions...  [3 steps captured]  [Stop & Save]  [Discard]
```

Pulsing red dot. Step count updates live. Clicking "Stop & Save" opens the RecordedStepList for review.

### RecordedStepList — Review Before Saving

```
┌─ Review recorded steps ────────────────────────────┐
│  Plugin name: [my-morning-setup          ]         │
│                                                     │
│  1.  Open VS Code           app_launch   [keep] [✕] │
│  2.  cd C:/dev/myapp        shell        [keep] [✕] │
│  3.  docker-compose up -d   shell        [keep] [✕] │
│  4.  Open Chrome            app_launch   [keep] [✕] │
│                                                     │
│  [Save as Plugin]                    [Discard All]  │
└─────────────────────────────────────────────────────┘
```

User can remove any steps before saving. On save: WALLE generates a `manifest.json` and a `plugin.js` script from the steps, writes to `~/.walle/plugins/my-morning-setup/`, and immediately loads it.

---

## Feature 7 — Trust Score System

### Philosophy
Phase 1 gave us `safe / moderate / dangerous` — a static, command-level risk classification. Phase 3 adds a dynamic, per-action and per-plugin trust score that evolves based on observed outcomes over time. A command that has always succeeded builds trust. A plugin that has caused errors loses trust. Trust scores influence how aggressively auto mode executes.

### Trust Score Data Model

```typescript
// src/lib/trustScore.ts

export interface TrustScore {
  entity_type: 'plugin' | 'command_pattern' | 'workflow';
  entity_id: string;         // plugin id, command hash, or workflow name
  score: number;             // 0–100
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  last_run: string;
  last_failure: string | null;
  user_overrides: number;    // times user manually approved a blocked action
}
```

### New SQLite Table

```sql
-- 004_trust.sql migration
CREATE TABLE IF NOT EXISTS trust_scores (
    entity_type     TEXT NOT NULL,
    entity_id       TEXT NOT NULL,
    score           REAL DEFAULT 50.0,
    total_runs      INTEGER DEFAULT 0,
    successful_runs INTEGER DEFAULT 0,
    failed_runs     INTEGER DEFAULT 0,
    last_run        TEXT,
    last_failure    TEXT,
    user_overrides  INTEGER DEFAULT 0,
    PRIMARY KEY (entity_type, entity_id)
);
```

### Score Calculation

```typescript
// src-tauri/src/agent/trust.rs

// Starting score: 50.0 (neutral)
// Success: +2.0 (capped at 95.0)
// Failure: -8.0 (floored at 5.0)
// User manual override (approved despite low score): +5.0
// User deny (rejected despite high score): -10.0

function updateTrustScore(current: number, event: TrustEvent): number {
  switch (event) {
    case 'success':         return Math.min(95, current + 2);
    case 'failure':         return Math.max(5,  current - 8);
    case 'user_approved':   return Math.min(95, current + 5);
    case 'user_denied':     return Math.max(5,  current - 10);
  }
}
```

### How Trust Affects Execution

```typescript
// Auto mode execution gate — Phase 3 extension to executor

function shouldAutoExecute(action: WalleAction, trust: TrustScore, baseRisk: RiskLevel): boolean {
  if (baseRisk === 'dangerous') return false;  // always gate — trust doesn't change this

  if (baseRisk === 'moderate') {
    if (trust.score >= 80 && trust.total_runs >= 5) return true;  // earned auto-execute
    return false;  // still needs approval
  }

  if (baseRisk === 'safe') {
    if (trust.score < 30) return false;  // safe command with bad history gets reviewed
    return true;
  }

  return true;
}
```

### Trust Score in ActionCard UI

Every ActionCard (Phase 1) now shows the trust score for the plugin/command:

```
┌─ Action requires approval ──────────────────────┐
│  Shell: docker-compose up -d                     │
│  Risk: moderate   Trust: ████████░░ 78/100       │
│  Runs: 24  Failures: 2  Last failure: 3 days ago │
│                                                  │
│  [✓ Allow]        [✗ Deny]                      │
└──────────────────────────────────────────────────┘
```

High trust + moderate risk = a single "earned trust" badge on the card + slightly muted styling to signal it's near auto-execution threshold.

### Trust Score Panel (in Insights Dashboard)

Full sortable table of all tracked entities, their scores, run counts, and failure history. User can manually reset any score to 50. User can permanently whitelist an entity (pins at 100, never decreases) or permanently blacklist (always requires approval regardless of score).

---

## Feature 8 — Persona System

### Philosophy
WALLE's identity is its biggest differentiator. The persona system lets users swap the mascot's visual appearance and conversational personality without changing any core functionality. Phase 3 ships three built-in personas and a community persona format so designers can publish their own.

### Built-in Personas

| Persona | Visual | Personality | Accent color |
|---|---|---|---|
| `walle` (default) | Boxy robot, amber eyes | Warm, curious, concise | Amber |
| `ghost` | Minimal floating orb | Cold, precise, no-nonsense | Ice white |
| `fox` | Stylised fox silhouette | Playful, fast, witty | Orange |

### Persona Data Format

Each persona lives in `~/.walle/personas/{name}/` or is bundled in the app:

```
personas/
└── ghost/
    ├── persona.json        # metadata + system prompt personality modifier
    ├── mascot.svg          # full SVG mascot (must include all 7 emotion states)
    ├── idle.svg            # optional: separate idle animation SVG
    └── preview.png         # thumbnail shown in persona picker
```

```json
// persona.json
{
  "id": "ghost",
  "name": "Ghost",
  "version": "1.0.0",
  "author": "WALLE Team",
  "accent_color": "#e8f4ff",
  "accent_glow": "rgba(232, 244, 255, 0.3)",
  "personality_modifier": "You are precise, minimal, and fast. No pleasantries. Responses are 1 sentence maximum unless the task requires more. Never use exclamation marks.",
  "emotion_map": {
    "idle":     "opacity: 0.6, gentle pulse",
    "thinking": "opacity flicker, slow",
    "happy":    "brightness increase, brief scale",
    "sad":      "opacity: 0.3, no animation",
    "alert":    "rapid pulse, white glow",
    "focused":  "static, full opacity",
    "sleeping": "opacity: 0.1"
  }
}
```

### PersonaPicker UI

In settings panel → Appearance tab:

```
┌─ Persona ────────────────────────────────────────────┐
│                                                       │
│  [WALLE ✓]    [Ghost]    [Fox]    [+ Browse more]    │
│                                                       │
│  Currently: WALLE (default)                          │
│  "Warm, curious, and always ready to help."          │
│                                                       │
└───────────────────────────────────────────────────────┘
```

Clicking a persona shows a preview animation of the mascot. Selecting it applies immediately — mascot window updates live, personality modifier is injected into the LLM system prompt from the next message onward.

### Persona Injection Into System Prompt

```typescript
// Add to system prompt builder — after user name, before memory
const personaBlock = persona.personality_modifier
  ? `\nPersonality: ${persona.personality_modifier}\n`
  : '';
```

### Voice Personality (TTS — Optional)

If the user enables TTS (off by default), each persona has a voice profile:

```json
"voice": {
  "provider": "system",    // "system" uses OS TTS — no API key required
  "rate": 1.1,             // slightly faster than default
  "pitch": 0.9,
  "volume": 0.8
}
```

Use OS TTS via Tauri's `tauri-plugin-shell` calling `espeak` (Linux), `say` (macOS), or PowerShell's `SpeakText` (Windows). No external TTS API required for MVP voices.

---

## Feature 9 — WALLE Insights Dashboard

### Philosophy
Phase 2 WALLE collects memory, outcomes, patterns, and schedules. Phase 3 surfaces all of that in a beautiful, browsable dashboard. This isn't analytics for analytics' sake — it's WALLE showing you what it knows about you, making the memory system transparent, and giving you control over it.

### Dashboard Layout

Accessible via `Ctrl+Shift+I` or the tray icon. Opens as a third Tauri window: `insights`, 900×620px, glass styling, same dark glass design system.

```
┌──────────────────────────────────────────────────────────────────┐
│  WALLE Insights                                    [×]           │
├──────────────┬───────────────────────────────────────────────────┤
│  Overview    │                                                    │
│  Memory      │   ┌── Activity ──────────────────────────────┐   │
│  Patterns    │   │  [7-day usage chart — tasks per day]     │   │
│  Trust       │   └──────────────────────────────────────────┘   │
│  Schedules   │                                                    │
│  Plugins     │   ┌── Memory summary ────────────────────────┐   │
│              │   │  14 habits   8 preferences  22 facts     │   │
│              │   └──────────────────────────────────────────┘   │
│              │                                                    │
│              │   ┌── Top plugins ───────────────────────────┐   │
│              │   │  shell ████████████ 248 runs             │   │
│              │   │  git   ██████       89 runs              │   │
│              │   │  notify████         62 runs              │   │
│              │   └──────────────────────────────────────────┘   │
└──────────────┴───────────────────────────────────────────────────┘
```

### Memory Browser Tab

Searchable, filterable table of all stored memories. Columns: type, key, value, confidence (progress bar), source badge, last used, use count. Actions per row: edit value, reset confidence to 0.7, delete. Bulk: "Delete all inferred memories", "Export memories as JSON".

### Patterns Tab

All detected patterns with their confidence, occurrence count, and whether the user accepted or dismissed the suggestion. Actions: "Create workflow from this pattern", "Never suggest again", "Delete".

### Trust Scores Tab

Sortable table of all entities with trust scores. Progress bar for score. Columns: entity, type, score, runs, failures, last failure. Actions: reset to 50, whitelist (pin at 100), blacklist (always require approval).

### Data Export + Delete

At the bottom of every tab: "Export this data as JSON" and "Delete all data in this category". In settings: "Wipe all WALLE data" — hard reset with a typed confirmation.

---

## Feature 10 — Linux Port

Phase 2 completed the macOS port. Phase 3 adds Linux.

### Platform Branches to Add

```rust
#[cfg(target_os = "linux")]
fn get_shell_cmd(command: &str) -> Command {
    let mut cmd = Command::new("bash");
    cmd.args(["-c", command]);
    cmd
}

#[cfg(target_os = "linux")]
pub async fn launch_app(app_name: String) -> Result<(), String> {
    Command::new("xdg-open")
        .arg(&app_name)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(target_os = "linux")]
pub fn get_active_window() -> Option<String> {
    // Use xdotool: xdotool getactivewindow getwindowname
    let output = Command::new("xdotool")
        .args(["getactivewindow", "getwindowname"])
        .output()
        .ok()?;
    Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
}
```

### Linux-specific Notes

- Transparency requires a compositor (Picom, KWin, Mutter). If none detected, fall back to opaque dark background.
- TTS: use `espeak-ng` via shell call
- Notifications: `libnotify` via Tauri's notification plugin
- App launch: `xdg-open` or direct binary names

### Build Target

```bash
tauri build --target x86_64-unknown-linux-gnu   # → .AppImage + .deb
```

---

## Updated Config File (`walle.config.json`) — Phase 3 Additions

```json
{
  "learning": {
    "enabled": true,
    "min_occurrences": 3,
    "min_confidence": 0.75,
    "suggest_while_busy": false,
    "auto_dismiss_seconds": 30
  },
  "proactive": {
    "enabled": false,
    "quiet_hours_start": "22:00",
    "quiet_hours_end": "08:00",
    "max_nudges_per_day": 3,
    "watchers": {
      "git_uncommitted": { "enabled": false, "threshold_minutes": 120 },
      "test_failures":   { "enabled": false, "failure_threshold": 3 },
      "long_process":    { "enabled": false, "threshold_hours": 8 },
      "idle_digest":     { "enabled": false, "trigger_time": "18:00" },
      "memory_nudge":    { "enabled": false }
    }
  },
  "persona": {
    "active": "walle",
    "tts_enabled": false,
    "tts_provider": "system"
  },
  "insights": {
    "hotkey": "Ctrl+Shift+I"
  },
  "marketplace": {
    "registry_url": "https://registry.walle.dev/v1",
    "auto_check_updates": true
  }
}
```

All Phase 1 and Phase 2 keys remain unchanged.

---

## Updated Zustand Store (additions only)

```typescript
interface WalleStore {
  // ... all Phase 1 + Phase 2 fields unchanged ...

  // Phase 3 additions
  pendingSuggestion: Pattern | null;
  isRecording: boolean;
  recordedSteps: RecordedStep[];
  activeAgents: SubAgent[];
  currentPersona: Persona;
  trustScores: TrustScore[];

  // Actions
  setPendingSuggestion: (p: Pattern | null) => void;
  acceptSuggestion: (p: Pattern) => void;
  dismissSuggestion: (p: Pattern) => void;
  startRecording: () => void;
  stopRecording: () => void;
  addRecordedStep: (s: RecordedStep) => void;
  clearRecordedSteps: () => void;
  setActiveAgents: (agents: SubAgent[]) => void;
  updateAgentStatus: (id: string, status: AgentStatus) => void;
  setPersona: (p: Persona) => void;
  updateTrustScore: (entity: string, event: TrustEvent) => void;
}
```

---

## Build Order — Follow This Exactly

### Step 1 — Trust Score Foundation
- Create `trust_scores` table migration (004_trust.sql)
- Implement `trust.rs` score calculator
- Wire into executor: update score after every action outcome
- Test: run a shell command 5 times → trust score increases → visible in ActionCard

### Step 2 — Trust Score UI in ActionCard
- Add trust score display to `ActionCard.tsx` (Phase 1 component — extend only)
- Progress bar, run count, last failure date
- Test: see trust score on every action requiring approval

### Step 3 — Pattern Detection Engine
- Create `patterns` table migration (003_learning.sql)
- Implement `patternEngine.ts` sliding window analysis
- Run scanner after every task execution
- Test: perform the same two commands in sequence 4 times → pattern detected

### Step 4 — Learning Mode Suggestions
- Implement `useLearning` hook
- Build `SuggestionBubble` component
- Wire `pattern:detected` event from Rust to frontend
- Test: detected pattern → bubble appears near mascot → accept → workflow created

### Step 5 — Proactive Watchers (safe ones first)
- Implement `git_uncommitted` watcher
- Implement `idle_digest` watcher
- Build watcher config UI in settings
- Test: make dirty commits, wait threshold → nudge appears
- Test: quiet hours respected — no nudge during configured window

### Step 6 — Remaining Watchers
- Implement `test_failures`, `long_process`, `memory_nudge`
- Test each watcher fires and respects anti-spam rules

### Step 7 — Multi-Agent Foundation
- Implement `multi_agent.rs` executor
- Build dependency graph resolver
- Test: 2-agent chain where agent 2 depends on agent 1's output

### Step 8 — Multi-Agent UI
- Build chain progress view in chat panel
- Collapsible sub-agent output rows
- Test: 3-agent chain → all steps visible, expandable, final synthesis shows

### Step 9 — QuickJS Sandbox
- Add `rquickjs` to Cargo.toml
- Implement `sandbox.rs` with permission-gated API injection
- Test: run a simple JS plugin that calls `phantom.shell()` → output returned
- Test: JS plugin that tries to access un-declared permission → error returned

### Step 10 — Plugin Recorder
- Implement `recorder.rs` session capture
- Build `RecorderBar` and `RecordedStepList` components
- Test: record 3 actions → review → save → plugin appears in Plugin Manager

### Step 11 — Plugin Marketplace
- Implement `marketplace.ts` registry client
- Build `MarketplacePanel` and `InstallProgress` components
- Build permission approval modal
- Test: search registry → install plugin → see in Plugin Manager → plugin runs

### Step 12 — Persona System
- Implement `persona/mod.rs` loader
- Bundle `walle`, `ghost`, `fox` personas
- Build `PersonaPicker` component
- Wire personality modifier into system prompt
- Test: switch to Ghost → WALLE's responses become terse and minimal

### Step 13 — TTS (Optional Voice)
- Implement `voice.rs` with OS TTS calls
- Add voice toggle to persona settings
- Test: WALLE speaks its response via OS TTS engine

### Step 14 — Insights Dashboard
- Create third Tauri window: `insights`
- Build all dashboard tabs: Overview, Memory, Patterns, Trust, Schedules, Plugins
- Wire export and delete functions
- Test: all memory data visible and editable, export produces valid JSON

### Step 15 — Linux Port
- Add all `#[cfg(target_os = "linux")]` branches
- Handle compositor-less transparency fallback
- Test on Ubuntu 22.04 + GNOME (or Plasma)
- Build `.AppImage` and `.deb`

### Step 16 — Integration Pass
- All Phase 1 + 2 features work unchanged
- Trust scores update correctly across all plugin types
- Learning suggestions do not appear while chat is open
- Proactive watchers respect quiet hours and anti-spam rules
- Multi-agent chains run to completion without hanging

### Step 17 — Polish Pass
- Insights dashboard animations and transitions
- PersonaPicker preview animation
- RecorderBar pulse animation
- SuggestionBubble entrance/exit animation
- Trust score progress bar transitions
- Chain progress tree expand/collapse

### Step 18 — Build & Package
- Windows: `.msi`
- macOS: `.dmg` (Apple Silicon + Intel)
- Linux: `.AppImage` + `.deb`
- Update README with all three phases documented

---

## What NOT to Build in Phase 3

- AI-generated mascot skins using image models — out of scope permanently
- Autonomous agents that act without any user awareness
- Plugin execution that bypasses the sandbox
- Remote control of WALLE from another device (possible future phase)
- Cloud sync of memory or config across devices (possible future phase)
- Monetization layer in the marketplace (community first, revenue later)

Phase 3 is about: **learn from me, watch for me, delegate for me, trust what you've earned, and let others extend you.**

---

## Definition of Done (Phase 3)

WALLE v0.3 is complete when:

- [ ] Trust scores update after every action execution (success and failure)
- [ ] Trust scores are visible in ActionCard for actions requiring approval
- [ ] Trust score above threshold allows moderate-risk actions to auto-execute
- [ ] Pattern engine detects repeated command sequences after 3+ occurrences
- [ ] Learning suggestions appear as SuggestionBubble near mascot (not in chat)
- [ ] Accepting a suggestion creates a workflow automatically
- [ ] Dismissing a suggestion 3 times permanently disables that pattern
- [ ] At least 3 proactive watchers are implemented and configurable
- [ ] Anti-spam rules enforced: max 3 nudges/day, quiet hours respected
- [ ] Multi-agent chains with dependencies execute in correct order
- [ ] Chain progress is visible in chat panel with expandable sub-agent output
- [ ] QuickJS sandbox runs external plugin JS with permission gating
- [ ] Plugin that requests un-granted permission is blocked at runtime
- [ ] Plugin Recorder captures action sequences and saves as installable plugin
- [ ] Plugin Marketplace connects to registry, shows listings, installs with permission flow
- [ ] All 3 built-in personas switch correctly (mascot SVG + personality modifier)
- [ ] Persona personality modifier changes WALLE's response style noticeably
- [ ] Insights dashboard shows all memory, patterns, trust scores, and usage data
- [ ] User can edit, delete, or export any memory from the Insights dashboard
- [ ] WALLE runs correctly on Ubuntu 22.04 (or equivalent Linux distro)
- [ ] All Phase 1 and Phase 2 features work without regression on all 3 platforms
- [ ] `.msi`, `.dmg`, `.AppImage`, and `.deb` all build successfully

---

*WALLE v0.3 — Learn from me. Watch for me. Earn my trust.*
