# WALLE — Phase 1 MVP Build Prompt
## For AI Coding Agents (Claude Code / Cursor / Aider)

---

## Your Role

You are the sole engineer building **WALLE** — a desktop AI companion that lives as an animated mascot on the user's screen, responds to voice and text, and executes real OS-level actions. You are building **Phase 1 (MVP)** only. Do not over-engineer. Do not build Phase 2 or 3 features. Ship something that works, looks stunning, and feels alive.

---

## What You Are Building (Phase 1 Scope — Nothing More)

| Feature | In Scope |
|---|---|
| Animated mascot on screen corner | ✅ |
| Draggable, always-on-top, transparent window | ✅ |
| Global hotkey to summon/dismiss chat panel | ✅ |
| Text input + LLM response | ✅ |
| Voice input (Web Speech API) | ✅ |
| Emotion states on mascot (7 states) | ✅ |
| Shell command execution plugin | ✅ |
| App launcher plugin | ✅ |
| Manual review mode (approve/deny actions) | ✅ |
| Auto mode (execute without prompting) | ✅ |
| Notify plugin (OS toast notifications) | ✅ |
| Config file (walle.config.json) | ✅ |
| Risk classification (safe / moderate / dangerous) | ✅ |
| Basic workflow system (named step sequences) | ✅ |
| Plugin marketplace | ❌ Phase 2 |
| Screen context injection | ❌ Phase 2 |
| Scheduled tasks | ❌ Phase 2 |
| Memory/SQLite | ❌ Phase 2 |
| Multi-agent chaining | ❌ Phase 3 |
| Learning mode | ❌ Phase 3 |
| Proactive intelligence | ❌ Phase 3 |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop runtime | **Tauri v2** (Rust backend) |
| Frontend | **React 18 + TypeScript + Vite** |
| UI animation | **Framer Motion** |
| State | **Zustand** |
| Mascot animation | **SVG + CSS keyframe animations** (no Lottie — keep it lightweight) |
| Voice input | **Web Speech API** (browser built-in, no binary sidecar needed for MVP) |
| LLM | **Anthropic Claude** via REST (primary); OpenAI-compatible as fallback |
| Shell | `tauri-plugin-shell` |
| Hotkeys | `tauri-plugin-global-shortcut` |
| Config | JSON5 — `walle.config.json` in app data dir |
| Styling | **Tailwind CSS v4** + CSS custom properties |
| Platform | **Windows first** — macOS-ready structure (annotate all OS-specific code) |

---

## Project Structure

```
walle/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs                  # App bootstrap, window setup
│       ├── lib.rs                   # Tauri builder + plugin registration
│       ├── commands/
│       │   ├── mod.rs
│       │   ├── shell.rs             # Run shell commands, stream output
│       │   ├── app_launch.rs        # Open installed apps by name
│       │   └── notify.rs            # OS desktop notifications
│       ├── agent/
│       │   ├── mod.rs
│       │   ├── executor.rs          # Action plan executor (auto/manual)
│       │   └── llm.rs               # LLM adapter (Anthropic + OpenAI-compat)
│       └── config.rs                # Load/save walle.config.json
│
├── src/
│   ├── main.tsx                     # React entry
│   ├── App.tsx                      # Root: mascot window vs chat panel routing
│   ├── windows/
│   │   ├── MascotWindow.tsx         # The always-on-top floating mascot
│   │   └── ChatWindow.tsx           # The slide-in chat panel
│   ├── components/
│   │   ├── Mascot/
│   │   │   ├── WalleMascot.tsx      # SVG mascot with emotion variants
│   │   │   ├── EmotionEngine.tsx    # Emotion state machine + transitions
│   │   │   └── SpeechBubble.tsx     # Floating thought/speech bubble
│   │   ├── Chat/
│   │   │   ├── ChatPanel.tsx        # Full chat panel layout
│   │   │   ├── MessageList.tsx      # Scrollable message history
│   │   │   ├── InputBar.tsx         # Text + voice input bar
│   │   │   └── ActionCard.tsx       # Pending action approval card
│   │   └── UI/
│   │       ├── ModeToggle.tsx       # Auto / Manual toggle
│   │       └── StatusDot.tsx        # Live status indicator
│   ├── hooks/
│   │   ├── useWalle.ts              # Core agent hook
│   │   ├── useEmotion.ts            # Emotion state management
│   │   └── useVoice.ts              # Web Speech API hook
│   ├── store/
│   │   └── walleStore.ts            # Zustand global store
│   ├── lib/
│   │   ├── llm.ts                   # LLM API calls from frontend
│   │   ├── actionParser.ts          # Parse LLM JSON plan
│   │   └── config.ts                # Config type definitions
│   └── styles/
│       ├── globals.css              # CSS variables, base reset
│       └── tokens.css               # Design tokens (dark glass theme)
│
├── walle.config.json                # Default config (copied to app data on first run)
├── package.json
├── vite.config.ts
└── README.md
```

