// Simple offline video storage: one Blob per video in IndexedDB.
// Metadata is only stored after the blob is verified saved.

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
  return `${OFFLINE_VIDEO_PATH}${encodeURIComponent(id)}`;
}

async function openVideoCache(): Promise<Cache> {
  if (!("caches" in window)) {
    throw new Error("Offline video cache is not supported on this device");
  }

  return caches.open(CACHE_NAME);
}

export async function saveOfflineVideo(
  id: string,
  meta: OfflineVideoMeta,
  blob: Blob
): Promise<void> {
  const cache = await openVideoCache();
  const requestUrl = getOfflineVideoRequestUrl(id);
  const headers = new Headers({
    "Content-Type": blob.type || "video/mp4",
    "Content-Length": String(blob.size),
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
  });

  await cache.put(requestUrl, new Response(blob, { headers }));

  if ("serviceWorker" in navigator) {
    await navigator.serviceWorker.ready.catch(() => undefined);
  }

  const verified = await getOfflineVideo(id);
  if (!verified || verified.size < 10000) {
    await deleteOfflineVideo(id);
    throw new Error("Failed to verify saved video blob");
  }

  // Step 3: only now write metadata
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
    const cache = await openVideoCache();
    const response = await cache.match(getOfflineVideoRequestUrl(id));
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
 * A video is "offline" only if a real, readable blob exists.
 * Metadata alone is not enough.
 */
export async function isVideoOffline(id: string): Promise<boolean> {
  try {
    const cache = await openVideoCache();
    const response = await cache.match(getOfflineVideoRequestUrl(id));
    return !!response;
  } catch {
    return false;
  }
}

export async function readOfflineVideoMeta(id: string): Promise<OfflineVideoMeta | null> {
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
