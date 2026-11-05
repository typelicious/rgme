import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "../App";

describe("@rgme/web", () => {
  it("renders", () => {
    render(<App />);
    expect(screen.getByText("RGME")).toBeTruthy();
  });
});
