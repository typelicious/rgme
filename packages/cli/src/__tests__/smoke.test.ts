import { describe, it, expect } from "vitest";
import { CLI_NAME } from "../index.js";

describe("@rgme/cli", () => {
  it("has a name", () => {
    expect(CLI_NAME).toBe("rgme");
  });
});
