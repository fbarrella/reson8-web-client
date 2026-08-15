import { Navigate, Outlet } from "react-router-dom";

import { useConnectionStore } from "@/stores/connectionStore";

/** Routes under /app are only reachable once USER_JOIN_SERVER has succeeded. */
export function RequireConnection() {
  const status = useConnectionStore((s) => s.status);

  if (status !== "connected") {
    return <Navigate to="/connect" replace />;
  }

  return <Outlet />;
}
