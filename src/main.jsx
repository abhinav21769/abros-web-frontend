import { createRoot } from "react-dom/client";
import { initLogger } from "./utils/logger.js";
import App from "./App.jsx";
import "./index.css";

// M-4 FIX: Explicit init call rather than side-effect import
initLogger();

createRoot(document.getElementById("root")).render(<App />);