---

## Design System — Dark Glass Hacker Aesthetic

### Core Philosophy
Dark, glassy, alive. Think: terminal that grew a soul. Not purple gradients — instead use deep charcoal blacks, electric cyan, warm amber, and sharp white. The mascot should feel like it's floating on the screen, not sitting on a widget.

### CSS Custom Properties (set in `tokens.css`)

```css
:root {
  /* Base surfaces */
  --walle-bg-0: #0a0a0f;          /* Deepest black — mascot window bg */
  --walle-bg-1: #0f1117;          /* Panel background */
  --walle-bg-2: #161821;          /* Card / input background */
  --walle-bg-3: #1e2130;          /* Hover state background */

  /* Glass effect */
  --walle-glass: rgba(15, 17, 23, 0.82);
  --walle-glass-border: rgba(255, 255, 255, 0.07);
  --walle-glass-border-hover: rgba(255, 255, 255, 0.14);

  /* Accent — Electric Cyan (primary) */
  --walle-cyan: #00d4ff;
  --walle-cyan-dim: rgba(0, 212, 255, 0.15);
  --walle-cyan-glow: 0 0 12px rgba(0, 212, 255, 0.35);

  /* Accent — Amber (warm, for WALLE's eyes/emotions) */
  --walle-amber: #ffb347;
  --walle-amber-dim: rgba(255, 179, 71, 0.15);
  --walle-amber-glow: 0 0 10px rgba(255, 179, 71, 0.4);

  /* Status colors */
  --walle-green: #00ff88;          /* Success */
  --walle-red: #ff4466;            /* Error / danger */
  --walle-yellow: #ffd700;         /* Warning / alert */

  /* Text */
  --walle-text-primary: #e8eaf0;
  --walle-text-secondary: #7a7f94;
  --walle-text-muted: #3d4157;
  --walle-text-accent: var(--walle-cyan);

  /* Font */
  --walle-font-ui: 'Geist', 'Inter', system-ui, sans-serif;
  --walle-font-mono: 'Geist Mono', 'JetBrains Mono', monospace;

  /* Spacing / radius */
  --walle-radius-sm: 6px;
  --walle-radius-md: 10px;
  --walle-radius-lg: 16px;
  --walle-radius-pill: 999px;

  /* Animation */
  --walle-transition: 200ms cubic-bezier(0.4, 0, 0.2, 1);
  --walle-spring: 350ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

### Typography Rules
- UI labels, chat text: `Geist` or `Inter` — load from Google Fonts or bundle
- Terminal output, command previews: `Geist Mono` or `JetBrains Mono`
- No purple. No rounded bubbly fonts. No system-ui as the visible choice.
- Font sizes: 11px (micro), 13px (secondary), 14px (body), 16px (emphasis), 20px (heading)
- Letter spacing on headings: `0.04em`

### Glass Panel Recipe (use everywhere panels appear)
```css
.glass-panel {
  background: var(--walle-glass);
  border: 0.5px solid var(--walle-glass-border);
  border-radius: var(--walle-radius-lg);
  backdrop-filter: blur(24px) saturate(1.4);
  -webkit-backdrop-filter: blur(24px) saturate(1.4);
}
```

---

## Window Architecture (Tauri v2)

### Two Windows, Two Purposes

**Window 1: `mascot`** — The floating companion
```rust
// src-tauri/src/main.rs
// WINDOWS: transparent + always_on_top + no decorations + skip_taskbar
// macOS: same flags + set_window_level(NSFloatingWindowLevel)  // annotate for macOS
WebviewWindowBuilder::new(&app, "mascot", WebviewUrl::App("mascot.html".into()))
    .transparent(true)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(false)
    .inner_size(160.0, 200.0)
    .position(/* load from config — default bottom-right */)
    .shadow(false)  // Windows: disable Aero shadow
    .build()?;
```

**Window 2: `chat`** — The panel (hidden by default, toggled by hotkey)
```rust
WebviewWindowBuilder::new(&app, "chat", WebviewUrl::App("chat.html".into()))
    .transparent(true)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(false)
    .inner_size(380.0, 620.0)
    .visible(false)
    .build()?;
