import { Capacitor } from "@capacitor/core";

/** True when running inside the Capacitor native shell (iOS/Android app). */
export const isNative = Capacitor.isNativePlatform();

/** Convert a native filesystem path/URI to one usable by <video src>. */
export function toWebViewUri(nativeUri: string): string {
  return Capacitor.convertFileSrc(nativeUri);
}
