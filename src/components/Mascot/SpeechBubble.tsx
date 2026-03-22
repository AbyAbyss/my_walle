import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface SpeechBubbleProps {
  text: string | null;
  onDismiss: () => void;
  mascotSide: "left" | "right";
}

export function SpeechBubble({ text, onDismiss, mascotSide }: SpeechBubbleProps) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!text) {
      setDisplayed("");
      setDone(false);
      return;
    }
    setDisplayed("");
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, 28);
    return () => clearInterval(interval);
  }, [text]);

  const tailSide = mascotSide === "right" ? "right" : "left";

  return (
    <AnimatePresence>
      {text && (
        <motion.div
          key={text}
          initial={{ opacity: 0, scale: 0.85, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -4 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          onClick={onDismiss}
          style={{
            position: "absolute",
            /* Sit below the face; smaller = lower in the pane (window 220×300). */
            bottom: "102px",
            ...(tailSide === "right" ? { right: "10px" } : { left: "10px" }),
            maxWidth: "220px",
            minWidth: "80px",
            cursor: "pointer",
            zIndex: 40,
          }}
        >
          <div
            style={{
              background: "var(--walle-bg-2)",
              border: "0.5px solid var(--walle-glass-border-hover)",
              borderRadius: "12px",
              padding: "10px 13px",
              boxShadow: `0 4px 24px rgba(0,0,0,0.4), var(--walle-cyan-glow)`,
              position: "relative",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "12px",
                fontFamily: "var(--walle-font-ui)",
                color: "var(--walle-text-primary)",
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
              }}
            >
              {displayed}
              {!done && (
                <span
                  style={{
                    display: "inline-block",
                    width: "1px",
                    height: "12px",
                    background: "var(--walle-cyan)",
                    marginLeft: "2px",
                    verticalAlign: "middle",
                    animation: "walle-cursor-blink 0.6s step-end infinite",
                  }}
                />
              )}
            </p>

            {done && (
              <span
                style={{
                  display: "block",
                  fontSize: "9px",
                  color: "var(--walle-text-muted)",
                  marginTop: "5px",
                  textAlign: "right",
                }}
              >
                tap to dismiss
              </span>
            )}

            <svg
              width="14"
              height="10"
              viewBox="0 0 14 10"
              style={{
                position: "absolute",
                bottom: "-9px",
                ...(tailSide === "right"
                  ? { right: "20px", transform: "scaleX(1)" }
                  : { left: "20px", transform: "scaleX(-1)" }),
              }}
              aria-hidden
            >
              <path d="M0 0 L14 0 L7 10 Z" fill="var(--walle-bg-2)" />
              <path
                d="M0.5 0.5 L7 9 L13.5 0.5"
                fill="none"
                stroke="var(--walle-glass-border-hover)"
                strokeWidth="0.5"
              />
            </svg>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
