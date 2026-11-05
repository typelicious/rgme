import { describe, it, expect } from "vitest";
import { CORE_VERSION } from "../index.js";

describe("@rgme/core", () => {
  it("exposes a version", () => {
    expect(CORE_VERSION).toBe("0.2.0");
  });
});
