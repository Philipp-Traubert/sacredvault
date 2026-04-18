

## The Simpler, Dumber Plan

The current offline flow is failing on mobile because it's too clever:
- We chunk videos, encrypt each chunk with AES-GCM, decrypt all chunks into RAM, build a Blob → mobile Safari/Brave often OOM or hang on bigger videos.
- The player has 4 places that swap the video source (mount effect, offline event, network error, manual download) — they fight each other and cause iOS to reload the page.
- When offline, the role check sometimes still flips `hasAccess` back to `false`, kicking the user to the "Access Requested" screen.

I want to rip all of that out and replace it with the dumbest version that works.

### What changes

**1. Stop encrypting offline videos. Store one raw Blob per video.**
- Remove `src/lib/crypto.ts` usage from the offline path.
- `src/lib/opfs.ts` becomes a tiny IndexedDB wrapper with three functions: `saveOfflineVideo(id, meta, blob)`, `getOfflineVideo(id)`, `deleteOfflineVideo(id)`, plus `getAllOfflineMetas()` and `isVideoOffline(id)`.
- IndexedDB stores Blobs natively, so no chunking, no decrypt loop, no memory spike. Reading is one `get()`.
- Security note for the user: the offline copy lives inside the browser's private IndexedDB for this site. It is only accessible to someone logged into the device's browser profile — same protection level as cached YouTube videos. The login password remains hashed server-side; that part doesn't change.

**2. Rewrite `useOfflineVideo` to be ~40 lines.**
- `downloadVideo`: `fetch` the proxied URL → `await response.blob()` → `saveOfflineVideo(id, meta, blob)`. Progress comes from a streaming reader that just counts bytes (no per-chunk crypto work).
- `getOfflineVideoBlob(id)`: one IndexedDB read.
- `removeOfflineVideo(id)`: one IndexedDB delete.

**3. Single, dumb source rule in `PlayerControls`.**
- On mount: check `isVideoOffline(id)`. If yes → set `videoSrc = URL.createObjectURL(blob)`. If no → set `videoSrc = video.video_url`. Done.
- Delete the `online`/`offline` event listener that swaps source.
- Delete the `onError → swap to offline` retry path.
- Delete `errorRetryRef`, `pendingResumeRef`, the dual code paths.
- After a successful download, just call the same "load offline" function once — no resume-time juggling.
- Result: the `<video>` element gets exactly one `src` per mount. No reload loop possible.

**4. Make offline access bulletproof in `useAccessControl`.**
- If a cached role exists in `localStorage`, set `hasAccess=true` and `loading=false` immediately and **never set `hasAccess=false` afterwards** unless a network call explicitly returns "no role" (not just a network error).
- This stops the airplane-mode "Access Requested" flash.

**5. Small cleanups**
- Remove `src/lib/crypto.ts` (or leave it unused — your call, I'll just stop importing it).
- Keep `videoProxy.ts` as-is for streaming + downloads.
- Keep the localStorage videos cache and IndexedDB metadata fallback in `VideoLibrary` — those are working.

### Files touched

- `src/lib/opfs.ts` — replace with simple Blob-per-video IndexedDB store
- `src/hooks/useOfflineVideo.ts` — rewrite, no crypto, no chunking
- `src/components/PlayerControls.tsx` — one source, no swapping, no error-retry
- `src/components/VideoCard.tsx` — minor: still uses the same hook API
- `src/pages/VideoLibrary.tsx` — minor: `getAllOfflineMetas` rename
- `src/pages/VideoPlayer.tsx` — minor: `readOfflineVideoMeta` rename
- `src/hooks/useAccessControl.ts` — never downgrade `hasAccess` after a cache hit

### Trade-off you should know about

The offline copy is no longer AES-encrypted at rest. It still lives in the browser's private IndexedDB sandbox (not accessible to other sites or other OS apps without root/jailbreak), and the login password remains encrypted on the server. If you want the AES layer back later, we can add it as a single whole-file encrypt/decrypt instead of per-chunk — but the current per-chunk version is exactly what's killing mobile playback, so I want to remove it now and only re-add encryption if you really need it.

