// Simple offline video storage: one Blob per video in IndexedDB.
// Metadata is only stored after the blob is verified saved.

const DB_NAME = "video_vault_offline";
const DB_VERSION = 1;
const VIDEO_STORE = "videos";
const META_STORE = "metas";

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
      if (!db.objectStoreNames.contains(VIDEO_STORE)) db.createObjectStore(VIDEO_STORE);
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Verify a blob is actually a playable video by loading metadata in a hidden <video>.
 * Resolves true on loadedmetadata, false on error or timeout.
 */
export function isBlobPlayableVideo(blob: Blob, timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    let done = false;
    const cleanup = (ok: boolean) => {
      if (done) return;
      done = true;
      video.removeAttribute("src");
      try { video.load(); } catch { /* ignore */ }
      URL.revokeObjectURL(url);
      resolve(ok);
    };
    const timer = setTimeout(() => cleanup(false), timeoutMs);
    video.onloadedmetadata = () => { clearTimeout(timer); cleanup(true); };
    video.onerror = () => { clearTimeout(timer); cleanup(false); };
    video.src = url;
  });
}

export async function saveOfflineVideo(
  id: string,
  meta: OfflineVideoMeta,
  blob: Blob
): Promise<void> {
  // Step 0: verify the blob is actually a decodable video BEFORE writing anything
  const playable = await isBlobPlayableVideo(blob);
  if (!playable) {
    throw new Error("Downloaded file is not a playable video");
  }

  const db = await openDB();
  // Step 1: write blob first
  const tx1 = db.transaction(VIDEO_STORE, "readwrite");
  tx1.objectStore(VIDEO_STORE).put(blob, id);
  await new Promise<void>((resolve, reject) => {
    tx1.oncomplete = () => resolve();
    tx1.onerror = () => reject(tx1.error);
    tx1.onabort = () => reject(tx1.error);
  });

  // Step 2: verify blob is readable from storage
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
    const db = await openDB();
    const tx = db.transaction(VIDEO_STORE, "readonly");
    const req = tx.objectStore(VIDEO_STORE).get(id);
    return new Promise((resolve) => {
      req.onsuccess = () => {
        const result = req.result as Blob | undefined;
        if (!result || !(result instanceof Blob) || result.size < 10000) {
          resolve(null);
        } else {
          resolve(result);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function deleteOfflineVideo(id: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction([VIDEO_STORE, META_STORE], "readwrite");
    tx.objectStore(VIDEO_STORE).delete(id);
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
  const blob = await getOfflineVideo(id);
  return blob !== null;
}

export async function readOfflineVideoMeta(id: string): Promise<OfflineVideoMeta | null> {
  // Only return meta if blob also exists — keep them coupled
  const blob = await getOfflineVideo(id);
  if (!blob) return null;

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
