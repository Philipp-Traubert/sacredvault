import { useState, useCallback } from "react";
import {
  type OfflineVideoMeta,
  saveOfflineVideo,
  getOfflineVideo,
  deleteOfflineVideo,
  isVideoOffline as checkOffline,
} from "@/lib/opfs";

export function useOfflineVideo() {
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});

  const downloadVideo = useCallback(
    async (
      videoId: string,
      videoUrl: string,
      authToken?: string,
      videoMeta?: OfflineVideoMeta
    ) => {
      setDownloading((p) => ({ ...p, [videoId]: true }));
      setDownloadProgress((p) => ({ ...p, [videoId]: 0 }));

      try {
        const headers: Record<string, string> = {};
        if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

        const response = await fetch(videoUrl, { headers });
        if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);

        const contentType = (response.headers.get("content-type") || "").toLowerCase();

        // Reject any non-video payloads outright
        if (
          contentType.includes("text/html") ||
          contentType.includes("application/json") ||
          contentType.startsWith("text/")
        ) {
          throw new Error(`Server returned non-video payload (${contentType})`);
        }

        const totalBytes = Number(response.headers.get("content-length") || 0);

        let blob: Blob;
        if (response.body && totalBytes > 0) {
          const reader = response.body.getReader();
          const chunks: Uint8Array[] = [];
          let received = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            received += value.length;
            setDownloadProgress((p) => ({
              ...p,
              [videoId]: Math.round((received / totalBytes) * 100),
            }));
          }
          blob = new Blob(chunks as BlobPart[], { type: contentType || "video/mp4" });
        } else {
          blob = await response.blob();
        }

        // Strict size check — anything under 100KB is almost certainly an error page
        if (blob.size < 100_000) {
          throw new Error(`Downloaded blob too small (${blob.size} bytes)`);
        }

        // If the blob has a known type, it must be a video
        if (blob.type && !blob.type.startsWith("video/") && !blob.type.includes("octet-stream")) {
          throw new Error(`Downloaded blob is not a video (type: ${blob.type})`);
        }

        const meta: OfflineVideoMeta = videoMeta ?? {
          id: videoId,
          title: "",
          thumbnail_url: null,
          video_url: videoUrl,
          duration: null,
        };

        // saveOfflineVideo verifies the blob is readable before writing metadata
        await saveOfflineVideo(videoId, meta, blob);
        setDownloadProgress((p) => ({ ...p, [videoId]: 100 }));
      } catch (error) {
        console.error("Download failed:", error);
        // Clean up any partial state
        await deleteOfflineVideo(videoId);
        throw error;
      } finally {
        setDownloading((p) => ({ ...p, [videoId]: false }));
      }
    },
    []
  );

  const getOfflineVideoBlob = useCallback(
    (videoId: string) => getOfflineVideo(videoId),
    []
  );

  const removeOfflineVideo = useCallback(async (videoId: string) => {
    await deleteOfflineVideo(videoId);
    setDownloadProgress((p) => {
      const next = { ...p };
      delete next[videoId];
      return next;
    });
  }, []);

  const isVideoOffline = useCallback((videoId: string) => checkOffline(videoId), []);

  return {
    downloadVideo,
    getOfflineVideoBlob,
    removeOfflineVideo,
    isVideoOffline,
    downloadProgress,
    downloading,
  };
}
