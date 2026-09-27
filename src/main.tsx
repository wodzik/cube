import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import App from "./App";
import { prepareScrambles } from "./services/scrambleQueue";

// Start the solver worker right away (its tables take a moment) and keep a scramble ready.
prepareScrambles();

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