```

Both windows share state via Tauri events (`app.emit_to`, `app.listen`).

### Hotkey Registration
```rust
// tauri-plugin-global-shortcut
// Default: Ctrl+Shift+Space — toggles chat window
// All hotkeys must be configurable via walle.config.json
app.global_shortcut().on_shortcut("Ctrl+Shift+Space", |app, _, _| {
    let chat = app.get_webview_window("chat").unwrap();
    if chat.is_visible().unwrap() {
        chat.hide().unwrap();
    } else {
        // Position chat next to mascot
        let mascot = app.get_webview_window("mascot").unwrap();
        let pos = mascot.outer_position().unwrap();
        chat.set_position(LogicalPosition::new(pos.x as f64 - 390.0, pos.y as f64 - 420.0)).unwrap();
        chat.show().unwrap();
        chat.set_focus().unwrap();
    }
})?;
```

---

## WALLE Mascot Design (SVG)

### Design Direction
WALLE should look like a compact, boxy little robot — referencing the Pixar character's spirit but abstracted enough to be original. Think: square body, large expressive eyes (the soul of the character), small antenna, chunky arms tucked in. Rendered in SVG with CSS animations. Dark metal body, amber glowing eyes, cyan circuit accent lines.

### Emotion States — Implementation

Each emotion is a named variant. The `EmotionEngine` manages transitions between them.

```typescript
// src/components/Mascot/EmotionEngine.tsx
export type Emotion =
  | 'idle'        // Gentle breathing bob, amber eyes at 60% glow
  | 'thinking'    // Eyes dim and pulse slowly, small spin on antenna
  | 'happy'       // Eyes wide + bright, body bounces up once
  | 'sad'         // Eyes droop, body sinks 4px, antenna droops
  | 'alert'       // Eyes flash cyan, body shakes subtly left-right
  | 'focused'     // Eyes narrow (squint SVG morph), still body
  | 'sleeping'    // Eyes closed (line), z-z-z bubble, slow breathe

// Transition map: which emotions can interrupt which
export const EMOTION_PRIORITY: Record<Emotion, number> = {
  sleeping: 0,
  idle: 1,
  thinking: 2,
  focused: 3,
  happy: 4,
  sad: 4,
  alert: 5,   // alert always wins
};
```

### SVG Mascot Structure
The SVG must be fully animatable via CSS classes. Structure:

```svg
<svg id="walle" viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg">
  <!-- Shadow / ground reflection -->
  <ellipse id="shadow" .../>

  <!-- Body group — animated for breathing/bounce -->
  <g id="body">
    <!-- Main chassis (rounded rect, dark metal) -->
    <rect id="chassis" x="30" y="80" width="100" height="90" rx="12"
      fill="#1a1d2e" stroke="#2a2f45" stroke-width="1.5"/>

    <!-- Cyan circuit accent lines on body -->
    <path id="circuit-left" ...  stroke="var(--walle-cyan)" stroke-width="0.8" opacity="0.6"/>
    <path id="circuit-right" ... stroke="var(--walle-cyan)" stroke-width="0.8" opacity="0.6"/>

    <!-- Arms (small stubs, left and right) -->
    <rect id="arm-left"  ... rx="4" fill="#141621"/>
    <rect id="arm-right" ... rx="4" fill="#141621"/>

    <!-- Treads / base -->
    <rect id="tread" ... rx="8" fill="#0f1117"/>
  </g>

  <!-- Head group — animatable separately -->
  <g id="head">
    <!-- Head box -->
    <rect id="head-box" x="35" y="20" width="90" height="65" rx="10"
      fill="#1a1d2e" stroke="#2a2f45" stroke-width="1.5"/>

    <!-- Antenna -->
    <g id="antenna">
      <line x1="80" y1="20" x2="80" y2="6" stroke="#2a2f45" stroke-width="2"/>
      <circle id="antenna-tip" cx="80" cy="4" r="4" fill="var(--walle-cyan)"/>
    </g>

    <!-- Eyes — the most expressive part -->
    <g id="eyes">
      <!-- Left eye housing -->
      <rect id="eye-housing-l" x="42" y="32" width="30" height="26" rx="6"
        fill="#0a0c14" stroke="#1e2235" stroke-width="1"/>
      <!-- Left eye iris (amber glow) -->
      <circle id="eye-l" cx="57" cy="45" r="9"
        fill="var(--walle-amber)" opacity="0.9"/>
      <!-- Left eye highlight -->
      <circle cx="61" cy="41" r="2.5" fill="white" opacity="0.6"/>

      <!-- Right eye housing -->
      <rect id="eye-housing-r" x="88" y="32" width="30" height="26" rx="6"
        fill="#0a0c14" stroke="#1e2235" stroke-width="1"/>
      <!-- Right eye iris -->
      <circle id="eye-r" cx="103" cy="45" r="9"
        fill="var(--walle-amber)" opacity="0.9"/>
      <!-- Right eye highlight -->
      <circle cx="107" cy="41" r="2.5" fill="white" opacity="0.6"/>
    </g>

    <!-- Mouth / expression line (morph for emotions) -->
    <path id="mouth" d="M60 72 Q80 78 100 72"
      fill="none" stroke="var(--walle-cyan)" stroke-width="1.5"
      stroke-linecap="round" opacity="0.7"/>
  </g>

  <!-- Speech bubble (hidden by default, shown by EmotionEngine) -->
  <g id="speech-bubble" opacity="0" transform="translate(110, 0)">
    <!-- ... bubble SVG -->
  </g>
