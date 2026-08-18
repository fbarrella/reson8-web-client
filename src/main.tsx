import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { soundAlert } from "@/lib/soundAlert";
import { attachVoiceShortcutListeners } from "@/services/voiceShortcutService";
import { initInstallPromptListeners } from "@/services/installPromptService";
import { initServiceWorkerUpdateFlow } from "@/services/swUpdateService";
import { hasExistingInstanceId } from "@/lib/instanceId";
import App from "@/App";
import "@/index.css";

soundAlert.init();
attachVoiceShortcutListeners();
initInstallPromptListeners();
initServiceWorkerUpdateFlow();

// Must be read before React renders anything — the first thing that could
// otherwise create `reson8-instance-id` this session (submitting the
// connect form) hasn't had a chance to run yet. See whatsNew.ts.
const hadExistingInstanceId = hasExistingInstanceId();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App hadExistingInstanceId={hadExistingInstanceId} />
    </BrowserRouter>
  </StrictMode>,
);
