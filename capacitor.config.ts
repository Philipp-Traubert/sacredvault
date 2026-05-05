import type { CapacitorConfig } from "@capacitor/cli";

const devServerUrl = process.env.CAPACITOR_SERVER_URL || process.env.VITE_CAPACITOR_SERVER_URL;
const allowCleartextDevServer = process.env.CAPACITOR_ALLOW_CLEARTEXT === "true";

const config: CapacitorConfig = {
  appId: "com.sacredvault.app",
  appName: "Sacred Video Vault",
  webDir: "dist",
  ...(devServerUrl
    ? {
        server: {
          url: devServerUrl,
          cleartext: allowCleartextDevServer,
        },
      }
    : {}),
  android: {
    path: "android",
  },
};

export default config;
