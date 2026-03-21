import React from "react";
import ReactDOM from "react-dom/client";

import ChatPanel from "./components/Chat/ChatPanel";
import "./styles/globals.css";
import "./styles/animations.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <div
      className="h-full min-h-0 w-full"
      style={{
        background: "transparent",
        width: 380,
        height: 620,
      }}
    >
      <ChatPanel />
    </div>
  </React.StrictMode>,
);
