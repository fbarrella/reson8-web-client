import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getOrCreateInstanceId } from "@/lib/instanceId";

export function AboutTab() {
  const [copied, setCopied] = useState(false);
  const instanceId = getOrCreateInstanceId();

  const handleCopy = () => {
    void navigator.clipboard.writeText(instanceId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Reson8 Web Client</h3>
        <p className="text-sm text-muted-foreground">
          A mobile-first Progressive Web App client for Reson8.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">Version</span>
        <span className="text-sm text-muted-foreground">{__APP_VERSION__}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">Instance ID</span>
        <p className="text-xs text-muted-foreground">
          Your persistent, login-free identity on this browser profile.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
            {instanceId}
          </code>
          <Button type="button" variant="outline" size="icon" onClick={handleCopy} aria-label="Copy instance ID">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
