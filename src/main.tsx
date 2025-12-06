import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  console.error("Could not find root element");
} else {
  try {
    const root = createRoot(rootElement);
    root.render(<App />);
  } catch (error) {
    console.error("Failed to render app:", error);
    rootElement.innerHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #111827; color: white; font-family: system-ui, sans-serif; padding: 20px;">
        <div style="text-align: center; max-width: 400px;">
          <h1 style="font-size: 24px; margin-bottom: 16px;">Fejl ved indlæsning</h1>
          <p style="color: #9ca3af; margin-bottom: 16px;">Appen kunne ikke indlæses. Prøv at genindlæse siden.</p>
          <pre style="background: #1f2937; padding: 12px; border-radius: 8px; font-size: 12px; overflow: auto; text-align: left; color: #f87171;">${String(error)}</pre>
          <button onclick="location.reload()" style="margin-top: 16px; padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;">Genindlæs</button>
        </div>
      </div>
    `;
  }
}