</svg>
```

### Emotion CSS Animations

```css
/* idle — gentle breathing */
@keyframes walle-breathe {
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-3px); }
}
#walle.idle #body { animation: walle-breathe 3.5s ease-in-out infinite; }
#walle.idle #eye-l, #walle.idle #eye-r {
  animation: walle-eye-pulse 3.5s ease-in-out infinite;
}
@keyframes walle-eye-pulse {
  0%, 100% { opacity: 0.85; }
  50%       { opacity: 1; filter: drop-shadow(0 0 4px var(--walle-amber)); }
}

/* thinking — slow antenna spin, eyes dim */
@keyframes walle-antenna-spin {
  from { transform-origin: 80px 20px; transform: rotate(0deg); }
  to   { transform-origin: 80px 20px; transform: rotate(360deg); }
}
#walle.thinking #antenna { animation: walle-antenna-spin 2s linear infinite; }
#walle.thinking #eye-l, #walle.thinking #eye-r { opacity: 0.4; }

/* happy — bounce */
@keyframes walle-bounce {
  0%   { transform: translateY(0); }
  30%  { transform: translateY(-12px); }
  50%  { transform: translateY(-6px); }
  70%  { transform: translateY(-10px); }
  100% { transform: translateY(0); }
}
#walle.happy #body, #walle.happy #head {
  animation: walle-bounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
#walle.happy #eye-l, #walle.happy #eye-r {
  filter: drop-shadow(0 0 8px var(--walle-amber));
}

/* sad — droop */
#walle.sad #body { transform: translateY(4px); transition: transform 0.4s ease; }
#walle.sad #eye-l { transform-origin: 57px 45px; transform: scaleY(0.55); }
#walle.sad #eye-r { transform-origin: 103px 45px; transform: scaleY(0.55); }
#walle.sad #antenna { transform: rotate(25deg); transform-origin: 80px 20px; }

/* alert — shake + cyan eyes */
@keyframes walle-shake {
  0%, 100% { transform: translateX(0); }
  20%       { transform: translateX(-4px); }
  40%       { transform: translateX(4px); }
  60%       { transform: translateX(-3px); }
  80%       { transform: translateX(3px); }
}
#walle.alert #head { animation: walle-shake 0.5s ease-in-out; }
#walle.alert #eye-l, #walle.alert #eye-r {
  fill: var(--walle-cyan);
  filter: drop-shadow(0 0 10px var(--walle-cyan));
}

/* focused — narrow eyes, still */
#walle.focused #eye-l { transform-origin: 57px 45px; transform: scaleY(0.4); }
#walle.focused #eye-r { transform-origin: 103px 45px; transform: scaleY(0.4); }

/* sleeping — eyes closed, z-z-z */
#walle.sleeping #eye-l, #walle.sleeping #eye-r { transform: scaleY(0.05); }
@keyframes walle-zzz {
  0%, 100% { opacity: 0; transform: translate(0, 0) scale(0.6); }
  50%       { opacity: 1; transform: translate(6px, -8px) scale(1); }
}
/* z's rendered as SVG text in speech bubble, animated separately */
```

---

## Agent Brain

### LLM System Prompt

```
You are WALLE, a compact and clever desktop AI companion living on {user_name}'s screen.
You have a personality: curious, efficient, occasionally witty, never verbose.
You respond in short, clear sentences. You do not ramble.

You have access to these tools:
{plugin_list}

Operating system: {os}  (Windows — use PowerShell for shell commands)
Current mode: {mode}  (auto | manual_review)
Current time: {timestamp}

When you want to take an action, respond ONLY with this JSON structure:
{
  "message": "What you say to the user (keep it under 2 sentences)",
  "emotion": "idle | thinking | happy | sad | alert | focused | sleeping",
  "actions": [
    {
      "plugin": "shell | app_launch | notify",
      "label": "Plain English description of what this does",
      "risk": "low | medium | high",
      "params": { ... plugin-specific params ... }
    }
  ],
  "requires_approval": false
}

