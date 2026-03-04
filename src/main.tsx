import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { applyPrivacyHeaders } from "./lib/privacyShield";

// Apply privacy hardening before app renders
applyPrivacyHeaders();

createRoot(document.getElementById("root")!).render(<App />);
