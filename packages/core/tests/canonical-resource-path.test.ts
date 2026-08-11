import { describe, expect, it } from "vitest";

import { encodeCanonicalResourceDirectory } from "../src/canonical-resource-path";

describe("canonical resource directory encoding", () => {
  it("keeps portable identifiers readable", () => {
    expect(encodeCanonicalResourceDirectory("123e4567-e89b-12d3-a456")).toBe(
      "123e4567-e89b-12d3-a456",
    );
  });

  it("encodes Windows-reserved punctuation and Unicode as UTF-8 bytes", () => {
    expect(encodeCanonicalResourceDirectory("custom:规则*one")).toBe(
      "custom%3A%E8%A7%84%E5%88%99%2Aone",
    );
  });

  it("rejects an empty resource id", () => {
    expect(() => encodeCanonicalResourceDirectory("")).toThrow(
      /resource id is required/,
    );
  });
});
