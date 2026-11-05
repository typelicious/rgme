import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CRT_PRESETS, getCrtPreset } from "../lib/crt/presets";
import { FRAGMENT_SHADER, VERTEX_SHADER, UNIFORMS, createCrtRenderer, isWebGLAvailable } from "../lib/crt/shader";
import { CrtShaderCanvas } from "../components/CrtShaderCanvas";

function fakeGl(opts: { compileOk?: boolean; linkOk?: boolean } = {}) {
  const calls: string[] = [];
  const uniforms: Record<string, number[]> = {};
  const gl = new Proxy({ VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4 } as Record<string, unknown>, {
    get(t, k: string) {
      if (k in t) return t[k];
      if (k === "getShaderParameter") return () => opts.compileOk ?? true;
      if (k === "getProgramParameter") return () => opts.linkOk ?? true;
      if (k === "getShaderInfoLog") return () => "ERROR: 0:1: boom";
      if (k === "getProgramInfoLog") return () => "link boom";
      if (k === "getUniformLocation") return (_p: unknown, n: string) => n;
      if (/^uniform/.test(k)) return (loc: string, ...v: number[]) => void (uniforms[loc] = v);
      if (k === "shaderSource") return (_s: unknown, src: string) => void calls.push(`source:${src.length}`);
      if (/^(create|getAttribLocation)/.test(k)) return () => ({});
      return (...a: unknown[]) => void calls.push(`${k}:${a.length}`);
    }
  });
  return { gl, calls, uniforms };
}
const canvasWith = (gl: unknown, w = 320, h = 256) => ({ width: w, height: h, getContext: () => gl }) as unknown as HTMLCanvasElement;

describe("CRT presets", () => {
  it("are the four named presets with params in range", () => {
    expect(CRT_PRESETS.map((p) => p.label)).toEqual(["Authentic PAL (Clean)", "Trinitron CRT", "Commodore 1084S (Curved)", "Retro Arcade Grille"]);
    for (const p of CRT_PRESETS) for (const v of Object.values(p.params)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
    expect(getCrtPreset("clean").params.scanlineIntensity).toBe(0);
    expect(getCrtPreset("nope").id).toBe("clean");
  });
});

describe("CRT shader", () => {
  it("declares every uniform, curvature, mask, scanline and bloom logic", () => {
    for (const u of UNIFORMS) expect(FRAGMENT_SHADER).toContain(u);
    expect(FRAGMENT_SHADER).toMatch(/barrel/);
    expect(FRAGMENT_SHADER).toMatch(/gl_FragCoord/);
    expect(FRAGMENT_SHADER).toMatch(/sin\(/);
    expect(VERTEX_SHADER).toContain("a_pos");
  });
  it("compiles, links, uploads params and renders on a fake GL", () => {
    const { gl, calls, uniforms } = fakeGl();
    const r = createCrtRenderer(canvasWith(gl), canvasWith(null));
    r.setParams({ scanlineIntensity: 0.5, bloom: 0.2, curvature: 0.3, maskStrength: 0.1, vignette: 0.4 });
    r.render();
    expect(uniforms.u_scan).toEqual([0.5]);
    expect(uniforms.u_texSize).toEqual([320, 256]);
    expect(calls).toContain("drawArrays:3");
    expect(calls).toContain("texImage2D:6");
    r.dispose();
    r.render();
    expect(calls.filter((c) => c === "drawArrays:3")).toHaveLength(1);
  });
  it("throws descriptive errors with the info log", () => {
    expect(() => createCrtRenderer(canvasWith(fakeGl({ compileOk: false }).gl), canvasWith(null))).toThrow(/failed to compile: ERROR: 0:1: boom/);
    expect(() => createCrtRenderer(canvasWith(fakeGl({ linkOk: false }).gl), canvasWith(null))).toThrow(/failed to link: link boom/);
    expect(() => createCrtRenderer(canvasWith(null), canvasWith(null))).toThrow(/not available/);
  });
  it("isWebGLAvailable is false when no context exists", () => {
    expect(isWebGLAvailable({ createElement: () => ({ getContext: () => null }) as unknown as HTMLElement })).toBe(false);
    expect(isWebGLAvailable({ createElement: () => { throw new Error("x"); } })).toBe(false);
  });
});

describe("CrtShaderCanvas", () => {
  const params = CRT_PRESETS[2]!.params;
  it("falls back (renders nothing, calls onFallback) when WebGL is unavailable", async () => {
    const onFallback = vi.fn();
    const src = document.createElement("canvas");
    const { container } = render(<CrtShaderCanvas source={src} params={params} enabled onFallback={onFallback} />);
    await waitFor(() => expect(onFallback).toHaveBeenCalled());
    expect(screen.queryByTestId("crt-canvas")).toBeNull();
    expect(container.firstChild).toBeNull();
  });
  it("renders nothing when disabled or without a source", () => {
    render(<CrtShaderCanvas source={null} params={params} enabled />);
    expect(screen.queryByTestId("crt-canvas")).toBeNull();
  });
});
