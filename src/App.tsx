import { Navigate, Route, Routes } from "react-router-dom";

import { RequireConnection } from "@/app/RequireConnection";
import { RedirectIfConnected } from "@/app/RedirectIfConnected";
import { AppShell } from "@/app/AppShell";
import { PlaceholderPane } from "@/app/PlaceholderPane";
import { ConnectScreen } from "@/features/connection/ConnectScreen";
import { ChannelsPage } from "@/features/channels/ChannelsPage";
import { ChatRoute } from "@/features/chat/ChatRoute";
import { ChatTabPage } from "@/features/chat/ChatTabPage";
import { DmsListPage } from "@/features/dm/DmsListPage";
import { DmRoute } from "@/features/dm/DmRoute";
import { SettingsSheet } from "@/features/settings/SettingsSheet";
import { Toaster } from "@/components/ui/toaster";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/connect" replace />} />
        <Route element={<RedirectIfConnected />}>
          <Route path="/connect" element={<ConnectScreen />} />
        </Route>

        <Route element={<RequireConnection />}>
          <Route path="/app" element={<AppShell />}>
            <Route index element={<ChannelsPage />} />
            <Route path="channels/:channelId" element={<ChatRoute />} />
            <Route path="chat" element={<ChatTabPage />} />
            <Route path="dms" element={<DmsListPage />} />
            <Route path="dms/:partnerId" element={<DmRoute />} />
            <Route path="voice" element={<PlaceholderPane title="Voice" phase="Phase 2" />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/connect" replace />} />
      </Routes>

      <SettingsSheet />
      <Toaster />
    </>
  );
}
