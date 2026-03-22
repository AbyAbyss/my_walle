import { invoke } from "@tauri-apps/api/core";

import type { ChatMessage } from "../store/walleStore";

import { getChatSessionId } from "./chatSession";

export interface ConversationRowPayload {
  role: string;
  content: string;
  emotion: string | null;
  timestamp: string;
}

export function conversationRowsToMessages(rows: ConversationRowPayload[]): ChatMessage[] {
  return rows.map((r, i) => ({
    id: `persisted-${r.timestamp}-${i}`,
    role: r.role === "assistant" ? "assistant" : "user",
    text: r.content,
    at: Date.parse(r.timestamp) || Date.now(),
  }));
}

export async function persistConversationLine(
  role: "user" | "assistant",
  text: string,
  emotion?: string | null,
): Promise<void> {
  try {
    await invoke("conversation_append", {
      sessionId: getChatSessionId(),
      role,
      content: text,
      emotion: emotion ?? null,
    });
  } catch {
    /* DB optional path — never block chat */
  }
}
