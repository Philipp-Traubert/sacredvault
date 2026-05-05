# Open Questions and Blockers

## Blockers encountered in this pass

- Android project generation and Capacitor sync succeeded.
- Native Gradle build is blocked locally because no Java Runtime is installed (`Unable to locate a Java Runtime`).
- Physical Android phone/device verification is still blocked by availability outside this coding session.
- Strong encrypted-at-rest video playback is not complete with the current web/Capacitor Filesystem-only approach. App-private storage is implemented, but true encrypted streaming playback requires native Android work (custom Capacitor plugin / ExoPlayer decrypting data source / DRM).

## Open product questions saved for owner

- Final TEK/TATI group source of truth: Supabase roles/table schema, auth metadata, or another admin system?
- Final Wix direct-download URL behavior: permanent URLs, signed URLs, or proxied through Supabase Edge Functions?
- Is DRM required, or is app-private protected offline storage plus documented extraction limitation acceptable for launch?
- Should Firebase Crashlytics be added now, and who will provide/own the Firebase project for `com.sacredvault.app`?
- Final Play Store listing assets: icon, feature graphic, screenshots, short description, full description, support email, privacy policy URL.

## Local environment notes

- No `.env*` files were found in the repository during this pass.
- Dependencies were installed with npm, creating `package-lock.json`.
