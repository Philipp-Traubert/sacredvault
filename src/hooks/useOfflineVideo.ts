import { useState, useCallback } from "react";
import {
  generateEncryptionKey,
  exportKey,
  importKey,
  encryptChunk,
  decryptChunk,
  CHUNK_SIZE,
} from "@/lib/crypto";
import {
  type OfflineVideoMeta,
  saveChunkToOPFS,
  readChunkFromOPFS,
  getChunkCount,
  deleteVideoFromOPFS,
  saveOfflineVideoMeta,
  readVideoContentType,
  saveVideoContentType,
  isVideoOffline as checkOffline,
} from "@/lib/opfs";

// Store keys in IndexedDB
function openKeyDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("video_keys", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("keys");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function storeKey(videoId: string, key: CryptoKey) {
  const db = await openKeyDB();
  const jwk = await exportKey(key);
  const tx = db.transaction("keys", "readwrite");
  tx.objectStore("keys").put(jwk, videoId);
  await new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror = rej;
  });
}

async function getKey(videoId: string): Promise<CryptoKey | null> {
  const db = await openKeyDB();
  const tx = db.transaction("keys", "readonly");
  const req = tx.objectStore("keys").get(videoId);
  return new Promise((resolve) => {
    req.onsuccess = async () => {
      if (req.result) {
        resolve(await importKey(req.result));
      } else {
        resolve(null);
      }
    };
    req.onerror = () => resolve(null);
  });
}

async function deleteKey(videoId: string) {
  const db = await openKeyDB();
  const tx = db.transaction("keys", "readwrite");
  tx.objectStore("keys").delete(videoId);
  await new Promise((resolve) => {
    tx.oncomplete = resolve;
    tx.onerror = resolve;
  });
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export function useOfflineVideo() {
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});

  const downloadVideo = useCallback(async (
    videoId: string,
    videoUrl: string,
    authToken?: string,
    videoMeta?: OfflineVideoMeta
  ) => {
    setDownloading((prev) => ({ ...prev, [videoId]: true }));
    setDownloadProgress((prev) => ({ ...prev, [videoId]: 0 }));

    try {
      const key = await generateEncryptionKey();
      const fetchHeaders: Record<string, string> = {};
      if (authToken) fetchHeaders["Authorization"] = `Bearer ${authToken}`;
      const response = await fetch(videoUrl, { headers: fetchHeaders });
      if (!response.ok) throw new Error(`Failed to fetch video: ${response.status}`);

      const contentType = response.headers.get("content-type") || "";
      const contentLength = Number(response.headers.get("content-length") || 0);

      const persistChunk = async (chunk: ArrayBuffer, chunkIndex: number) => {
        const { encrypted, iv } = await encryptChunk(chunk, key);
        await saveChunkToOPFS(videoId, chunkIndex, encrypted, iv);
      };

      // Validate we got actual video data, not a tiny error page
      if (contentLength > 0 && contentLength < 10000) {
        throw new Error("Response too small to be a video file");
      }
      if (contentType.includes("text/html")) {
        throw new Error("Got HTML instead of video data — URL may be invalid");
      }

      let chunkIndex = 0;
      let totalRead = 0;

      if (!response.body) {
        const arrayBuffer = await response.arrayBuffer();

        while (totalRead < arrayBuffer.byteLength) {
          const nextChunk = arrayBuffer.slice(totalRead, totalRead + CHUNK_SIZE);
          await persistChunk(nextChunk, chunkIndex);
          chunkIndex++;
          totalRead += nextChunk.byteLength;

          if (contentLength > 0) {
            setDownloadProgress((prev) => ({
              ...prev,
              [videoId]: Math.round((totalRead / contentLength) * 100),
            }));
          }
        }
      } else {
        const reader = response.body.getReader();
        let buffer = new Uint8Array(0);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const newBuffer = new Uint8Array(buffer.length + value.length);
          newBuffer.set(buffer);
          newBuffer.set(value, buffer.length);
          buffer = newBuffer;
          totalRead += value.length;

          while (buffer.length >= CHUNK_SIZE) {
            const chunk = buffer.slice(0, CHUNK_SIZE);
            buffer = buffer.slice(CHUNK_SIZE);

            await persistChunk(toArrayBuffer(chunk), chunkIndex);
            chunkIndex++;
          }

          if (contentLength > 0) {
            setDownloadProgress((prev) => ({
              ...prev,
              [videoId]: Math.round((totalRead / contentLength) * 100),
            }));
          }
        }

        if (buffer.length > 0) {
          await persistChunk(toArrayBuffer(buffer), chunkIndex);
        }
      }

      if (contentType) {
        await saveVideoContentType(videoId, contentType);
      }
      if (videoMeta) {
        await saveOfflineVideoMeta(videoMeta);
      }
      await storeKey(videoId, key);
      setDownloadProgress((prev) => ({ ...prev, [videoId]: 100 }));
    } catch (error) {
      console.error("Download failed:", error);
      await deleteVideoFromOPFS(videoId);
      await deleteKey(videoId);
      throw error;
    } finally {
      setDownloading((prev) => ({ ...prev, [videoId]: false }));
    }
  }, []);

  const getOfflineVideoBlob = useCallback(async (videoId: string): Promise<Blob | null> => {
    const key = await getKey(videoId);
    if (!key) return null;

    const chunkCount = await getChunkCount(videoId);
    if (chunkCount === 0) return null;

    const decryptedChunks: ArrayBuffer[] = [];
    const contentType = await readVideoContentType(videoId);

    for (let i = 0; i < chunkCount; i++) {
      const chunk = await readChunkFromOPFS(videoId, i);
      if (!chunk) return null;
      const decrypted = await decryptChunk(chunk.data, key, chunk.iv);
      decryptedChunks.push(decrypted);
    }

    return new Blob(decryptedChunks, { type: contentType || "video/mp4" });
  }, []);

  const removeOfflineVideo = useCallback(async (videoId: string) => {
    await deleteVideoFromOPFS(videoId);
    await deleteKey(videoId);
    setDownloadProgress((prev) => {
      const next = { ...prev };
      delete next[videoId];
      return next;
    });
  }, []);

  const isVideoOffline = useCallback(async (videoId: string): Promise<boolean> => {
    return checkOffline(videoId);
  }, []);

  return {
    downloadVideo,
    getOfflineVideoBlob,
    removeOfflineVideo,
    isVideoOffline,
    downloadProgress,
    downloading,
  };
}
