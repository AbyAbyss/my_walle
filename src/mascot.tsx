import React from "react";
import ReactDOM from "react-dom/client";
import MascotWindow from "./windows/MascotWindow";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <MascotWindow />
  </React.StrictMode>,
);
