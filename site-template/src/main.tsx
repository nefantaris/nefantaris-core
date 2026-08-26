import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App";
import "./app.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Failed to find the root element");

const app = (
    <StrictMode>
        <App />
    </StrictMode>
);

if (rootElement.firstElementChild) {
    hydrateRoot(rootElement, app);
} else {
    createRoot(rootElement).render(app);
}
