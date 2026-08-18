import { Suspense, lazy, useState, type ReactNode } from "react";

import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

// P7.6: defers the ~552-entry emoji dataset and the crop-tooling dialog out
// of the initial bundle — neither is needed until the picker is actually
// opened (or, for the upload dialog, until the picker's own "upload custom
// emoji" affordance is used).
const EmojiPickerContent = lazy(() =>
  import("@/features/emoji/EmojiPickerContent").then((m) => ({ default: m.EmojiPickerContent })),
);
const CustomEmojiUploadDialog = lazy(() =>
  import("@/features/emoji/CustomEmojiUploadDialog").then((m) => ({ default: m.CustomEmojiUploadDialog })),
);

/**
 * Shared trigger+popover wrapper around EmojiPickerContent — used both for
 * composer insertion (P4.7) and, with a different `onPick`, reaction-
 * targeting mode from a message's "add reaction" affordance (P4.8). `token`
 * is either a raw unicode emoji or a `:name:` string for a custom one; the
 * caller decides what to do with it.
 */
export function EmojiPicker({
  trigger,
  onPick,
  align = "end",
}: {
  trigger: ReactNode;
  onPick: (token: string) => void;
  align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          align={align}
          className="w-auto p-0"
          aria-label="Emoji picker"
          onClick={(e) => e.stopPropagation()}
        >
          {open && (
            <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading…</div>}>
              <EmojiPickerContent
                onSelectEmoji={(emoji) => {
                  onPick(emoji);
                  setOpen(false);
                }}
                onSelectCustomEmoji={(name) => {
                  onPick(`:${name}:`);
                  setOpen(false);
                }}
                onRequestUpload={() => {
                  setOpen(false);
                  setUploadOpen(true);
                }}
              />
            </Suspense>
          )}
        </PopoverContent>
      </Popover>
      {uploadOpen && (
        <Suspense fallback={null}>
          <CustomEmojiUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
        </Suspense>
      )}
    </>
  );
}
