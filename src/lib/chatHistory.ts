import type { ChatMessage } from "../store/walleStore";

const MAX_HISTORY_MESSAGES = 20;
const MAX_CHARS_PER_MESSAGE = 4000;

/** Unprompted mascot bubble echoes must not reach the LLM. */
function excludeBubbleEcho(
  messages: ChatMessage[],
): (ChatMessage & { role: "user" | "assistant" })[] {
  return messages.filter(
    (m): m is ChatMessage & { role: "user" | "assistant" } =>
      m.role === "user" || m.role === "assistant",
  );
}

export type ChatHistoryPayloadItem = {
  role: "user" | "assistant";
  text: string;
};

/** Prior turns only (excludes the message just appended for this send). Truncated for API limits. */
export function buildChatHistoryPayload(messages: ChatMessage[]): ChatHistoryPayloadItem[] {
  const filtered = excludeBubbleEcho(messages);
  const prior = filtered.slice(0, -1);
  const window = prior.slice(-MAX_HISTORY_MESSAGES);
  return window.map((m) => ({
    role: m.role,
    text:
      m.text.length > MAX_CHARS_PER_MESSAGE
        ? `${m.text.slice(0, MAX_CHARS_PER_MESSAGE)}… (truncated)`
        : m.text,
  }));
}

function truncateMessageText(text: string): string {
  return text.length > MAX_CHARS_PER_MESSAGE
    ? `${text.slice(0, MAX_CHARS_PER_MESSAGE)}… (truncated)`
    : text;
}

/**
 * Full recent transcript for post-tool follow-up (includes the latest assistant lines, e.g. shell **Result**).
 */
export function buildHistoryForFollowUp(messages: ChatMessage[]): ChatHistoryPayloadItem[] {
  const window = excludeBubbleEcho(messages).slice(-MAX_HISTORY_MESSAGES);
  return window.map((m) => ({
    role: m.role,
    text: truncateMessageText(m.text),
  }));
}

/** Internal user turn for follow-up LLM call (not shown in UI). */
export const TOOL_FOLLOWUP_USER_TEXT = `[WALLE internal] The transcript above includes the user's question and raw tool output (e.g. lines starting with **Result**). Reply ONLY with valid JSON matching the usual schema. Set "actions": [] and "requires_approval": false. The "message" field must briefly answer the user's question using that tool output (one or two sentences). Pick an appropriate "emotion".`;

/** Full recent transcript for multi-step agent continuation (includes latest tool lines). */
export function buildChatHistoryForAgentContinue(messages: ChatMessage[]): ChatHistoryPayloadItem[] {
  const window = excludeBubbleEcho(messages).slice(-MAX_HISTORY_MESSAGES);
  return window.map((m) => ({
    role: m.role,
    text: truncateMessageText(m.text),
  }));
}

/** Planner round after the first — not shown as a user chat line; sent only in the LLM payload. */
export function buildAgentContinueUserText(step: number, maxSteps: number): string {
  return `[WALLE agent] Planner round ${step}/${maxSteps}. Continue the user's task using the full transcript (including **Result** and tool output). Reply with valid JSON only. Use "actions": [] when the task is complete or cannot proceed.`;
}
