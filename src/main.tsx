import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Always unregister any service worker (legacy from previous PWA setup) and clear caches.
// Service workers were causing video stream interception + reload loops on mobile.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister().catch(() => {}));
  }).catch(() => {});
}
if ("caches" in window) {
  caches.keys().then((keys) => {
    keys.forEach((k) => caches.delete(k).catch(() => {}));
  }).catch(() => {});
}

createRoot(document.getElementById("root")!).render(<App />);
