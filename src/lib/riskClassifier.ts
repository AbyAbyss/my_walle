import type { WalleAction } from "./actionParser";

export type RiskLevel = "safe" | "moderate" | "dangerous";

export const RISK_RULES: {
  patterns: RegExp[];
  level: RiskLevel;
  reason: string;
}[] = [
  {
    patterns: [/rm\s+-rf/i, /Remove-Item.*-Recurse/i, /format\s+[a-z]:/i],
    level: "dangerous",
    reason: "Recursive or permanent deletion",
  },
  {
    patterns: [/shutdown|restart|reboot/i],
    level: "dangerous",
    reason: "System power state change",
  },
  {
    patterns: [/reg\s+(add|delete|import)/i, /regedit/i],
    level: "dangerous",
    reason: "Registry modification",
  },
  {
    patterns: [/curl.*\|\s*(bash|sh|powershell)/i, /Invoke-Expression/i],
    level: "dangerous",
    reason: "Remote code execution",
  },
  {
    patterns: [/net\s+user|net\s+localgroup/i],
    level: "dangerous",
    reason: "User account modification",
  },
  {
    patterns: [/rm\s+(?!.*-rf)/i, /Remove-Item(?!.*-Recurse)/i, /del\s+/i],
    level: "moderate",
    reason: "File deletion (non-recursive)",
  },
  {
    patterns: [/npm install|pip install|cargo install|winget install/i],
    level: "moderate",
    reason: "Package installation",
  },
  {
    patterns: [/git\s+push/i, /git\s+reset\s+--hard/i, /git\s+rebase/i],
    level: "dangerous",
    reason: "Destructive or remote git operation",
  },
  {
    patterns: [/git\s+(commit|add|checkout|merge)/i],
    level: "moderate",
    reason: "Git state change",
  },
  {
    patterns: [/git\s+(status|log|diff|branch|stash\s+list)/i],
    level: "safe",
    reason: "Read-only git operation",
  },
  {
    patterns: [/Move-Item|mv\s+|Copy-Item.*-Force/i],
    level: "moderate",
    reason: "File move or forced copy",
  },
];

export function classifyRisk(command: string): RiskLevel {
  for (const rule of RISK_RULES) {
    if (rule.patterns.some((p) => p.test(command))) return rule.level;
  }
  return "safe";
}

function llmRiskToLevel(r: string): RiskLevel {
  if (r === "high") return "dangerous";
  if (r === "medium") return "moderate";
  return "safe";
}

export function mergeRisk(llmRisk: RiskLevel, classifierRisk: RiskLevel): RiskLevel {
  const order: Record<RiskLevel, number> = { safe: 0, moderate: 1, dangerous: 2 };
  return order[classifierRisk] >= order[llmRisk] ? classifierRisk : llmRisk;
}

function actionProbe(a: WalleAction): string {
  const p = a.params;
  if (a.plugin === "shell") return String(p.command ?? "");
  if (a.plugin === "app_launch") return String(p.app ?? "");
  if (a.plugin === "git_push") return "git push";
  if (a.plugin === "git_commit") return "git commit";
  if (a.plugin === "git_checkout") return "git checkout";
  if (a.plugin === "git_status") return "git status";
  if (a.plugin === "git_log") return "git log";
  if (a.plugin === "git_diff") return "git diff";
  if (a.plugin === "external" || a.plugin === "ext_shell") return "external";
  return "";
}

export function effectiveRisk(action: WalleAction): RiskLevel {
  const llm = llmRiskToLevel(action.risk);
  const enforced = classifyRisk(actionProbe(action));
  return mergeRisk(llm, enforced);
}

export function needsApproval(
  action: WalleAction,
  mode: "auto" | "manual_review",
): boolean {
  // Saved workflows are user-defined; running them is an explicit request — do not
  // block on a second "Allow" click (that felt like "nothing happens").
  if (action.plugin === "run_workflow") return false;
  if (action.plugin === "schedule_list") return false;
  if (action.plugin === "git_status" || action.plugin === "git_log" || action.plugin === "git_diff") {
    return false;
  }

  const effective = effectiveRisk(action);
  if (effective === "dangerous") return true;
  if (effective === "moderate") return true;
  if (effective === "safe" && mode === "manual_review") return true;
  return false;
}
