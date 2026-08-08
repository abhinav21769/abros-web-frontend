import { createRoot } from "react-dom/client";
import "./utils/logger.js";
import App from "./App.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(<App />);
