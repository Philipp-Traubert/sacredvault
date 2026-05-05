const MIN_VIDEO_BYTES = 100_000;
const VIDEO_DIR = "videos";
const META_DIR = "video-meta";
const NO_MEDIA_FILE = `${VIDEO_DIR}/.nomedia`;

export const videoStoragePolicy = {
  minVideoBytes: MIN_VIDEO_BYTES,
  videoDir: VIDEO_DIR,
  metaDir: META_DIR,
  noMediaFile: NO_MEDIA_FILE,
} as const;

export function encodeStorageId(id: string): string {
  const trimmed = id.trim();
  if (!trimmed) throw new Error("Video id is required");
  return encodeURIComponent(trimmed).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function videoFilename(id: string): string {
  return `${VIDEO_DIR}/${encodeStorageId(id)}.mp4`;
}

export function metaFilename(id: string): string {
  return `${META_DIR}/${encodeStorageId(id)}.json`;
}

export function validateVideoSourceUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Video URL is invalid");
  }

  const isLocalDevHost = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLocalDevHost)) {
    throw new Error("Video URL must use HTTPS outside local development");
  }

  if (!parsed.hostname) {
    throw new Error("Video URL must include a hostname");
  }
}

export function assertLooksLikeVideoDownload(contentType: string | null | undefined, sizeBytes?: number): void {
  const normalized = (contentType || "").toLowerCase();
  if (
    normalized.includes("text/html") ||
    normalized.includes("application/json") ||
    normalized.startsWith("text/")
  ) {
    throw new Error(`Server returned non-video payload (${normalized || "unknown content type"})`);
  }

  if (typeof sizeBytes === "number" && sizeBytes < MIN_VIDEO_BYTES) {
    throw new Error(`Downloaded file too small (${sizeBytes} bytes)`);
  }
}
