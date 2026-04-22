import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { isNative } from "./lib/platform";

// Register the offline-video service worker only on the web build.
// On native (Capacitor) we use the device filesystem instead — no SW needed.
if (!isNative && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/offline-video-sw.js", { scope: "/" })
      .catch((error) => console.error("Offline video worker registration failed:", error));
  });
}

createRoot(document.getElementById("root")!).render(<App />);

