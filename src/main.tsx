import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { soundAlert } from "@/lib/soundAlert";
import { attachVoiceShortcutListeners } from "@/services/voiceShortcutService";
import { initInstallPromptListeners } from "@/services/installPromptService";
import { initServiceWorkerUpdateFlow } from "@/services/swUpdateService";
import App from "@/App";
import "@/index.css";

soundAlert.init();
attachVoiceShortcutListeners();
initInstallPromptListeners();
initServiceWorkerUpdateFlow();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