If mode is manual_review, always set requires_approval: true for any action.
If risk is "high", always set requires_approval: true regardless of mode.
High risk = anything that deletes, sends, overwrites, or installs.
If no action is needed (conversation only), return an empty actions array.
Always set a valid emotion. Default to "idle" if nothing else fits.
Never explain your JSON. Just return it.
```

### Action Parser (`src/lib/actionParser.ts`)

```typescript
export interface WalleAction {
  plugin: 'shell' | 'app_launch' | 'notify';
  label: string;
  risk: 'low' | 'medium' | 'high';
  params: Record<string, unknown>;
}

export interface WallePlan {
  message: string;
  emotion: Emotion;
  actions: WalleAction[];
  requires_approval: boolean;
}

export function parsePlan(raw: string): WallePlan {
  // Strip any markdown fences the LLM might add
  const clean = raw.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);
  // Validate required fields with fallbacks
  return {
    message: parsed.message ?? '',
    emotion: parsed.emotion ?? 'idle',
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    requires_approval: parsed.requires_approval ?? false,
  };
}
```

---

## Built-in Plugins (Phase 1)

### 1. `shell` — Run terminal commands

```rust
// src-tauri/src/commands/shell.rs
// WINDOWS: runs via PowerShell
// macOS: runs via /bin/zsh  <- annotate clearly for platform swap

