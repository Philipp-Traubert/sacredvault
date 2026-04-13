import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Expose-Headers": "content-length, content-range, accept-ranges, content-type",
};

/**
 * For Wix HLS URLs, resolve to a direct MP4 URL.
 * Pattern: https://repackager.wixmp.com/video.wixstatic.com/video/{id}/,720p,480p,,/mp4/file.mp4.urlset/master.m3u8
 * Direct:  https://video.wixstatic.com/video/{id}/720p/mp4/file.mp4
 */
function resolveWixMp4(m3u8Url: string): string | null {
  try {
    const url = new URL(m3u8Url);
    // Match repackager.wixmp.com paths
    if (!url.hostname.includes("wixmp.com") && !url.hostname.includes("wixstatic.com")) {
      return null;
    }
    // Extract video ID from the path
    const videoMatch = url.pathname.match(/video\/([a-f0-9_]+)\//);
    if (!videoMatch) return null;
    const videoId = videoMatch[1];
    // Return highest quality direct MP4
    return `https://video.wixstatic.com/video/${videoId}/720p/mp4/file.mp4`;
  } catch {
    return null;
  }
}

/**
 * Parse an m3u8 playlist and extract the highest bandwidth stream URL.
 */
function parseBestStreamFromM3u8(m3u8Content: string, baseUrl: string): string | null {
  const lines = m3u8Content.split("\n");
  let bestBandwidth = 0;
  let bestUrl: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("#EXT-X-STREAM-INF:")) {
      const bwMatch = line.match(/BANDWIDTH=(\d+)/);
      const bandwidth = bwMatch ? parseInt(bwMatch[1], 10) : 0;
      const nextLine = lines[i + 1]?.trim();
      if (nextLine && !nextLine.startsWith("#") && bandwidth > bestBandwidth) {
        bestBandwidth = bandwidth;
        // Resolve relative URLs
        bestUrl = nextLine.startsWith("http") ? nextLine : new URL(nextLine, baseUrl).toString();
      }
    }
  }
  return bestUrl;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    // Get video URL from query param
    const url = new URL(req.url);
    const videoUrl = url.searchParams.get("url");
    const forDownload = url.searchParams.get("download") === "true";
    if (!videoUrl) {
      return new Response("Missing url parameter", { status: 400, headers: corsHeaders });
    }

    let targetUrl = videoUrl;

    // For downloads, resolve m3u8/HLS to direct MP4
    if (forDownload) {
      // Try Wix-specific resolution first
      const wixMp4 = resolveWixMp4(videoUrl);
      if (wixMp4) {
        targetUrl = wixMp4;
        console.log("Resolved Wix m3u8 to MP4:", targetUrl);
      } else if (videoUrl.endsWith(".m3u8") || videoUrl.includes("m3u8")) {
        // Generic m3u8: fetch playlist, find best stream, and check if it's MP4
        const playlistRes = await fetch(videoUrl);
        if (playlistRes.ok) {
          const content = await playlistRes.text();
          const bestStream = parseBestStreamFromM3u8(content, videoUrl);
          if (bestStream) {
            // If it points to another m3u8 (HLS segments), try Wix MP4 pattern on the sub-URL
            const subWix = resolveWixMp4(bestStream);
            if (subWix) {
              targetUrl = subWix;
            } else if (!bestStream.includes(".m3u8")) {
              targetUrl = bestStream;
            }
            // If still m3u8, try to extract direct MP4 from the sub-playlist URL pattern
            if (targetUrl.includes(".m3u8")) {
              const mp4Attempt = targetUrl.replace(/\/index-v1-a1\.m3u8$/, "").replace(/\.m3u8$/, "");
              if (mp4Attempt !== targetUrl) {
                targetUrl = mp4Attempt;
              }
            }
            console.log("Resolved m3u8 to:", targetUrl);
          }
        }
      }
    }

    // Forward range header for seeking support
    const fetchHeaders: Record<string, string> = {};
    const rangeHeader = req.headers.get("range");
    if (rangeHeader) {
      fetchHeaders["Range"] = rangeHeader;
    }

    const response = await fetch(targetUrl, { headers: fetchHeaders });

    if (!response.ok && response.status !== 206) {
      return new Response(`Upstream error: ${response.status}`, {
        status: response.status,
        headers: corsHeaders,
      });
    }

    // Build response headers
    const responseHeaders = new Headers(corsHeaders);
    const contentType = response.headers.get("content-type");
    if (contentType) responseHeaders.set("content-type", contentType);
    const contentLength = response.headers.get("content-length");
    if (contentLength) responseHeaders.set("content-length", contentLength);
    const contentRange = response.headers.get("content-range");
    if (contentRange) responseHeaders.set("content-range", contentRange);
    const acceptRanges = response.headers.get("accept-ranges");
    if (acceptRanges) responseHeaders.set("accept-ranges", acceptRanges);

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Video proxy error:", error);
    return new Response("Internal error", { status: 500, headers: corsHeaders });
  }
});
