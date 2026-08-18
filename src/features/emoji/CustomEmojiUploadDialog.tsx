import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { validateEmojiFile } from "@/services/uploadService";
import { submitCustomEmoji } from "@/services/emojiService";
import { toast } from "@/stores/toastStore";

const VIEWPORT_SIZE = 220;
const OUTPUT_SIZE = 128;
const NAME_RE = /^[a-zA-Z0-9_]{2,32}$/;

/**
 * Touch-adapted "cover + pan + zoom" cropper — same interaction model and
 * math as the desktop client's (Phase 4 PRD P4.9): the viewport always
 * shows the image fully covering it (no gaps), pan via drag, zoom via a
 * slider or pinch. A single Pointer Events map drives both pan (1 active
 * pointer) and pinch-zoom (2 active pointers, distance-based), so touch and
 * mouse share one code path rather than separate touch/mouse handlers.
 */
export function CustomEmojiUploadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [step, setStep] = useState<"select" | "crop">("select");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [baseScale, setBaseScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const dragState = useRef<{ startOffset: { x: number; y: number }; startCenter: { x: number; y: number } } | null>(
    null,
  );
  const pinchState = useRef<{ startDist: number; startZoom: number } | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  const reset = () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    setObjectUrl(null);
    setStep("select");
    setName("");
    setZoom(1);
    setNaturalSize({ w: 0, h: 0 });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const error = validateEmojiFile(file);
    if (error) {
      toast({ title: "Can't use this image", description: error, variant: "destructive" });
      return;
    }
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    setObjectUrl(URL.createObjectURL(file));
  };

  const handleImageLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return;
    const scale = Math.max(VIEWPORT_SIZE / w, VIEWPORT_SIZE / h);
    setNaturalSize({ w, h });
    setBaseScale(scale);
    setZoom(1);
    setOffset({ x: (VIEWPORT_SIZE - w * scale) / 2, y: (VIEWPORT_SIZE - h * scale) / 2 });
    setStep("crop");
  };

  const clampOffset = (next: { x: number; y: number }, scale: number) => {
    const displayedW = naturalSize.w * scale;
    const displayedH = naturalSize.h * scale;
    const minX = VIEWPORT_SIZE - displayedW;
    const minY = VIEWPORT_SIZE - displayedH;
    return { x: Math.min(0, Math.max(minX, next.x)), y: Math.min(0, Math.max(minY, next.y)) };
  };

  const applyZoom = (nextZoom: number) => {
    const clampedZoom = Math.min(3, Math.max(1, nextZoom));
    setZoom(clampedZoom);
    setOffset((o) => clampOffset(o, baseScale * clampedZoom));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    viewportRef.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      dragState.current = { startOffset: offset, startCenter: { x: e.clientX, y: e.clientY } };
      pinchState.current = null;
    } else if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()];
      const p0 = pts[0];
      const p1 = pts[1];
      if (p0 && p1) {
        pinchState.current = { startDist: Math.hypot(p1.x - p0.x, p1.y - p0.y), startZoom: zoom };
      }
      dragState.current = null;
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinchState.current) {
      const pts = [...pointers.current.values()];
      const p0 = pts[0];
      const p1 = pts[1];
      if (p0 && p1) {
        const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
        const ratio = dist / (pinchState.current.startDist || 1);
        applyZoom(pinchState.current.startZoom * ratio);
      }
    } else if (pointers.current.size === 1 && dragState.current) {
      const dx = e.clientX - dragState.current.startCenter.x;
      const dy = e.clientY - dragState.current.startCenter.y;
      setOffset(
        clampOffset(
          { x: dragState.current.startOffset.x + dx, y: dragState.current.startOffset.y + dy },
          baseScale * zoom,
        ),
      );
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      dragState.current = null;
      pinchState.current = null;
    } else if (pointers.current.size === 1) {
      const [remaining] = pointers.current.values();
      if (remaining) dragState.current = { startOffset: offset, startCenter: remaining };
      pinchState.current = null;
    }
  };

  const handleConfirm = async () => {
    if (!NAME_RE.test(name)) {
      toast({ title: "Invalid name", description: "Use 2-32 letters, numbers, or underscores.", variant: "destructive" });
      return;
    }
    const img = imgRef.current;
    if (!img || !naturalSize.w) return;

    setSubmitting(true);
    try {
      const scale = baseScale * zoom;
      const srcX = -offset.x / scale;
      const srcY = -offset.y / scale;
      const srcSize = VIEWPORT_SIZE / scale;

      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");
      ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Failed to crop image");

      const success = await submitCustomEmoji(name, blob);
      if (success) {
        toast({ title: "Emoji submitted", description: `":${name}:" is awaiting admin approval.` });
        reset();
        onOpenChange(false);
      }
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Custom Emoji</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 p-4">
          {step === "select" ? (
            <>
              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFileChange} />
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                Choose Image
              </Button>
              <p className="text-xs text-muted-foreground">JPEG, PNG, GIF, or WEBP, up to 500KB.</p>
              {objectUrl && (
                // Hidden loader — measures natural size once, then flips to the crop step.
                <img ref={imgRef} src={objectUrl} alt="" onLoad={handleImageLoad} className="hidden" />
              )}
            </>
          ) : (
            <>
              <div
                ref={viewportRef}
                className="relative mx-auto touch-none overflow-hidden rounded-md border border-border bg-muted"
                style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                {objectUrl && (
                  <img
                    ref={imgRef}
                    src={objectUrl}
                    alt=""
                    draggable={false}
                    className="absolute top-0 left-0 origin-top-left select-none"
                    style={{
                      width: naturalSize.w,
                      height: naturalSize.h,
                      transform: `translate(${offset.x}px, ${offset.y}px) scale(${baseScale * zoom})`,
                    }}
                  />
                )}
              </div>

              <div>
                <span className="mb-1 block text-xs text-muted-foreground">Zoom</span>
                <Slider
                  aria-label="Zoom"
                  value={[zoom]}
                  min={1}
                  max={3}
                  step={0.01}
                  onValueChange={([v]) => v !== undefined && applyZoom(v)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="emoji-name">Name</Label>
                <Input
                  id="emoji-name"
                  placeholder="my_emoji"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Used in chat as :{name || "name"}:</p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {step === "crop" && (
            <Button type="button" disabled={submitting} onClick={() => void handleConfirm()}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Submit
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
