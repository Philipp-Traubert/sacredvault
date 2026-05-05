import { describe, expect, it } from "vitest";
import config from "../../capacitor.config";

describe("Capacitor Android production identity", () => {
  it("uses the Play Store package id and display name", () => {
    expect(config.appId).toBe("com.sacredvault.app");
    expect(config.appName).toBe("Sacred Video Vault");
    expect(config.webDir).toBe("dist");
  });

  it("does not ship a remote dev server URL by default", () => {
    expect(config.server?.url).toBeUndefined();
    expect(config.server?.cleartext).not.toBe(true);
  });
});
