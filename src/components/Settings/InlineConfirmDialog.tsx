interface InlineConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Primary action label (default: Delete). Use e.g. "Enable" for opt-in prompts. */
  confirmLabel?: string;
}

export function InlineConfirmDialog({
  message,
  onConfirm,
  onCancel,
  confirmLabel = "Delete",
}: InlineConfirmDialogProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(10, 10, 15, 0.75)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        borderRadius: "inherit",
      }}
    >
      <div
        style={{
          background: "var(--walle-bg-2)",
          border: "0.5px solid var(--walle-glass-border-hover)",
          borderRadius: "var(--walle-radius-lg)",
          padding: "24px",
          width: "280px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        <p
          style={{
            fontSize: "14px",
            color: "var(--walle-text-primary)",
            fontFamily: "var(--walle-font-ui)",
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {message}
        </p>
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "7px 16px",
              background: "none",
              border: "0.5px solid var(--walle-glass-border-hover)",
              borderRadius: "var(--walle-radius-md)",
              color: "var(--walle-text-secondary)",
              fontSize: "13px",
              fontFamily: "var(--walle-font-ui)",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: "7px 16px",
              background: "var(--walle-red)",
              border: "none",
              borderRadius: "var(--walle-radius-md)",
              color: "white",
              fontSize: "13px",
              fontFamily: "var(--walle-font-ui)",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
