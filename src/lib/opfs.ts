// Offline video chunk storage using IndexedDB (universal browser support)
// Previously used OPFS which doesn't work on mobile Safari

const DB_NAME = "video_chunks_db";
const DB_VERSION = 1;
const STORE_NAME = "chunks";

function openChunkDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function chunkKey(videoId: string, chunkIndex: number): string {
  return `${videoId}__chunk_${chunkIndex}`;
}

function ivKey(videoId: string, chunkIndex: number): string {
  return `${videoId}__iv_${chunkIndex}`;
}

function countKey(videoId: string): string {
  return `${videoId}__count`;
}

export async function saveChunkToOPFS(
  videoId: string,
  chunkIndex: number,
  data: ArrayBuffer,
  iv: Uint8Array
): Promise<void> {
  const db = await openChunkDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  store.put(data, chunkKey(videoId, chunkIndex));
  store.put(Array.from(iv), ivKey(videoId, chunkIndex));
  // Track max chunk index
  const getReq = store.get(countKey(videoId));
  await new Promise<void>((resolve, reject) => {
    getReq.onsuccess = () => {
      const current = (getReq.result as number) || 0;
      store.put(Math.max(current, chunkIndex + 1), countKey(videoId));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function readChunkFromOPFS(
  videoId: string,
  chunkIndex: number
): Promise<{ data: ArrayBuffer; iv: Uint8Array } | null> {
  try {
    const db = await openChunkDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    const dataReq = store.get(chunkKey(videoId, chunkIndex));
    const ivReq = store.get(ivKey(videoId, chunkIndex));

    return new Promise((resolve) => {
      tx.oncomplete = () => {
        if (dataReq.result && ivReq.result) {
          resolve({
            data: dataReq.result as ArrayBuffer,
            iv: new Uint8Array(ivReq.result as number[]),
          });
        } else {
          resolve(null);
        }
      };
      tx.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function getChunkCount(videoId: string): Promise<number> {
  try {
    const db = await openChunkDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(countKey(videoId));
    return new Promise((resolve) => {
      req.onsuccess = () => resolve((req.result as number) || 0);
      req.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

export async function deleteVideoFromOPFS(videoId: string): Promise<void> {
  try {
    const db = await openChunkDB();
    const count = await getChunkCount(videoId);
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    for (let i = 0; i < count; i++) {
      store.delete(chunkKey(videoId, i));
      store.delete(ivKey(videoId, i));
    }
    store.delete(countKey(videoId));

    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}

export async function isVideoOffline(videoId: string): Promise<boolean> {
  const count = await getChunkCount(videoId);
  return count > 0;
}
