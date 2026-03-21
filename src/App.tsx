/**
 * Default Vite entry (`index.html`). The live app window uses `mascot.html` → `mascot.tsx`.
 */
function App() {
  return (
    <main
      style={{
        minHeight: "100vh",
        margin: 0,
        background: "#0a0a0f",
        color: "#7a7f94",
        fontFamily: "system-ui, sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      WALLE — use `npm run tauri dev` (mascot window).
    </main>
  );
}

export default App;
