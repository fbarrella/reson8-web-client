import { useState, type ReactNode } from "react";

import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { EmojiPickerContent } from "@/features/emoji/EmojiPickerContent";
import { CustomEmojiUploadDialog } from "@/features/emoji/CustomEmojiUploadDialog";

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
        <PopoverContent align={align} className="w-auto p-0" onClick={(e) => e.stopPropagation()}>
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
        </PopoverContent>
      </Popover>
      <CustomEmojiUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </>
  );
}