#[tauri::command]
pub async fn shell_run(command: String, working_dir: Option<String>) 
    -> Result<ShellOutput, String> 
{
    // WINDOWS
    let mut cmd = Command::new("powershell");
    cmd.args(["-NoProfile", "-Command", &command]);
    // macOS equivalent: Command::new("zsh").args(["-c", &command])

    if let Some(dir) = working_dir {
        cmd.current_dir(dir);
    }
    let output = cmd.output().map_err(|e| e.to_string())?;
    Ok(ShellOutput {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}
```

### 2. `app_launch` — Open apps by name

```rust
// src-tauri/src/commands/app_launch.rs
#[tauri::command]
pub async fn launch_app(app_name: String) -> Result<(), String> {
    // WINDOWS: Start-Process via PowerShell
    let cmd = format!("Start-Process '{}'", app_name);
    Command::new("powershell")
        .args(["-NoProfile", "-Command", &cmd])
        .spawn()
        .map_err(|e| e.to_string())?;
    // macOS equivalent: Command::new("open").args(["-a", &app_name])
    // Linux equivalent: Command::new("xdg-open").arg(&app_name)
    Ok(())
}
```

### 3. `notify` — OS toast notification

```rust
// src-tauri/src/commands/notify.rs
// Use tauri-plugin-notification
#[tauri::command]
pub async fn send_notify(app: AppHandle, title: String, body: String) -> Result<(), String> {
    app.notification()
        .builder()
        .title(&title)
        .body(&body)
        .show()
        .map_err(|e| e.to_string())?;
    Ok(())
}
```

---

## Chat Panel UI

### Layout (ChatPanel.tsx)

```
┌────────────────────────────────────────┐  <- glass panel, 380x620px
│  WALLE  ·  ●  auto          [⚙]  [×]  │  <- header bar
├────────────────────────────────────────┤
│                                        │
│  [WALLE message bubble]                │
│                                        │
│            [User message bubble]       │
│                                        │
│  [WALLE message bubble]                │
│                                        │
│  ┌─ Action Card ────────────────────┐  │
│  │  Shell: Get-Process | Format     │  │
│  │  Risk: low                       │  │
│  │  [✓ Allow]          [✗ Deny]    │  │
│  └──────────────────────────────────┘  │
│                                        │
├────────────────────────────────────────┤
│  [🎙]  Type a message...         [➤]  │  <- input bar
└────────────────────────────────────────┘
```

### Message Bubbles
- WALLE messages: left-aligned, `--walle-bg-2` background, `--walle-cyan` left border (2px)
- User messages: right-aligned, `--walle-bg-3` background, no border accent
- Font: `--walle-font-ui`, 14px, `--walle-text-primary`
- Timestamps: 11px, `--walle-text-muted`
- Entry animation: slide up + fade in with Framer Motion

### ActionCard Component

```tsx
// src/components/Chat/ActionCard.tsx
// Shown when requires_approval is true
// Each action gets its own card in sequence

interface ActionCardProps {
  action: WalleAction;
  onApprove: () => void;
  onDeny: () => void;
}

// Visual:
// - Header: plugin icon + action label
// - Code block: shows the raw command (expandable)
// - Risk badge: colored dot — green/yellow/red for low/medium/high
// - Two buttons: Allow (cyan outline) and Deny (red outline)
// - On approve: card animates out with green flash
// - On deny: card animates out with red flash, WALLE goes sad
```

### ModeToggle Component

```tsx
// Two-state pill toggle: AUTO ↔ MANUAL
// AUTO: cyan glow, label "auto"
// MANUAL: amber glow, label "review"
// Persists to walle.config.json on change
// WALLE's eye color subtly shifts — cyan in auto, amber in manual
```

---

## Risk Classification System

This is not a new concept — the `risk` field already exists in the action JSON. This section defines exactly what qualifies as each level so the executor and LLM behave consistently. The agent must not guess at these rules.

### Risk Levels — Canonical Definition

```typescript
// src/lib/riskClassifier.ts

export type RiskLevel = 'safe' | 'moderate' | 'dangerous';

export const RISK_RULES: { patterns: RegExp[]; level: RiskLevel; reason: string; }[] = [
  // DANGEROUS — executor never auto-runs these, ever
  { patterns: [/rm\s+-rf/i, /Remove-Item.*-Recurse/i, /format\s+[a-z]:/i], level: 'dangerous', reason: 'Recursive or permanent deletion' },
  { patterns: [/shutdown|restart|reboot/i], level: 'dangerous', reason: 'System power state change' },
  { patterns: [/reg\s+(add|delete|import)/i, /regedit/i], level: 'dangerous', reason: 'Registry modification' },
  { patterns: [/curl.*\|\s*(bash|sh|powershell)/i, /Invoke-Expression/i], level: 'dangerous', reason: 'Remote code execution' },
  { patterns: [/net\s+user|net\s+localgroup/i], level: 'dangerous', reason: 'User account modification' },

  // MODERATE — shown in ActionCard, one-click approve
  { patterns: [/rm\s+(?!.*-rf)/i, /Remove-Item(?!.*-Recurse)/i, /del\s+/i], level: 'moderate', reason: 'File deletion (non-recursive)' },
  { patterns: [/npm install|pip install|cargo install|winget install/i], level: 'moderate', reason: 'Package installation' },
  { patterns: [/git\s+(push|commit|merge|rebase|reset)/i], level: 'moderate', reason: 'Git state change' },
  { patterns: [/Move-Item|mv\s+|Copy-Item.*-Force/i], level: 'moderate', reason: 'File move or forced copy' },

  // Everything else = SAFE — auto-executes without prompting
];

export function classifyRisk(command: string): RiskLevel {
  for (const rule of RISK_RULES) {
    if (rule.patterns.some(p => p.test(command))) return rule.level;
  }
  return 'safe';
}

// Always take the worse of LLM-declared vs classifier-enforced
function mergeRisk(llmRisk: RiskLevel, classifierRisk: RiskLevel): RiskLevel {
  const order = { safe: 0, moderate: 1, dangerous: 2 };
  return order[classifierRisk] >= order[llmRisk] ? classifierRisk : llmRisk;
}

// Core gate — called by executor before every action
export function needsApproval(action: WalleAction, mode: 'auto' | 'manual_review'): boolean {
  const enforced = classifyRisk(String(action.params.command ?? action.params.app ?? ''));
  const effective = mergeRisk(action.risk, enforced);
  if (effective === 'dangerous') return true;                          // always gate
  if (effective === 'moderate') return true;                          // gate in both modes
  if (effective === 'safe' && mode === 'manual_review') return true;  // gate safe only in review mode
  return false;                                                        // safe + auto = run freely
}
```

### ActionCard Visual by Risk Level

```
safe       → cyan left border (2px), no badge, standard Allow/Deny buttons
moderate   → amber left border (2px), amber "review" pill badge
dangerous  → red left border (2px), red "dangerous" pill badge
             Allow button is DISABLED until user types "confirm" in an inline input
```

The `confirm` typing gate for dangerous actions is hardcoded — it cannot be disabled by config or mode.

---

## Workflow System (Basic)

A workflow is a named sequence of actions saved to `walle.config.json`. Created conversationally, run by name. No UI builder in Phase 1.

### Data Shape

```typescript
// src/lib/config.ts — add to existing config types
export interface WorkflowStep {
  plugin: 'shell' | 'app_launch' | 'notify';
  label: string;
  params: Record<string, unknown>;
}

export interface Workflow {
  name: string;          // "start work", "morning routine"
  description?: string;
  steps: WorkflowStep[];
  created_at: string;    // ISO timestamp
}
```

### Config Entry

```json
{
  "workflows": [
    {
      "name": "start work",
      "description": "Opens everything for a dev session",
      "steps": [
        { "plugin": "app_launch", "label": "Open VS Code",  "params": { "app": "Code" } },
        { "plugin": "app_launch", "label": "Open Slack",    "params": { "app": "Slack" } },
        { "plugin": "shell",      "label": "Start Docker",  "params": { "command": "docker-compose up -d" } },
        { "plugin": "notify",     "label": "Ready",         "params": { "title": "WALLE", "body": "Dev env ready." } }
      ],
      "created_at": "2025-01-01T09:00:00Z"
    }
  ]
}
```

### Two New Plugin Types for Executor

**`save_workflow`** — writes a new workflow to config and reloads  
**`run_workflow`** — looks up workflow by name, runs steps sequentially through existing executor (each step's risk re-evaluated individually; workflow pauses on any step requiring approval)

### LLM System Prompt Injection (dynamic, at runtime)

```
Saved workflows: {workflow_list_or_"none saved yet"}

To save a new workflow: use plugin "save_workflow" with name + steps array.
To run an existing workflow: use plugin "run_workflow" with name.
```

### Zustand Additions

```typescript
workflows: Workflow[];
addWorkflow: (w: Workflow) => void;
removeWorkflow: (name: string) => void;
```

### Build Order Insertion

Add **Step 10.5 — Workflow System** between Step 10 (Auto Mode) and Step 11 (Voice Input):
- Implement `save_workflow` + `run_workflow` in executor
- Read/write workflow array from config
- Inject workflow list into system prompt at runtime
- Test: tell WALLE a 3-step sequence and save it → run it → all steps fire
- Test: a moderate-risk step inside a workflow still shows ActionCard

---

## Config File (`walle.config.json`)

```json
{
  "user": {
    "name": "User"
  },
  "llm": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-6",
    "api_key_env": "ANTHROPIC_API_KEY",
    "max_tokens": 512,
    "temperature": 0.7
  },
  "agent": {
    "mode": "manual_review",
    "always_confirm_dangerous": true,
    "always_confirm_moderate": true
  },
  "workflows": [],
  "mascot": {
    "position": "bottom-right",
    "scale": 1.0,
    "idle_animation": true
  },
  "hotkeys": {
    "toggle_chat": "Ctrl+Shift+Space",
    "toggle_voice": "Ctrl+Shift+V",
    "toggle_mode": "Ctrl+Shift+M"
  },
  "ui": {
    "theme": "dark-glass",
    "accent": "cyan",
    "chat_side": "left"
  },
  "plugins": {
    "enabled": ["shell", "app_launch", "notify"]
  }
}
```

Config is loaded on startup. Changes via the settings panel write back to disk and apply immediately without restart where possible.

---

## Zustand Store (`walleStore.ts`)

```typescript
interface WalleStore {
  // Agent state
  mode: 'auto' | 'manual_review';
  isThinking: boolean;
  pendingActions: WalleAction[];

  // Mascot state
  emotion: Emotion;
  isChatOpen: boolean;

  // Chat
  messages: ChatMessage[];

  // Actions
  setMode: (mode: 'auto' | 'manual_review') => void;
  setEmotion: (emotion: Emotion) => void;
  addMessage: (msg: ChatMessage) => void;
  setPendingActions: (actions: WalleAction[]) => void;
  approveAction: (index: number) => void;
  denyAction: (index: number) => void;
  toggleChat: () => void;
}
```

---

## Voice Input (`useVoice.ts`)

```typescript
export function useVoice(onTranscript: (text: string) => void) {
  const recognition = useRef<SpeechRecognition | null>(null);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    // Check browser support — works in Tauri's WebView on Windows
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    recognition.current = new SR();
    recognition.current.continuous = false;
    recognition.current.interimResults = false;
    recognition.current.lang = 'en-US';
    recognition.current.onresult = (e) => {
      const text = e.results[0][0].transcript;
      onTranscript(text);
      setListening(false);
    };
    recognition.current.onerror = () => setListening(false);
  }, []);

  const startListening = () => {
    recognition.current?.start();
    setListening(true);
  };
  const stopListening = () => {
    recognition.current?.stop();
    setListening(false);
  };

  return { listening, startListening, stopListening };
}
```

---

## Build Order — Follow This Exactly

The agent must build in this order. Each step should be committed and working before the next begins.

### Step 1 — Scaffold
- Init Tauri v2 project with React + TypeScript + Vite
- Install all dependencies: Framer Motion, Zustand, Tailwind v4
- Set up `tokens.css` with all CSS custom properties
- Confirm blank dark window opens on Windows

### Step 2 — Mascot Window
- Transparent, always-on-top, no decorations, 160×200px
- WALLE SVG rendered inside it
- Idle breathing animation running
- Draggable (Tauri `startDragging` on mousedown)
- Position saved to config on drag end

### Step 3 — Emotion Engine
- All 7 emotion states wired to CSS classes
- `EmotionEngine` transitions between states smoothly
- Test by cycling emotions manually via a hidden dev hotkey

### Step 4 — Global Hotkey + Chat Panel Toggle
- Register `Ctrl+Shift+Space` with `tauri-plugin-global-shortcut`
- Chat window appears/disappears, positioned relative to mascot
- Chat panel has glass styling, no content yet

### Step 5 — LLM Integration (Text)
- InputBar in chat panel, basic text send
- Call Anthropic API with system prompt
- Parse JSON response with `actionParser.ts`
- Display WALLE's message in chat
- Set emotion from response

### Step 6 — Notify Plugin
- Implement `send_notify` Tauri command
- Wire it from action parser → executor
- Test: "remind me to drink water" → OS notification appears

### Step 7 — App Launch Plugin
- Implement `launch_app` Tauri command
- Test: "open notepad" → Notepad opens

### Step 8 — Shell Plugin
- Implement `shell_run` with PowerShell on Windows
- Stream stdout back to chat as a code-block message
- Test: "what processes are using the most memory"

### Step 9 — Manual Review Mode
- ActionCard component built and styled
- Pending actions queue in Zustand
- Approve/Deny flow working
- WALLE plays `alert` when waiting for approval

### Step 10 — Auto Mode
- Executor runs actions directly without prompting
- WALLE shows `thinking` → `happy` or `sad` based on outcome
- ModeToggle switches between modes, persists to config

### Step 11 — Voice Input
- Microphone button in InputBar
- Push-to-talk via `Ctrl+Shift+V`
- Transcript feeds into same pipeline as text

### Step 12 — Config Panel (minimal)
- In-app settings: API key input, mode toggle, hotkey display
- Changes save to `walle.config.json`

### Step 13 — Polish Pass
- Smooth all Framer Motion transitions
- Make sure WALLE is never in a broken emotion state
- Error states (LLM timeout, command failed) handled gracefully
- macOS compatibility annotations reviewed — no Windows-specific code without a comment

### Step 14 — Build & Package
- Windows: `tauri build` → `.msi` installer
- Confirm mascot window is truly transparent on Windows 10 and 11
- README with setup instructions (API key setup, first run)

---

## Platform Notes (macOS Readiness)

Every place you write Windows-specific code, add this comment pattern:

```rust
// PLATFORM: Windows — powershell -Command
// macOS swap: zsh -c
// Linux swap: bash -c
```

```typescript
// PLATFORM: Windows — 'powershell'
// macOS swap: 'osascript' for app launch, 'zsh' for shell
```

This makes the macOS port a search-and-replace task, not a rewrite.

---

## What NOT to Build in Phase 1

If you find yourself building any of the following, stop and come back to scope:

- Plugin marketplace or external plugin loader
- SQLite memory / conversation persistence
- Screen capture / context injection
- Scheduled tasks / cron system
- Multi-agent chaining
- Skill recorder / learning mode
- Proactive background watchers
- Developer superpower mode (git integration, repo awareness)
- Settings beyond API key + mode + hotkeys
- Workflow UI builder (creation is conversational only in Phase 1)

These are Phase 2 and Phase 3. WALLE v0.1 is about: **show up, listen, feel, act, remember your workflows.**

---

## Definition of Done (Phase 1)

WALLE v0.1 is complete when:

- [ ] WALLE mascot is visible on screen corner after launch
- [ ] Mascot is draggable and position is saved
- [ ] `Ctrl+Shift+Space` opens and closes the chat panel
- [ ] User can type a message and WALLE responds
- [ ] User can speak a message and WALLE responds
- [ ] WALLE's emotion changes based on LLM response
- [ ] "Open [app]" works on Windows
- [ ] "Run [command]" executes in PowerShell and shows output
- [ ] OS notification can be triggered via WALLE
- [ ] Manual review mode shows ActionCard before executing
- [ ] Auto mode executes safe actions without prompting
- [ ] Moderate-risk actions always require approval regardless of mode
- [ ] Dangerous actions require typing "confirm" before Allow button activates
- [ ] Risk classifier overrides LLM-declared risk if classifier is stricter
- [ ] User can tell WALLE a sequence of steps and save it as a workflow
- [ ] User can run a saved workflow by name
- [ ] Workflows are persisted in `walle.config.json`
- [ ] Each step in a workflow is individually risk-checked during execution
- [ ] Config file is read on startup and written on change
- [ ] App packages to a working `.msi` on Windows
- [ ] All Windows-specific code is annotated for macOS swap
