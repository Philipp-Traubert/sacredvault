# Play Store Prep Checklist

Target listing facts from product context:

- Category: Education
- Price: Free
- Countries: Worldwide
- Age target / content: 18+
- Login required: yes
- Package name: `com.sacredvault.app`
- App name: Sacred Video Vault

## Before first internal test upload

- [x] Capacitor config uses `com.sacredvault.app` and bundled `dist/` by default.
- [x] Dev hot reload remains opt-in via `CAPACITOR_SERVER_URL` / `VITE_CAPACITOR_SERVER_URL`.
- [x] Generate Android project and inspect native manifest.
- [x] Set `android:allowBackup="false"` for release if not already present.
- [x] Disable cleartext traffic in the generated Android manifest for production bundled builds.
- [ ] Confirm release is non-debuggable.
- [ ] Configure launcher icons/adaptive icons and splash screen.
- [ ] Create a signed AAB with the final Play signing workflow.
- [ ] Run on a physical Android device once phone/toolchain is unblocked.
- [ ] Verify login, TEK/TATI access separation, download, airplane-mode playback, deletion, and sign-out.
- [ ] Add Crashlytics only with analytics disabled, and only commit non-secret config intended for the public app package.

## Store policy notes

- Prominently disclose that offline downloads are app-private/protected but cannot be made impossible to extract from a rooted/compromised device.
- If videos are hosted on Wix direct URLs during prototype, ensure the URLs are authorized for app distribution and do not expire unexpectedly.
- Keep any admin/video source credentials out of the client app and repository.
