const SESSION_KEY = "walle_chat_session_id";

/** Stable per-browser session for SQLite conversation rows. */
export function getChatSessionId(): string {
  if (typeof localStorage === "undefined") {
    return "default";
  }
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}
