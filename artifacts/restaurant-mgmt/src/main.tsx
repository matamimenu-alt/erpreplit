import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerPWA } from "./pwa";

createRoot(document.getElementById("root")!).render(<App />);

registerPWA();
