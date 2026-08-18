import { Suspense, lazy, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { RequireConnection } from "@/app/RequireConnection";
import { RedirectIfConnected } from "@/app/RedirectIfConnected";
import { ConnectScreen } from "@/features/connection/ConnectScreen";
import { WhatsNewModal } from "@/features/pwa/WhatsNewModal";
import { Toaster } from "@/components/ui/toaster";
import { useConnectionStore } from "@/stores/connectionStore";

// Both are only ever actionable once connected (Settings' only trigger lives
// in AppHeader; InstallPrompt no-ops until `status === "connected"`), so —
// same P7.6 rationale as the /app route tree below — neither needs to be in
// the connect-screen's initial bundle even though both are unconditionally
// mounted here.
const SettingsSheet = lazy(() =>
  import("@/features/settings/SettingsSheet").then((m) => ({ default: m.SettingsSheet })),
);
const InstallPrompt = lazy(() =>
  import("@/features/pwa/InstallPrompt").then((m) => ({ default: m.InstallPrompt })),
);

// Everything reachable only after a successful connection (P7.6: route-based
// code splitting) — pulls the whole channels/chat/dm/voice feature set,
// mediasoup-client, and dnd-kit out of the initial connect-screen bundle.
// A user who hasn't connected yet never needs any of this JS.
const AppShell = lazy(() => import("@/app/AppShell").then((m) => ({ default: m.AppShell })));
const PlaceholderPane = lazy(() =>
  import("@/app/PlaceholderPane").then((m) => ({ default: m.PlaceholderPane })),
);
const ChannelsPage = lazy(() =>
  import("@/features/channels/ChannelsPage").then((m) => ({ default: m.ChannelsPage })),
);
const ChatRoute = lazy(() => import("@/features/chat/ChatRoute").then((m) => ({ default: m.ChatRoute })));
const ChatTabPage = lazy(() =>
  import("@/features/chat/ChatTabPage").then((m) => ({ default: m.ChatTabPage })),
);
const DmsListPage = lazy(() =>
  import("@/features/dm/DmsListPage").then((m) => ({ default: m.DmsListPage })),
);
const DmRoute = lazy(() => import("@/features/dm/DmRoute").then((m) => ({ default: m.DmRoute })));

interface AppProps {
  hadExistingInstanceId: boolean;
}

export default function App({ hadExistingInstanceId }: AppProps) {
  // `React.lazy` only defers a chunk's fetch until it's actually about to
  // render — an unconditionally-mounted lazy component (wrapped in Suspense
  // or not) still triggers its import() on first render, same as a static
  // import would, just with an extra loading-fallback frame. SettingsSheet
  // and InstallPrompt are only ever actionable post-connection, so gate
  // their mount on having connected at least once (not strictly
  // `status === "connected"`, so a brief "reconnecting" blip doesn't
  // unmount an open Settings sheet and lose its state).
  const status = useConnectionStore((s) => s.status);
  const [hasEverConnected, setHasEverConnected] = useState(status === "connected");
  // Adjust state during render (React's documented pattern for a one-way
  // latch derived from a prop/store value) rather than in an effect — this
  // needs to flip the instant `status` becomes "connected", not one render
  // later, and never needs to un-flip.
  if (status === "connected" && !hasEverConnected) {
    setHasEverConnected(true);
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/connect" replace />} />
        <Route element={<RedirectIfConnected />}>
          <Route path="/connect" element={<ConnectScreen />} />
        </Route>

        <Route element={<RequireConnection />}>
          <Route
            path="/app"
            element={
              <Suspense fallback={null}>
                <AppShell />
              </Suspense>
            }
          >
            <Route
              index
              element={
                <Suspense fallback={null}>
                  <ChannelsPage />
                </Suspense>
              }
            />
            <Route
              path="channels/:channelId"
              element={
                <Suspense fallback={null}>
                  <ChatRoute />
                </Suspense>
              }
            />
            <Route
              path="chat"
              element={
                <Suspense fallback={null}>
                  <ChatTabPage />
                </Suspense>
              }
            />
            <Route
              path="dms"
              element={
                <Suspense fallback={null}>
                  <DmsListPage />
                </Suspense>
              }
            />
            <Route
              path="dms/:partnerId"
              element={
                <Suspense fallback={null}>
                  <DmRoute />
                </Suspense>
              }
            />
            <Route
              path="voice"
              element={
                <Suspense fallback={null}>
                  <PlaceholderPane title="Voice" phase="Phase 2" />
                </Suspense>
              }
            />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/connect" replace />} />
      </Routes>

      {hasEverConnected && (
        <Suspense fallback={null}>
          <SettingsSheet />
        </Suspense>
      )}
      {hasEverConnected && (
        <Suspense fallback={null}>
          <InstallPrompt />
        </Suspense>
      )}
      <WhatsNewModal hadExistingInstanceId={hadExistingInstanceId} />
      <Toaster />
    </>
  );
}
