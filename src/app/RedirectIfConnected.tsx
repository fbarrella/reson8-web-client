import { Navigate, Outlet } from "react-router-dom";

import { useConnectionStore } from "@/stores/connectionStore";

/** Bounces an already-connected session away from /connect (e.g. client-side back nav). */
export function RedirectIfConnected() {
  const status = useConnectionStore((s) => s.status);

  if (status === "connected") {
    return <Navigate to="/app" replace />;
  }

  return <Outlet />;
}
