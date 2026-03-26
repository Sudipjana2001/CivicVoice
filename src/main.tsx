import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { applyPrivacyHeaders } from "./lib/privacyShield";

const syncDocumentThemeWithSystem = () => {
  const root = document.documentElement;
  const colorSchemeMedia = window.matchMedia("(prefers-color-scheme: dark)");

  const applyTheme = (isDark: boolean) => {
    root.classList.toggle("dark", isDark);
    root.style.colorScheme = isDark ? "dark" : "light";
  };

  applyTheme(colorSchemeMedia.matches);

  const handleThemeChange = (event: MediaQueryListEvent) => {
    applyTheme(event.matches);
  };

  if (typeof colorSchemeMedia.addEventListener === "function") {
    colorSchemeMedia.addEventListener("change", handleThemeChange);
    return;
  }

  colorSchemeMedia.addListener(handleThemeChange);
};

// Apply privacy hardening before app renders
applyPrivacyHeaders();
syncDocumentThemeWithSystem();

createRoot(document.getElementById("root")!).render(<App />);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  });
}
