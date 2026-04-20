import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register a very small worker that only serves cached offline video URLs.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/offline-video-sw.js", { scope: "/" })
      .catch((error) => console.error("Offline video worker registration failed:", error));
  });
}

createRoot(document.getElementById("root")!).render(<App />);
