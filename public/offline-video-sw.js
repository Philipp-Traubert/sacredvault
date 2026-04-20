self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith("/offline-video/")
  ) {
    return;
  }

  event.respondWith(handleOfflineVideoRequest(request));
});

async function handleOfflineVideoRequest(request) {
  const cache = await caches.open("video_vault_offline_cache_v1");
  const cachedResponse = await cache.match(request.url);

  if (!cachedResponse) {
    return new Response("Offline video not found", { status: 404 });
  }

  const rangeHeader = request.headers.get("range");
  if (!rangeHeader) {
    return cachedResponse;
  }

  const blob = await cachedResponse.blob();
  const size = blob.size;
  const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader);

  if (!match) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${size}` },
    });
  }

  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  const end = Math.min(requestedEnd, size - 1);

  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${size}` },
    });
  }

  const chunk = blob.slice(start, end + 1);

  return new Response(chunk, {
    status: 206,
    statusText: "Partial Content",
    headers: {
      "Content-Type": cachedResponse.headers.get("Content-Type") || "video/mp4",
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
    },
  });
}