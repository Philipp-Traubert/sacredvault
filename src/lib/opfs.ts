// Offline video storage facade.
// On native (Capacitor) → uses the device filesystem (no JS memory pressure).
// On web → uses Cache API + IndexedDB metadata (existing behavior).

import { isNative } from "./platform";
import {
  nativeDeleteVideo,
  nativeDownloadVideo,
  nativeGetVideoSrc,
  nativeIsVideoOffline,
  nativeListMetas,
  nativeReadMeta,
} from "./nativeVideoStorage";

const DB_NAME = "video_vault_offline";
const DB_VERSION = 1;
const META_STORE = "metas";
const CACHE_NAME = "video_vault_offline_cache_v1";
const OFFLINE_VIDEO_PATH = "/offline-video/";

export interface OfflineVideoMeta {
  id: string;
  title: string;
  thumbnail_url: string | null;
  video_url: string;
  duration: string | null;
}

// Cache last-resolved native URIs so the synchronous getOfflineVideoPlaybackUrl
// can return them. Populated by isVideoOffline / saveOfflineVideo on native.
const nativeUriCache = new Map<string, string>();

/**
 * Native-only: download a video straight to the device filesystem.
 * Used by useOfflineVideo when running inside the Capacitor shell.
 */
export async function nativeDownloadAndStore(
  id: string,
  url: string,
  meta: OfflineVideoMeta,
  authToken?: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  await nativeDownloadVideo(id, url, meta, authToken, onProgress);
  const src = await nativeGetVideoSrc(id);
  if (src) nativeUriCache.set(id, src);
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getOfflineVideoRequestUrl(id: string): string {
  return new URL(`${OFFLINE_VIDEO_PATH}${encodeURIComponent(id)}`, window.location.origin).toString();
}

export function getOfflineVideoPlaybackUrl(id: string): string {
  if (isNative) {
    return nativeUriCache.get(id) ?? `${OFFLINE_VIDEO_PATH}${encodeURIComponent(id)}`;
  }
  return `${OFFLINE_VIDEO_PATH}${encodeURIComponent(id)}`;
}

async function openVideoCache(): Promise<Cache> {
  if (!("caches" in window)) {
    throw new Error("Offline video cache is not supported on this device");
  }

  return caches.open(CACHE_NAME);
}

async function getOfflineVideoResponse(id: string): Promise<Response | null> {
  const cache = await openVideoCache();
  return (await cache.match(getOfflineVideoRequestUrl(id))) ?? null;
}

async function getStoredVideoSize(id: string): Promise<number> {
  const response = await getOfflineVideoResponse(id);
  if (!response) return 0;

  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > 0) return contentLength;

  return (await response.blob()).size;
}

export async function saveOfflineVideo(
  id: string,
  meta: OfflineVideoMeta,
  blob: Blob
): Promise<void> {
  const headers = new Headers({
    "Content-Type": blob.type || "video/mp4",
    "Content-Length": String(blob.size),
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
  });

  await saveOfflineVideoResponse(id, meta, new Response(blob, { headers }));
}

export async function saveOfflineVideoResponse(
  id: string,
  meta: OfflineVideoMeta,
  response: Response
): Promise<void> {
  const cache = await openVideoCache();
  const requestUrl = getOfflineVideoRequestUrl(id);
  const headers = new Headers(response.headers);
  if (!headers.get("content-type")) headers.set("Content-Type", "video/mp4");
  if (!headers.get("accept-ranges")) headers.set("Accept-Ranges", "bytes");
  if (!headers.get("cache-control")) headers.set("Cache-Control", "no-store");

  await cache.put(
    requestUrl,
    new Response(response.body, {
      status: response.status || 200,
      statusText: response.statusText,
      headers,
    })
  );

  if ("serviceWorker" in navigator) {
    await navigator.serviceWorker.ready.catch(() => undefined);
  }

  const verifiedSize = await getStoredVideoSize(id);
  if (verifiedSize < 10000) {
    await deleteOfflineVideo(id);
    throw new Error("Failed to verify saved video blob");
  }

  // Step 3: only now write metadata
  const db = await openDB();
  const tx2 = db.transaction(META_STORE, "readwrite");
  tx2.objectStore(META_STORE).put(meta, id);
  await new Promise<void>((resolve, reject) => {
    tx2.oncomplete = () => resolve();
    tx2.onerror = () => reject(tx2.error);
    tx2.onabort = () => reject(tx2.error);
  });
}

export async function getOfflineVideo(id: string): Promise<Blob | null> {
  try {
    const response = await getOfflineVideoResponse(id);
    if (!response) return null;

    const blob = await response.blob();
    if (!blob || blob.size < 10000) {
      return null;
    }

    return blob;
  } catch {
    return null;
  }
}

export async function deleteOfflineVideo(id: string): Promise<void> {
  if (isNative) {
    nativeUriCache.delete(id);
    await nativeDeleteVideo(id);
    return;
  }
  try {
    const cache = await openVideoCache();
    await cache.delete(getOfflineVideoRequestUrl(id));

    const db = await openDB();
    const tx = db.transaction(META_STORE, "readwrite");
    tx.objectStore(META_STORE).delete(id);
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}

/**
 * A video is "offline" only if a real, readable file exists.
 * Metadata alone is not enough.
 */
export async function isVideoOffline(id: string): Promise<boolean> {
  if (isNative) {
    const ok = await nativeIsVideoOffline(id);
    if (ok && !nativeUriCache.has(id)) {
      const src = await nativeGetVideoSrc(id);
      if (src) nativeUriCache.set(id, src);
    }
    return ok;
  }
  try {
    return (await getStoredVideoSize(id)) >= 10000;
  } catch {
    return false;
  }
}

export async function readOfflineVideoMeta(id: string): Promise<OfflineVideoMeta | null> {
  if (isNative) {
    return nativeReadMeta(id);
  }
  // Only return meta if blob also exists — keep them coupled
  const offline = await isVideoOffline(id);
  if (!offline) return null;

  try {
    const db = await openDB();
    const tx = db.transaction(META_STORE, "readonly");
    const req = tx.objectStore(META_STORE).get(id);
    return new Promise((resolve) => {
      req.onsuccess = () => resolve((req.result as OfflineVideoMeta) || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function getAllOfflineVideoMetas(): Promise<OfflineVideoMeta[]> {
  if (isNative) {
    return nativeListMetas();
  }
  try {
    const db = await openDB();
    // Get all metas, then filter to only those with a real blob
    const tx = db.transaction(META_STORE, "readonly");
    const req = tx.objectStore(META_STORE).getAll();
    const metas = await new Promise<OfflineVideoMeta[]>((resolve) => {
      req.onsuccess = () => resolve((req.result as OfflineVideoMeta[]) || []);
      req.onerror = () => resolve([]);
    });

    const verified: OfflineVideoMeta[] = [];
    for (const meta of metas) {
      if (await isVideoOffline(meta.id)) verified.push(meta);
    }
    return verified;
  } catch {
    return [];
  }
}

