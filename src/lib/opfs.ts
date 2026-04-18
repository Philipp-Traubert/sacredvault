// Simple offline video storage: one Blob per video in IndexedDB.
// No chunking, no encryption — IndexedDB stores Blobs natively.

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

export async function saveOfflineVideo(
  id: string,
  meta: OfflineVideoMeta,
  blob: Blob
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction([VIDEO_STORE, META_STORE], "readwrite");
  tx.objectStore(VIDEO_STORE).put(blob, id);
  tx.objectStore(META_STORE).put(meta, id);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOfflineVideo(id: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(VIDEO_STORE, "readonly");
    const req = tx.objectStore(VIDEO_STORE).get(id);
    return new Promise((resolve) => {
      req.onsuccess = () => resolve((req.result as Blob) || null);
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

export async function isVideoOffline(id: string): Promise<boolean> {
  try {
    const db = await openDB();
    const tx = db.transaction(VIDEO_STORE, "readonly");
    const req = tx.objectStore(VIDEO_STORE).getKey(id);
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result !== undefined);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

export async function readOfflineVideoMeta(id: string): Promise<OfflineVideoMeta | null> {
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
    const tx = db.transaction(META_STORE, "readonly");
    const req = tx.objectStore(META_STORE).getAll();
    return new Promise((resolve) => {
      req.onsuccess = () => resolve((req.result as OfflineVideoMeta[]) || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}
