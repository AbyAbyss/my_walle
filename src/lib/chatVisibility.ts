import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

/** True when the chat webview exists and is visible. */
export async function isChatVisible(): Promise<boolean> {
  try {
    const chat = await WebviewWindow.getByLabel("chat");
    if (!chat) return false;
    return await chat.isVisible();
  } catch {
    return false;
  }
}
