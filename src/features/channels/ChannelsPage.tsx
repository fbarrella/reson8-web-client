import { ChannelTreePanel } from "@/features/channels/ChannelTreePanel";

/**
 * Mobile: this page IS the "Channels" destination (nav-stack pattern).
 * md/lg: the tree is already persistent in AppShell, so this pane shows a
 * placeholder until Phase 2/4 give it real chat/voice content.
 */
export function ChannelsPage() {
  return (
    <>
      <ChannelTreePanel className="lg:hidden" />
      <div className="hidden h-full items-center justify-center p-8 text-center text-sm text-muted-foreground lg:flex">
        Select a channel to get started. Voice and chat land in Phases 2 and 4.
      </div>
    </>
  );
}
