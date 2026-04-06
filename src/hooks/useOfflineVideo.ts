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
  saveChunkToOPFS,
  readChunkFromOPFS,
  getChunkCount,
  deleteVideoFromOPFS,
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
}

export function useOfflineVideo() {
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});

  const downloadVideo = useCallback(async (videoId: string, videoUrl: string) => {
    setDownloading((prev) => ({ ...prev, [videoId]: true }));
    setDownloadProgress((prev) => ({ ...prev, [videoId]: 0 }));

    try {
      const key = await generateEncryptionKey();
      const response = await fetch(videoUrl);
      if (!response.ok) throw new Error("Failed to fetch video");

      const contentLength = Number(response.headers.get("content-length") || 0);
      const reader = response.body!.getReader();

      let chunkIndex = 0;
      let buffer = new Uint8Array(0);
      let totalRead = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Append to buffer
        const newBuffer = new Uint8Array(buffer.length + value.length);
        newBuffer.set(buffer);
        newBuffer.set(value, buffer.length);
        buffer = newBuffer;
        totalRead += value.length;

        // Process full chunks
        while (buffer.length >= CHUNK_SIZE) {
          const chunk = buffer.slice(0, CHUNK_SIZE);
          buffer = buffer.slice(CHUNK_SIZE);

          const { encrypted, iv } = await encryptChunk(chunk.buffer, key);
          await saveChunkToOPFS(videoId, chunkIndex, encrypted, iv);
          chunkIndex++;
        }

        if (contentLength > 0) {
          setDownloadProgress((prev) => ({
            ...prev,
            [videoId]: Math.round((totalRead / contentLength) * 100),
          }));
        }
      }

      // Process remaining buffer
      if (buffer.length > 0) {
        const { encrypted, iv } = await encryptChunk(buffer.buffer, key);
        await saveChunkToOPFS(videoId, chunkIndex, encrypted, iv);
      }

      await storeKey(videoId, key);
      setDownloadProgress((prev) => ({ ...prev, [videoId]: 100 }));
    } catch (error) {
      console.error("Download failed:", error);
      await deleteVideoFromOPFS(videoId);
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

    for (let i = 0; i < chunkCount; i++) {
      const chunk = await readChunkFromOPFS(videoId, i);
      if (!chunk) return null;
      const decrypted = await decryptChunk(chunk.data, key, chunk.iv);
      decryptedChunks.push(decrypted);
    }

    return new Blob(decryptedChunks, { type: "video/mp4" });
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
