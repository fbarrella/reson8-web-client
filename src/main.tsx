import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { soundAlert } from "@/lib/soundAlert";
import { attachVoiceShortcutListeners } from "@/services/voiceShortcutService";
import App from "@/App";
import "@/index.css";

soundAlert.init();
attachVoiceShortcutListeners();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
