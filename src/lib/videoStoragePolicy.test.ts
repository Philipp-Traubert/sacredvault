import { describe, expect, it } from "vitest";
import {
  assertLooksLikeVideoDownload,
  encodeStorageId,
  metaFilename,
  validateVideoSourceUrl,
  videoFilename,
  videoStoragePolicy,
} from "./videoStoragePolicy";

const expectThrow = (fn: () => void, message: RegExp) => expect(fn).toThrow(message);

describe("video storage policy", () => {
  it("stores videos and metadata in app-private subdirectories with encoded ids", () => {
    expect(videoStoragePolicy.videoDir).toBe("videos");
    expect(videoStoragePolicy.metaDir).toBe("video-meta");
    expect(videoStoragePolicy.noMediaFile).toBe("videos/.nomedia");
    expect(videoFilename("../TEK intro/01")).toBe("videos/..%2FTEK%20intro%2F01.mp4");
    expect(metaFilename("../TEK intro/01")).toBe("video-meta/..%2FTEK%20intro%2F01.json");
    expect(encodeStorageId("  abc  ")).toBe("abc");
  });

  it("rejects blank storage ids", () => {
    expectThrow(() => encodeStorageId("   "), /id is required/i);
  });

  it("requires https video source urls except localhost development", () => {
    expect(() => validateVideoSourceUrl("https://static.wixstatic.com/video.mp4")).not.toThrow();
    expect(() => validateVideoSourceUrl("http://localhost:8080/video.mp4")).not.toThrow();
    expectThrow(() => validateVideoSourceUrl("http://example.com/video.mp4"), /HTTPS/i);
    expectThrow(() => validateVideoSourceUrl("not a url"), /invalid/i);
  });

  it("rejects HTML/JSON/text and tiny downloads", () => {
    expect(() => assertLooksLikeVideoDownload("video/mp4", 101_000)).not.toThrow();
    expect(() => assertLooksLikeVideoDownload("application/octet-stream", 101_000)).not.toThrow();
    expectThrow(() => assertLooksLikeVideoDownload("text/html", 101_000), /non-video/i);
    expectThrow(() => assertLooksLikeVideoDownload("application/json", 101_000), /non-video/i);
    expectThrow(() => assertLooksLikeVideoDownload("video/mp4", 99_999), /too small/i);
  });
});
