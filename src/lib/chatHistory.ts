import type { ChatMessage } from "../store/walleStore";

const MAX_HISTORY_MESSAGES = 20;
const MAX_CHARS_PER_MESSAGE = 4000;

export type ChatHistoryPayloadItem = {
  role: "user" | "assistant";
  text: string;
};

/** Prior turns only (excludes the message just appended for this send). Truncated for API limits. */
export function buildChatHistoryPayload(messages: ChatMessage[]): ChatHistoryPayloadItem[] {
  const prior = messages.slice(0, -1);
  const window = prior.slice(-MAX_HISTORY_MESSAGES);
  return window.map((m) => ({
    role: m.role,
    text:
      m.text.length > MAX_CHARS_PER_MESSAGE
        ? `${m.text.slice(0, MAX_CHARS_PER_MESSAGE)}… (truncated)`
        : m.text,
  }));
}
