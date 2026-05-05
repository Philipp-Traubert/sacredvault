# Privacy and Play Data Safety Notes

## Declared data categories

Per product context, the app collects/uses:

- Email address: account login and access control.
- Name: account/profile display if configured in Supabase.
- Crash logs: app stability diagnostics if Crashlytics or equivalent is enabled.

The app should **not** declare analytics collection unless analytics is intentionally added later. It should not declare journal, health, or wellness data based on the current app scope.

## Current implementation notes

- Supabase auth/session data is required for login.
- No analytics SDK was added in this pass.
- No Firebase config or secrets were added.
- Offline videos are stored in app-private storage on Android and are not intended for gallery/file-manager visibility.

## Recommended privacy policy language points

- Explain login requirement and how TEK/TATI group authorization controls available videos.
- Explain offline downloads: videos are saved inside app-private storage for offline playback and can be deleted in-app.
- Explain limitation: app-private/protected storage reduces casual access, but no mobile app can guarantee that media is impossible to extract from rooted, compromised, backed-up, or debug-enabled devices.
- Explain crash logs if enabled: crash diagnostics may include device/app version and stack traces, used only for stability.
- State that analytics/ad tracking are not used unless that changes.

## Crashlytics configuration guidance

If Firebase Crashlytics is added later:

- Disable Firebase Analytics collection unless explicitly needed.
- Do not commit private keys or service account credentials.
- Only commit `google-services.json` if it is the intended public Android app config for `com.sacredvault.app` and the owner accepts that Firebase app identifiers are public-by-design.
