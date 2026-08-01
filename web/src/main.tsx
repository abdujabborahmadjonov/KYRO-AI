import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { Landing } from "./Landing";
import "./styles.css";

const isApp = window.location.pathname.startsWith("/app");

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>{isApp ? <App /> : <Landing />}</React.StrictMode>,
);
