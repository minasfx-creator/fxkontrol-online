import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Dismiss splash screen after React mounts
requestAnimationFrame(() => {
  (window as any).__splashDone?.();
});
