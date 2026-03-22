import { getCurrentWindow } from "@tauri-apps/api/window";
import { SettingsPanelContent } from "../components/Settings/SettingsPanelContent";

export function SettingsWindow() {
  const handleClose = async () => {
    const win = getCurrentWindow();
    await win.hide();
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "transparent",
        boxSizing: "border-box",
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
          boxSizing: "border-box",
        }}
      >
        <div
          data-tauri-drag-region
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px 12px",
            borderBottom: "0.5px solid var(--walle-glass-border)",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: "13px",
              fontFamily: "var(--walle-font-ui)",
              color: "var(--walle-text-secondary)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Settings
          </span>
          <button
            type="button"
            onClick={() => void handleClose()}
            style={{
              background: "none",
              border: "none",
              color: "var(--walle-text-muted)",
              cursor: "pointer",
              fontSize: "16px",
              lineHeight: 1,
              padding: "2px 6px",
              borderRadius: "var(--walle-radius-sm)",
              transition: "var(--walle-transition)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--walle-text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--walle-text-muted)";
            }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
          <SettingsPanelContent onClose={() => void handleClose()} />
        </div>
      </div>
    </div>
  );
}
