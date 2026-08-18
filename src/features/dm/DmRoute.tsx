import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Mail, X } from "lucide-react";

import { useDmStore } from "@/stores/dmStore";
import { loadOnlineUsers } from "@/services/dmService";
import { DmPane } from "@/features/dm/DmPane";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/**
 * Mirrors ChatRoute's composition 1:1 (Phase 4 PRD P4.1 / Phase 5 PRD
 * P5.1): mobile nav-stack destination with an explicit back button; `lg:` a
 * Tabs strip keeps several conversations open at once. Kept as a visually
 * separate strip from the channel tabs (different route namespace) rather
 * than merged into one bar — a reasonable implementation-detail call per
 * the PRD, not a desktop-parity requirement.
 */
export function DmRoute() {
  const { partnerId } = useParams<{ partnerId: string }>();
  const navigate = useNavigate();
  const partners = useDmStore((s) => s.partners);
  const openPartnerIds = useDmStore((s) => s.openPartnerIds);
  const partner = partnerId ? partners.get(partnerId) : undefined;

  useEffect(() => {
    if (!partnerId) return;
    useDmStore.getState().openPartner(partnerId);
    if (!useDmStore.getState().partners.has(partnerId)) void loadOnlineUsers();
  }, [partnerId]);

  if (!partnerId) return null;

  const closeTab = (id: string) => {
    useDmStore.getState().closePartner(id);
    if (id !== partnerId) return;
    const remaining = openPartnerIds.filter((openId) => openId !== id);
    navigate(remaining.length > 0 ? `/app/dms/${remaining[remaining.length - 1]}` : "/app/dms");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* base: full-screen header with explicit back navigation */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-2 lg:hidden">
        <button
          type="button"
          aria-label="Back to conversations"
          onClick={() => navigate("/app/dms")}
          className="flex size-11 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-5" />
        </button>
        <Mail className="size-4 text-muted-foreground" />
        <span className="truncate text-sm font-semibold text-foreground">{partner?.nickname ?? "Direct Message"}</span>
      </div>

      {/* md:/lg: tabs strip for multiple simultaneously-open conversations */}
      <Tabs value={partnerId} onValueChange={(id) => navigate(`/app/dms/${id}`)} className="hidden lg:block">
        <TabsList>
          {openPartnerIds.map((id) => {
            const tabPartner = partners.get(id);
            return (
              <TabsTrigger key={id} value={id} asChild>
                <div role="tab" className="group/tab cursor-pointer">
                  <Mail className="size-3.5" />
                  <span className="max-w-32 truncate">{tabPartner?.nickname ?? id}</span>
                  {tabPartner && tabPartner.unreadCount > 0 && id !== partnerId && (
                    <>
                      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-primary" />
                      <span className="sr-only">Unread</span>
                    </>
                  )}
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={`Close ${tabPartner?.nickname ?? "tab"}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(id);
                    }}
                    className={cn(
                      "ml-0.5 flex size-5 items-center justify-center rounded hover:bg-accent",
                      "opacity-0 group-hover/tab:opacity-100 focus-visible:opacity-100",
                    )}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      <DmPane partnerId={partnerId} />
    </div>
  );
}
