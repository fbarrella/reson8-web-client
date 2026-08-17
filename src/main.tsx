import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { soundAlert } from "@/lib/soundAlert";
import { attachVoiceShortcutListeners } from "@/services/voiceShortcutService";
import { initInstallPromptListeners } from "@/services/installPromptService";
import App from "@/App";
import "@/index.css";

soundAlert.init();
attachVoiceShortcutListeners();
initInstallPromptListeners();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
