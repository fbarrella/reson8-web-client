import { useEffect } from "react";

import { useDmStore } from "@/stores/dmStore";
import { markDmsRead, sendDirectMessage } from "@/services/dmService";
import { DmMessageList } from "@/features/dm/DmMessageList";
import { NudgeButton } from "@/features/dm/NudgeButton";
import { Composer } from "@/features/chat/Composer";

function DmPartnerBar({ partnerId }: { partnerId: string }) {
  const partner = useDmStore((s) => s.partners.get(partnerId));
  return (
    <div className="flex min-h-11 items-center gap-2 border-b border-border px-3 py-2">
      <span
        aria-label={partner?.isOnline ? "Online" : "Offline"}
        className={`size-2 shrink-0 rounded-full ${partner?.isOnline ? "bg-success" : "bg-muted-foreground/40"}`}
      />
      <span className="flex-1 truncate text-sm font-medium text-foreground">
        {partner?.nickname ?? "Direct Message"}
      </span>
      <NudgeButton partnerId={partnerId} />
    </div>
  );
}

/**
 * DM equivalent of ChatPane (Phase 4 PRD P4.1 pattern reused for Phase 5
 * PRD P5.3) — same "one component set, three compositions" shared surface
 * rendered beneath both the mobile nav-stack destination and the desktop
 * tabs strip.
 */
export function DmPane({ partnerId }: { partnerId: string }) {
  useEffect(() => {
    useDmStore.getState().setActivePartner(partnerId);
    void markDmsRead(partnerId);
    return () => {
      if (useDmStore.getState().activePartnerId === partnerId) {
        useDmStore.getState().setActivePartner(null);
      }
    };
  }, [partnerId]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <DmPartnerBar partnerId={partnerId} />
      <DmMessageList partnerId={partnerId} />
      <Composer onSend={(content, url, publicId) => sendDirectMessage(partnerId, content, url, publicId)} />
    </div>
  );
}
