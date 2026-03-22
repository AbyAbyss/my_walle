import { motion } from "framer-motion";

import type { ChatMessage } from "../../store/walleStore";

function formatTime(at: number) {
  return new Date(at).toLocaleTimeString();
}

export default function MessageList({ messages }: { messages: ChatMessage[] }) {
  return (
    <div
      className="walle-chat-scroll flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2"
    >
      {messages.map((m) => {
        if (m.role === "bubble_echo") {
          return (
            <div
              key={m.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "4px 12px",
                opacity: 0.65,
              }}
            >
              <div
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "var(--walle-amber)",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: "12px",
                  fontFamily: "var(--walle-font-ui)",
                  color: "var(--walle-text-secondary)",
                  fontStyle: "italic",
                  lineHeight: 1.5,
                }}
              >
                {m.text}
              </span>
              <span
                style={{
                  fontSize: "10px",
                  color: "var(--walle-text-muted)",
                  marginLeft: "auto",
                  flexShrink: 0,
                }}
              >
                {formatTime(m.at)}
              </span>
            </div>
          );
        }

        return (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-[92%] text-sm px-3 py-2 rounded-lg"
            style={{
              marginLeft: m.role === "user" ? "auto" : 0,
              marginRight: m.role === "user" ? 0 : "auto",
              background:
                m.role === "user" ? "var(--walle-bg-3)" : "var(--walle-bg-2)",
              borderLeft:
                m.role === "assistant" ? "2px solid var(--walle-cyan)" : "none",
              color: "var(--walle-text-primary)",
            }}
          >
            <div>{m.text}</div>
            <div
              className="text-[11px] mt-1"
              style={{ color: "var(--walle-text-muted)" }}
            >
              {formatTime(m.at)}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
