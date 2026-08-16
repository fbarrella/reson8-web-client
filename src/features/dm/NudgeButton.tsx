import { useState } from "react";
import { BellRing } from "lucide-react";

import { useServerSettingsStore } from "@/stores/serverSettingsStore";
import { nudgeUser } from "@/services/dmService";
import { toast } from "@/stores/toastStore";
import { Button } from "@/components/ui/button";

const COOLDOWN_MS = 30_000;

/**
 * Client-side disable is UX only — the real 30s per-(sender,target) cooldown
 * is server-enforced (a rejected ack still resets the local disable so a
 * clock-skewed client isn't stuck locked out longer than the server itself
 * requires — Phase 5 PRD P5.6). Hidden entirely when the server admin has
 * disabled Nudge server-wide.
 */
export function NudgeButton({ partnerId }: { partnerId: string }) {
  const nudgeEnabled = useServerSettingsStore((s) => s.nudgeEnabled);
  const [cooldown, setCooldown] = useState(false);

  if (!nudgeEnabled) return null;

  const handleNudge = async () => {
    setCooldown(true);
    const success = await nudgeUser(partnerId);
    if (!success) {
      setCooldown(false);
      return;
    }
    toast({ title: "Nudge sent", variant: "success" });
    setTimeout(() => setCooldown(false), COOLDOWN_MS);
  };

  return (
    <Button type="button" variant="ghost" size="sm" disabled={cooldown} onClick={() => void handleNudge()}>
      <BellRing className="size-4" /> Nudge
    </Button>
  );
}
