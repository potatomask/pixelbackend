export type UploadedMediaKind = "image" | "video";

export interface UploadedMediaResult {
  url: string;
  filename: string;
  mimeType: string;
  mediaType: UploadedMediaKind;
  ownerId: string;
}

export async function uploadMediaFile(file: File): Promise<UploadedMediaResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/media/upload", {
    method: "POST",
    body: formData,
  });

  const payload = (await response.json().catch(() => null)) as ({ error?: string } & Partial<UploadedMediaResult>) | null;

  if (!response.ok || !payload?.url || !payload.filename || !payload.mimeType || !payload.mediaType || !payload.ownerId) {
    throw new Error(payload?.error ?? "Upload failed");
  }

  return {
    url: payload.url,
    filename: payload.filename,
    mimeType: payload.mimeType,
    mediaType: payload.mediaType,
    ownerId: payload.ownerId,
  };
}