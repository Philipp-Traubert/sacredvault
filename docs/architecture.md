# Sacred Video Vault Architecture

## Current app shape

- React/Vite web UI wrapped by Capacitor for Android.
- Production Capacitor identity: `com.sacredvault.app`, app name `Sacred Video Vault`.
- Production builds load the bundled `dist/` app. A remote dev server is only enabled when `CAPACITOR_SERVER_URL` or `VITE_CAPACITOR_SERVER_URL` is explicitly set before running Capacitor.
- Authentication and video metadata use Supabase.
- Access control is expected to be enforced server-side by Supabase RLS / query policies for separate TEK and TATI groups. The app UI should not be the only enforcement layer.

## Offline video flow

1. User authenticates and sees only authorized videos.
2. Download validates the source URL (HTTPS required except localhost development) and rejects HTML/JSON/text responses.
3. Native Android downloads stream through Capacitor Filesystem to `Directory.Data`, under `videos/` and metadata under `video-meta/`.
4. Metadata is written only after the media file passes minimum-size verification.
5. Playback resolves a native file URI via `Filesystem.getUri()` and `Capacitor.convertFileSrc()`.
6. Delete removes both video and metadata.

## Protection model and limits

Implemented now:

- Android-first app-private storage (`Directory.Data`) rather than shared downloads/gallery paths.
- `.nomedia` marker in the private video directory as a future-proof media scanner hint.
- No production remote webview URL in Capacitor config.
- HTTPS-only video source policy outside localhost development.
- Partial-download cleanup and metadata/file coupling.

Important limitation:

- The current Capacitor Filesystem approach stores playable video files in app-private storage but does **not** provide strong at-rest encryption of the video bytes. Android app-private storage prevents normal gallery/file-manager visibility and blocks other non-root apps, but a rooted/debuggable/compromised device or extracted app backup may still expose files.
- True encrypted-at-rest video with streaming playback likely needs a custom native Android component: encrypted file storage plus a local authenticated decrypting media data source / ExoPlayer integration, or a DRM-capable streaming source. HTML `<video>` cannot stream AES-GCM chunks directly from encrypted app-private files without decrypting to a playable temporary file or implementing a local range-serving decryptor.

## Recommended next native hardening

- Add a custom Capacitor Android plugin using Jetpack Security / Android Keystore for keys and ExoPlayer `DataSource` for decrypted playback.
- Ensure `android:allowBackup="false"` in the Android manifest for release builds.
- Ensure release builds are non-debuggable and signed with Play App Signing.
- Consider Firebase Crashlytics with analytics collection disabled; do not commit real `google-services.json` secrets/placeholders unless generated for the final package.
