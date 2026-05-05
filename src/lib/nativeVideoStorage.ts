/* eslint-disable @typescript-eslint/no-explicit-any */
// Native (Capacitor) offline video storage.
// Downloads stream straight to the device filesystem via the native HTTP
// client — no JS Blob in memory — and play through the native video element
// using a file:// URI converted with Capacitor.convertFileSrc().

import { Filesystem, Directory } from "@capacitor/filesystem";
import { toWebViewUri } from "./platform";
import {
  assertLooksLikeVideoDownload,
  metaFilename,
  validateVideoSourceUrl,
  videoFilename,
  videoStoragePolicy,
} from "./videoStoragePolicy";

export interface OfflineVideoMeta {
  id: string;
  title: string;
  thumbnail_url: string | null;
  video_url: string;
  duration: string | null;
}

async function ensureDirs() {
  for (const path of [videoStoragePolicy.videoDir, videoStoragePolicy.metaDir]) {
    try {
      await Filesystem.mkdir({
        path,
        directory: Directory.Data,
        recursive: true,
      });
    } catch {
      // already exists
    }
  }

  // Belt-and-suspenders media scanner hint. Directory.Data is already
  // app-private on Android, but this prevents accidental gallery indexing if
  // a future implementation moves files to shared/external app storage.
  try {
    await Filesystem.writeFile({
      path: videoStoragePolicy.noMediaFile,
      directory: Directory.Data,
      data: "Sacred Video Vault private media directory",
      encoding: "utf8" as any,
    });
  } catch {
    // ignore; video storage can still be private without this marker
  }
}

/**
 * Download a video to native filesystem.
 * Uses Filesystem.downloadFile which streams over native HTTP straight to
 * disk, never materializing the full file in JS memory.
 */
export async function nativeDownloadVideo(
  id: string,
  url: string,
  meta: OfflineVideoMeta,
  authToken?: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  validateVideoSourceUrl(url);
  await ensureDirs();

  const headers: Record<string, string> = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  // Progress events from Filesystem.downloadFile
  const progressListener = await Filesystem.addListener(
    "progress",
    (event: { url: string; bytes: number; contentLength: number }) => {
      if (onProgress && event.contentLength > 0) {
        onProgress(Math.round((event.bytes / event.contentLength) * 100));
      }
    }
  );

  try {
    const result = await Filesystem.downloadFile({
      url,
      path: videoFilename(id),
      directory: Directory.Data,
      headers,
      progress: true,
    } as any);

    // Sanity check the downloaded file size
    try {
      const stat = await Filesystem.stat({
        path: videoFilename(id),
        directory: Directory.Data,
      });
      if (!stat.size || stat.size < videoStoragePolicy.minVideoBytes) {
        await nativeDeleteVideo(id);
        throw new Error(`Downloaded file too small (${stat.size ?? 0} bytes)`);
      }
      assertLooksLikeVideoDownload(undefined, stat.size);
    } catch (e) {
      // If stat fails, fall back to whatever the download reports
      if (!result || (result as any).path == null) throw e;
    }

    // Persist metadata only after the file is verified on disk
    await Filesystem.writeFile({
      path: metaFilename(id),
      directory: Directory.Data,
      data: JSON.stringify(meta),
      encoding: "utf8" as any,
    });
  } finally {
    await progressListener.remove();
  }
}

/** Returns a `<video src>`-compatible URI for the locally stored file. */
export async function nativeGetVideoSrc(id: string): Promise<string | null> {
  try {
    const { uri } = await Filesystem.getUri({
      path: videoFilename(id),
      directory: Directory.Data,
    });
    return toWebViewUri(uri);
  } catch {
    return null;
  }
}

export async function nativeIsVideoOffline(id: string): Promise<boolean> {
  try {
    const stat = await Filesystem.stat({
      path: videoFilename(id),
      directory: Directory.Data,
    });
    return !!stat.size && stat.size >= 10_000;
  } catch {
    return false;
  }
}

export async function nativeDeleteVideo(id: string): Promise<void> {
  try {
    await Filesystem.deleteFile({
      path: videoFilename(id),
      directory: Directory.Data,
    });
  } catch {
    // ignore
  }
  try {
    await Filesystem.deleteFile({
      path: metaFilename(id),
      directory: Directory.Data,
    });
  } catch {
    // ignore
  }
}

export async function nativeReadMeta(id: string): Promise<OfflineVideoMeta | null> {
  try {
    if (!(await nativeIsVideoOffline(id))) return null;
    const res = await Filesystem.readFile({
      path: metaFilename(id),
      directory: Directory.Data,
      encoding: "utf8" as any,
    });
    const text = typeof res.data === "string" ? res.data : await (res.data as Blob).text();
    return JSON.parse(text) as OfflineVideoMeta;
  } catch {
    return null;
  }
}

export async function nativeListMetas(): Promise<OfflineVideoMeta[]> {
  try {
    await ensureDirs();
    const { files } = await Filesystem.readdir({
      path: videoStoragePolicy.metaDir,
      directory: Directory.Data,
    });
    const metas: OfflineVideoMeta[] = [];
    for (const f of files) {
      const name = typeof f === "string" ? f : (f as any).name;
      if (!name?.endsWith(".json")) continue;
      const id = decodeURIComponent(name.replace(/\.json$/, ""));
      const meta = await nativeReadMeta(id);
      if (meta) metas.push(meta);
    }
    return metas;
  } catch {
    return [];
  }
}
