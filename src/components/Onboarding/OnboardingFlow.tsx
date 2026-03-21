import { useEffect, useState } from "react";

import type { Animation } from "../../lib/animation";
import { saveUiPreferences } from "../../lib/uiPreferences";
import { useWalleStore } from "../../store/walleStore";

const STEPS: {
  step: number;
  animation: Animation;
  title: string;
  body: string;
  action: { label: string; prefill: string | null } | null;
}[] = [
  {
    step: 1,
    animation: "wave",
    title: "Hi! I'm WALLE 👋",
    body: "I live on your desktop and help you get things done. Just talk to me like a person.",
    action: null,
  },
  {
    step: 2,
    animation: "excited_run",
    title: "I can open apps for you",
    body: 'Try saying: "Open Spotify" or "Open Chrome"',
    action: { label: "Try it now", prefill: "Open Notepad" },
  },
  {
    step: 3,
    animation: "thumbs_up",
    title: "I can run tasks automatically",
    body: "When I need to do something, I'll always show you what I'm about to do before I do it.",
    action: null,
  },
  {
    step: 4,
    animation: "dance",
    title: "Save time with workflows",
    body: 'Tell me: "Save opening VS Code and Slack as start work" — then just say "start work" anytime.',
    action: null,
  },
  {
    step: 5,
    animation: "pet",
    title: "You can also just click me",
    body: "Anytime you want to talk, press Ctrl+Shift+Space or just click me. I'm always here.",
    action: { label: "Let's go!", prefill: null },
  },
];

interface OnboardingFlowProps {
  onDismiss: () => void;
  onTrySend?: (text: string) => void;
}

export default function OnboardingFlow({ onDismiss, onTrySend }: OnboardingFlowProps) {
  const [index, setIndex] = useState(0);
  const playAnimation = useWalleStore((s) => s.playAnimation);

  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  useEffect(() => {
    playAnimation(step.animation);
  }, [index, step.animation, playAnimation]);

  const finish = async () => {
    try {
      await saveUiPreferences({ onboarding_complete: true });
    } catch {
      /* still dismiss */
    }
    onDismiss();
  };

  const skip = async () => {
    await finish();
  };

  const next = () => {
    if (isLast) {
      void finish();
      return;
    }
    setIndex((i) => i + 1);
  };

  return (
    <div
      className="absolute z-40 left-3 right-3 bottom-[120px] pointer-events-auto"
      style={{
        maxWidth: 340,
        margin: "0 auto",
      }}
    >
      <div
        className="glass-panel p-4 text-left"
        style={{
          borderRadius: "var(--walle-radius-lg)",
          border: "0.5px solid var(--walle-glass-border)",
        }}
      >
        <div
          className="text-[10px] uppercase tracking-wider mb-2"
          style={{ color: "var(--walle-text-muted)" }}
        >
          Step {step.step} of {STEPS.length}
        </div>
        <h3 className="text-sm font-medium m-0 mb-2" style={{ color: "var(--walle-text-primary)" }}>
          {step.title}
        </h3>
        <p className="text-[13px] m-0 mb-4 leading-relaxed" style={{ color: "var(--walle-text-secondary)" }}>
          {step.body}
        </p>
        {step.action?.prefill && (
          <button
            type="button"
            className="text-[12px] mb-4 px-3 py-1.5 rounded-lg"
            style={{
              background: "var(--walle-bg-2)",
              border: "1px solid var(--walle-glass-border)",
              color: "var(--walle-cyan)",
            }}
            onClick={() => onTrySend?.(step.action!.prefill!)}
          >
            {step.action.label}
          </button>
        )}
        <div className="flex justify-end gap-2 flex-wrap">
          <button
            type="button"
            className="text-[12px] px-3 py-1.5 rounded-lg"
            style={{ color: "var(--walle-text-muted)" }}
            onClick={() => void skip()}
          >
            Skip
          </button>
          <button
            type="button"
            className="text-[12px] px-3 py-1.5 rounded-lg font-medium"
            style={{
              border: "1px solid var(--walle-cyan)",
              color: "var(--walle-cyan)",
              background: "transparent",
            }}
            onClick={() => next()}
          >
            {isLast ? (step.action?.label ?? "Done") : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
