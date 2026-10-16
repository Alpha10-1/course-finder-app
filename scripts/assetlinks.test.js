import { describe, expect, it } from "vitest";
import { buildAssetLinks, normalizeFingerprint, DEFAULT_PACKAGE } from "./assetlinks.mjs";

const FP = "14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A0:83:42:E6:1D:BE:A8:8A:04:96:B2:3F:CF:44:E5";

describe("normalizeFingerprint", () => {
  it("accepts the formats keytool and Play Console show", () => {
    expect(normalizeFingerprint(FP.toLowerCase())).toBe(FP);
    expect(normalizeFingerprint(FP.replace(/:/g, ""))).toBe(FP);
    expect(normalizeFingerprint(`SHA256: ${FP}`)).toBe(FP);
  });

  it("rejects anything that isn't a SHA-256 fingerprint", () => {
    expect(() => normalizeFingerprint("14:6D:E9")).toThrow(/isn't a SHA-256/);
    // A SHA-1 fingerprint (20 bytes) is a common mix-up.
    expect(() => normalizeFingerprint(FP.split(":").slice(0, 20).join(":"))).toThrow();
  });
});

describe("buildAssetLinks", () => {
  it("builds the statement Android checks", () => {
    expect(buildAssetLinks(DEFAULT_PACKAGE, [FP, FP.toLowerCase()])).toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: { namespace: "android_app", package_name: DEFAULT_PACKAGE, sha256_cert_fingerprints: [FP] },
      },
    ]);
  });

  it("rejects bad package names and missing fingerprints", () => {
    expect(() => buildAssetLinks("not a package", [FP])).toThrow(/package name/);
    expect(() => buildAssetLinks(DEFAULT_PACKAGE, [])).toThrow(/at least one/);
  });
});
