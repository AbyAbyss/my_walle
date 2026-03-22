import type { Emotion } from "./emotion";

export type BubbleTrigger =
  | "first_open_today"
  | "morning"
  | "afternoon"
  | "evening"
  | "night"
  | "task_complete_single"
  | "task_complete_multi"
  | "task_failed"
  | "idle_bored";

export interface BubbleMessage {
  text: string;
  emotion: Emotion;
  duration_ms: number;
}

export const BUBBLE_POOL: Record<BubbleTrigger, BubbleMessage[]> = {
  first_open_today: [
    { text: "Hey, you're back. Ready to get things done?", emotion: "happy", duration_ms: 5000 },
    { text: "Good to see you again.", emotion: "happy", duration_ms: 4000 },
    { text: "You opened me. Bold move.", emotion: "idle", duration_ms: 4000 },
    { text: "Let's make today count.", emotion: "focused", duration_ms: 4000 },
    { text: "Back again. I missed you.", emotion: "happy", duration_ms: 4500 },
  ],

  morning: [
    { text: "Good morning. Coffee first, then we conquer.", emotion: "happy", duration_ms: 5000 },
    { text: "Morning. What are we building today?", emotion: "focused", duration_ms: 4500 },
    { text: "Good morning! Big day ahead?", emotion: "happy", duration_ms: 4000 },
    { text: "Rise and grind. I've been ready for hours.", emotion: "focused", duration_ms: 5000 },
    { text: "Morning. I didn't sleep either.", emotion: "idle", duration_ms: 4500 },
  ],

  afternoon: [
    { text: "Afternoon. Still going strong?", emotion: "idle", duration_ms: 4000 },
    { text: "Post-lunch slump? I'll help.", emotion: "happy", duration_ms: 4500 },
    { text: "Good afternoon. What's next?", emotion: "focused", duration_ms: 4000 },
    { text: "Halfway through the day. Nice work.", emotion: "happy", duration_ms: 4500 },
    { text: "Afternoon. Don't forget to drink water.", emotion: "idle", duration_ms: 5000 },
  ],

  evening: [
    { text: "Evening. Wrapping up or pushing through?", emotion: "idle", duration_ms: 5000 },
    { text: "Good evening. How'd the day go?", emotion: "happy", duration_ms: 4500 },
    { text: "Evening. You've earned a break.", emotion: "happy", duration_ms: 4500 },
    { text: "Still at it? Respect.", emotion: "focused", duration_ms: 4000 },
    { text: "Evening. Don't forget to eat.", emotion: "idle", duration_ms: 4500 },
  ],

  night: [
    { text: "It's late. I won't judge.", emotion: "idle", duration_ms: 5000 },
    { text: "Night owl mode. I'm with you.", emotion: "focused", duration_ms: 4500 },
    { text: "Up late again. Classic.", emotion: "idle", duration_ms: 4000 },
    { text: "You should probably sleep. But so should I.", emotion: "sleeping", duration_ms: 5000 },
    { text: "Late night session. Let's make it count.", emotion: "focused", duration_ms: 5000 },
  ],

  task_complete_single: [
    { text: "Done.", emotion: "happy", duration_ms: 2500 },
    { text: "Handled.", emotion: "happy", duration_ms: 2500 },
    { text: "Easy.", emotion: "happy", duration_ms: 2500 },
    { text: "That's what I'm here for.", emotion: "happy", duration_ms: 3500 },
    { text: "Boom. Done.", emotion: "happy", duration_ms: 2500 },
    { text: "Consider it handled.", emotion: "focused", duration_ms: 3000 },
  ],

  task_complete_multi: [
    { text: "All done. That was a good one.", emotion: "happy", duration_ms: 4000 },
    { text: "Workflow complete. Nailed it.", emotion: "happy", duration_ms: 4000 },
    { text: "Everything ran perfectly.", emotion: "happy", duration_ms: 3500 },
    { text: "Done and done. What's next?", emotion: "happy", duration_ms: 4000 },
    { text: "Multi-step, no problem.", emotion: "happy", duration_ms: 3500 },
  ],

  task_failed: [
    { text: "Hmm. That didn't work. Let me know what happened.", emotion: "sad", duration_ms: 5000 },
    { text: "Something went wrong. Sorry.", emotion: "sad", duration_ms: 4500 },
    { text: "That failed. Want to try again?", emotion: "sad", duration_ms: 5000 },
    { text: "Oof. That one didn't go well.", emotion: "sad", duration_ms: 4500 },
  ],

  idle_bored: [
    { text: "Still here if you need me.", emotion: "idle", duration_ms: 4000 },
    { text: "I'm not doing anything. Are you?", emotion: "idle", duration_ms: 4500 },
    { text: "Just vibing.", emotion: "idle", duration_ms: 3500 },
    { text: "I could automate something for you.", emotion: "focused", duration_ms: 4500 },
    { text: "Boop.", emotion: "idle", duration_ms: 2500 },
    { text: "Try saying 'open Chrome'. I dare you.", emotion: "idle", duration_ms: 5000 },
    { text: "Did you know I can run workflows? Ask me.", emotion: "focused", duration_ms: 5000 },
    { text: "I'm watching your screen. That's my job.", emotion: "focused", duration_ms: 4500 },
    { text: "...", emotion: "sleeping", duration_ms: 3000 },
    { text: "I was almost asleep.", emotion: "sleeping", duration_ms: 4000 },
    { text: "Your move.", emotion: "idle", duration_ms: 3000 },
    { text: "Is it just me or is it quiet in here?", emotion: "idle", duration_ms: 4500 },
  ],
};

export function pickMessage(trigger: BubbleTrigger, lastShownText: string | null): BubbleMessage {
  const pool = BUBBLE_POOL[trigger];
  const candidates = pool.filter((m) => m.text !== lastShownText);
  const source = candidates.length > 0 ? candidates : pool;
  return source[Math.floor(Math.random() * source.length)];
}

/** Map hour (0–23) to time-based trigger; used by `getTimeTrigger` and unit tests. */
export function timeTriggerForHour(hour: number): BubbleTrigger {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

export function getTimeTrigger(): BubbleTrigger {
  return timeTriggerForHour(new Date().getHours());
}
