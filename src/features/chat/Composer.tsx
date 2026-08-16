import { useEffect, useRef, useState } from "react";
import { Send, Paperclip, X, RotateCw, Loader2 } from "lucide-react";

import { useConnectionStore } from "@/stores/connectionStore";
import { sendMessage } from "@/services/chatService";
import { uploadAttachment, validateAttachmentFile, type UploadResult } from "@/services/uploadService";
import { toast } from "@/stores/toastStore";
import { EmojiPicker } from "@/features/emoji/EmojiPicker";
import { Button } from "@/components/ui/button";

interface PendingAttachment {
  file: File;
  previewUrl: string;
  status: "uploading" | "done" | "error";
  result?: UploadResult;
}

/**
 * Enter sends / Shift+Enter inserts a newline on hardware-keyboard devices;
 * the Send button is always rendered too since mobile virtual-keyboard
 * Enter behavior is unreliable across IMEs (Phase 4 PRD P4.3). File
 * attachment feedback is instant — a local thumbnail + spinner appear the
 * moment the file is picked, before the network request resolves (P4.4).
 */
export function Composer({ channelId }: { channelId: string }) {
  const serverUrl = useConnectionStore((s) => s.serverUrl);
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  useEffect(() => {
    return () => {
      if (attachment) URL.revokeObjectURL(attachment.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup-only, must not re-run when `attachment` changes mid-life
  }, []);

  const insertAtCursor = (token: string) => {
    const el = textareaRef.current;
    if (!el) {
      setText((t) => t + token);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + token + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + token.length;
    });
  };

  const runUpload = async (file: File, previewUrl: string) => {
    if (!serverUrl) return;
    try {
      const result = await uploadAttachment(serverUrl, file);
      setAttachment((a) => (a?.previewUrl === previewUrl ? { ...a, status: "done", result } : a));
    } catch {
      setAttachment((a) => (a?.previewUrl === previewUrl ? { ...a, status: "error" } : a));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const error = validateAttachmentFile(file);
    if (error) {
      toast({ title: "Can't attach this file", description: error, variant: "destructive" });
      return;
    }
    if (attachment) URL.revokeObjectURL(attachment.previewUrl);
    const previewUrl = URL.createObjectURL(file);
    setAttachment({ file, previewUrl, status: "uploading" });
    void runUpload(file, previewUrl);
  };

  const handleRemoveAttachment = () => {
    if (attachment) URL.revokeObjectURL(attachment.previewUrl);
    setAttachment(null);
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed && !attachment) return;
    if (attachment && attachment.status !== "done") return;

    setSending(true);
    const success = await sendMessage(channelId, trimmed, attachment?.result?.url, attachment?.result?.publicId);
    setSending(false);
    if (success) {
      setText("");
      if (attachment) URL.revokeObjectURL(attachment.previewUrl);
      setAttachment(null);
    }
  };

  const canSend = (text.trim().length > 0 || attachment?.status === "done") && !sending;

  return (
    <div className="border-t border-border p-2">
      {attachment && (
        <div className="mb-2 flex items-center gap-2 rounded-md border border-border bg-card p-2">
          <img src={attachment.previewUrl} alt="" className="size-12 rounded object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-foreground">{attachment.file.name}</p>
            {attachment.status === "uploading" && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> Uploading…
              </p>
            )}
            {attachment.status === "error" && (
              <button
                type="button"
                onClick={() => void runUpload(attachment.file, attachment.previewUrl)}
                className="flex items-center gap-1 text-xs text-destructive hover:underline"
              >
                <RotateCw className="size-3" /> Upload failed — retry
              </button>
            )}
          </div>
          <button
            type="button"
            aria-label="Remove attachment"
            onClick={handleRemoveAttachment}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-1.5">
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" capture="environment" hidden onChange={handleFileChange} />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Attach file"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="size-5" />
        </Button>

        <EmojiPicker
          align="start"
          onPick={insertAtCursor}
          trigger={
            <Button type="button" variant="ghost" size="icon" aria-label="Insert emoji">
              🙂
            </Button>
          }
        />

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder="Message…"
          rows={1}
          className="max-h-40 min-h-11 flex-1 resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />

        <Button type="button" size="icon" aria-label="Send" disabled={!canSend} onClick={() => void handleSend()}>
          <Send className="size-5" />
        </Button>
      </div>
    </div>
  );
}
