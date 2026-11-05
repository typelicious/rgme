import type { CrtParams } from "./presets";

export const VERTEX_SHADER = `attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER = `precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_texSize;
uniform float u_scan;
uniform float u_bloom;
uniform float u_curve;
uniform float u_mask;
uniform float u_vig;

vec2 barrel(vec2 uv) {
  vec2 c = uv * 2.0 - 1.0;
  vec2 off = abs(c.yx) / vec2(6.0, 4.0);
  c += c * off * off * (u_curve * 6.0);
  return c * 0.5 + 0.5;
}

void main() {
  vec2 uv = barrel(v_uv);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  vec3 col = texture2D(u_tex, uv).rgb;

  // phosphor bloom: multi-tap glow around the beam
  vec2 px = 1.0 / u_texSize;
  vec3 glow = texture2D(u_tex, uv + vec2( 1.5, 0.0) * px).rgb
            + texture2D(u_tex, uv + vec2(-1.5, 0.0) * px).rgb
            + texture2D(u_tex, uv + vec2(0.0,  1.5) * px).rgb
            + texture2D(u_tex, uv + vec2(0.0, -1.5) * px).rgb
            + texture2D(u_tex, uv + vec2( 3.0, 0.0) * px).rgb * 0.5
            + texture2D(u_tex, uv + vec2(-3.0, 0.0) * px).rgb * 0.5;
  col += (glow / 5.0) * u_bloom * 0.6;

  // scanlines: one bright line per source row
  float line = 0.5 + 0.5 * sin(uv.y * u_texSize.y * 6.2831853 - 1.5707963);
  col *= mix(1.0, 0.25 + 0.75 * line, u_scan);

  // aperture grille / shadow mask on output pixels
  float m = mod(floor(gl_FragCoord.x), 3.0);
  vec3 grille = vec3(m < 0.5 ? 1.0 : 1.0 - u_mask, (m > 0.5 && m < 1.5) ? 1.0 : 1.0 - u_mask, m > 1.5 ? 1.0 : 1.0 - u_mask);
  col *= mix(vec3(1.0), grille, u_mask);

  // vignette
  vec2 q = uv * (1.0 - uv);
  col *= mix(1.0, pow(clamp(q.x * q.y * 16.0, 0.0, 1.0), 0.35), u_vig);

  // compensate brightness lost to scanlines/mask
  col *= 1.0 + u_scan * 0.35 + u_mask * 0.4;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export const UNIFORMS = ["u_tex", "u_texSize", "u_scan", "u_bloom", "u_curve", "u_mask", "u_vig"] as const;

export function isWebGLAvailable(doc: Pick<Document, "createElement"> = document): boolean {
  try {
    const c = doc.createElement("canvas") as HTMLCanvasElement;
    return Boolean(c.getContext("webgl") ?? c.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

function compile(gl: WebGLRenderingContext, type: number, src: string, label: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error(`CRT shader: could not create ${label} shader`);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) ?? "";
    gl.deleteShader(sh);
    throw new Error(`CRT shader: ${label} shader failed to compile: ${log}`);
  }
  return sh;
}

export interface CrtRenderer {
  setParams(p: CrtParams): void;
  render(): void;
  dispose(): void;
}

export function createCrtRenderer(canvas: HTMLCanvasElement, source: HTMLCanvasElement): CrtRenderer {
  const gl = (canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false }) ??
    canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
  if (!gl) throw new Error("CRT shader: WebGL is not available");

  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER, "vertex");
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER, "fragment");
  const prog = gl.createProgram();
  if (!prog) throw new Error("CRT shader: could not create program");
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog) ?? "";
    gl.deleteProgram(prog);
    throw new Error(`CRT shader: program failed to link: ${log}`);
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // fullscreen triangle
  const loc = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  // NEAREST + CLAMP is required for non-power-of-two textures in WebGL1
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  const u = Object.fromEntries(UNIFORMS.map((n) => [n, gl.getUniformLocation(prog, n)])) as Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;
  gl.uniform1i(u.u_tex, 0);
  let disposed = false;

  return {
    setParams(p) {
      gl.uniform1f(u.u_scan, p.scanlineIntensity);
      gl.uniform1f(u.u_bloom, p.bloom);
      gl.uniform1f(u.u_curve, p.curvature);
      gl.uniform1f(u.u_mask, p.maskStrength);
      gl.uniform1f(u.u_vig, p.vignette);
    },
    render() {
      if (disposed) return;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.uniform2f(u.u_texSize, source.width, source.height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      disposed = true;
      gl.deleteTexture(tex);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    }
  };
}
