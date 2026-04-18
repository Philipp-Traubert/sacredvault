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

        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("text/html")) {
          throw new Error("Got HTML instead of video data");
        }

        const totalBytes = Number(response.headers.get("content-length") || 0);

        let blob: Blob;
        if (response.body && totalBytes > 0) {
          // Stream so we can show progress
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
          // No content-length — just grab the whole blob
          blob = await response.blob();
        }

        if (blob.size < 10000) throw new Error("Response too small to be a video");

        const meta: OfflineVideoMeta = videoMeta ?? {
          id: videoId,
          title: "",
          thumbnail_url: null,
          video_url: videoUrl,
          duration: null,
        };

        await saveOfflineVideo(videoId, meta, blob);
        setDownloadProgress((p) => ({ ...p, [videoId]: 100 }));
      } catch (error) {
        console.error("Download failed:", error);
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
