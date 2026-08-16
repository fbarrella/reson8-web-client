import { wsUrlToHttpBase } from "@/lib/serverUrl";

const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024; // 5MB, matches the server's own cap
const ATTACHMENT_ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const EMOJI_MAX_BYTES = 512 * 1024; // 512KB, matches the server's own cap

export interface UploadResult {
  url: string;
  publicId?: string;
}

/**
 * Client-side pre-checks are UX only — fail fast with a clear message before
 * a network request fires, but the server remains the real enforcement
 * boundary (master PRD §5.6 / Phase 4 PRD P4.4).
 */
export function validateAttachmentFile(file: File): string | null {
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return `File is too large (max ${Math.round(ATTACHMENT_MAX_BYTES / 1024 / 1024)}MB).`;
  }
  if (!ATTACHMENT_ALLOWED_TYPES.has(file.type)) {
    return "Unsupported file type. Only JPEG, PNG, GIF, and WEBP images are allowed.";
  }
  return null;
}

export function validateEmojiFile(file: File): string | null {
  if (file.size > EMOJI_MAX_BYTES) {
    return `Image is too large (max ${Math.round(EMOJI_MAX_BYTES / 1024)}KB).`;
  }
  if (!ATTACHMENT_ALLOWED_TYPES.has(file.type)) {
    return "Unsupported image type.";
  }
  return null;
}

async function postMultipart(serverUrl: string, path: string, formData: FormData): Promise<UploadResult> {
  const base = wsUrlToHttpBase(serverUrl).replace(/\/$/, "");
  const res = await fetch(`${base}${path}`, { method: "POST", body: formData });
  if (!res.ok) {
    throw new Error(`Upload failed (${res.status})`);
  }
  return (await res.json()) as UploadResult;
}

/** POST {serverBaseUrl}/api/upload — chat attachments, field name "file". */
export function uploadAttachment(serverUrl: string, file: File): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  return postMultipart(serverUrl, "/api/upload", formData);
}

/** POST {serverBaseUrl}/api/upload/emoji — pre-cropped 128x128 custom emoji images. */
export function uploadEmojiImage(serverUrl: string, blob: Blob, filename: string): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", blob, filename);
  return postMultipart(serverUrl, "/api/upload/emoji", formData);
}
