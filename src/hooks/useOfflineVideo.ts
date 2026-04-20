import { useState, useCallback } from "react";
import {
  type OfflineVideoMeta,
  saveOfflineVideo,
  saveOfflineVideoResponse,
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
        const meta: OfflineVideoMeta = videoMeta ?? {
          id: videoId,
          title: "",
          thumbnail_url: null,
          video_url: videoUrl,
          duration: null,
        };

        if (response.body) {
          const [storageStream, progressStream] = response.body.tee();
          const storageHeaders = new Headers(response.headers);
          if (!storageHeaders.get("content-type")) {
            storageHeaders.set("Content-Type", contentType || "video/mp4");
          }

          const savePromise = saveOfflineVideoResponse(
            videoId,
            meta,
            new Response(storageStream, {
              status: response.status,
              statusText: response.statusText,
              headers: storageHeaders,
            })
          );

          const reader = progressStream.getReader();
          let received = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            received += value.length;
            if (totalBytes > 0) {
              setDownloadProgress((p) => ({
                ...p,
                [videoId]: Math.round((received / totalBytes) * 100),
              }));
            }
          }
          if (received < 100_000) {
            await deleteOfflineVideo(videoId);
            throw new Error(`Downloaded stream too small (${received} bytes)`);
          }

          await savePromise;
        } else {
          const blob = await response.blob();

          if (blob.size < 100_000) {
            throw new Error(`Downloaded blob too small (${blob.size} bytes)`);
          }

          if (blob.type && !blob.type.startsWith("video/") && !blob.type.includes("octet-stream")) {
            throw new Error(`Downloaded blob is not a video (type: ${blob.type})`);
          }

          await saveOfflineVideo(videoId, meta, blob);
        }

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
