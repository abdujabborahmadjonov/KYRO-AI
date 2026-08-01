import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { Landing } from "./Landing";
import { StoryLibrary } from "./StoryLibrary";
import "./styles.css";

const path = window.location.pathname;
const page = path.startsWith("/app") ? <App /> : path.startsWith("/stories") ? <StoryLibrary /> : <Landing />;

createRoot(document.getElementById("root")!).render(<React.StrictMode>{page}</React.StrictMode>);
