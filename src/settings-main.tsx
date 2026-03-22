import React from "react";
import ReactDOM from "react-dom/client";

import { SettingsWindow } from "./windows/SettingsWindow";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SettingsWindow />
  </React.StrictMode>,
);
