import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import App from "./App";
import { prepareScrambles } from "./services/scrambleQueue";
import { healStageBoundaries } from "./services/stageHeal";
import { migrateAlgorithmStorage } from "./services/algGroupRegistry";

// Built-in algorithm sets became read-only (stable ids): move stored progress over, once, before anything reads it.
migrateAlgorithmStorage();

// Start the solver worker right away (its tables take a moment) and keep a scramble ready.
prepareScrambles();
// Older solves' CFOP / LBL stages with the current detection — once, in the background.
setTimeout(() => void healStageBoundaries().catch(() => undefined), 4000);

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
