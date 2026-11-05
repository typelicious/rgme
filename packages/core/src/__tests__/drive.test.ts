import { describe, it, expect, vi } from "vitest";
import { FloppyController, FloppySoundSynth, STEP_SPACING, type FloppyEvent, type FloppyAudioContext } from "../drive/index.js";

const disk = (id: string) => ({ id, label: id, sha256: "a".repeat(64) });

describe("FloppyController", () => {
  it("has four drives DF0:-DF3: in a clean initial state", () => {
    const c = new FloppyController();
    expect(c.getAll().map((d) => d.name)).toEqual(["DF0:", "DF1:", "DF2:", "DF3:"]);
    expect(c.getState(0)).toMatchObject({ motor: false, cylinder: 0, diskInserted: false, activity: "idle", ledColor: "off" });
  });
  it("seek emits one step per cylinder, track0 and a seek summary", () => {
    const c = new FloppyController();
    const ev: FloppyEvent[] = [];
    c.onEvent((e) => ev.push(e));
    c.seek(0, 3);
    expect(ev.filter((e) => e.type === "step")).toHaveLength(3);
    expect(c.getState(0).cylinder).toBe(3);
    expect(ev.at(-1)).toEqual({ type: "seek", drive: 0, from: 0, to: 3, steps: 3 });
    ev.length = 0;
    c.seek(0, 0);
    expect(ev.map((e) => e.type)).toEqual(["step", "step", "step", "track0", "seek"]);
    ev.length = 0;
    c.seek(0, 0); // no movement, no events
    expect(ev).toEqual([]);
    c.recalibrate(0); // always clicks
    expect(ev.map((e) => e.type)).toEqual(["track0"]);
  });
  it("validates ranges", () => {
    const c = new FloppyController();
    expect(() => c.seek(0, 80)).toThrow(RangeError);
    expect(() => c.seek(0, -1)).toThrow(RangeError);
    expect(() => c.seek(4, 0)).toThrow(RangeError);
    expect(() => c.insertDisk(-1, disk("x"))).toThrow(RangeError);
    c.seek(2, 79);
    expect(c.getState(2).cylinder).toBe(79);
  });
  it("disk swap ejects the old disk before inserting the new one", () => {
    const c = new FloppyController();
    const ev: FloppyEvent[] = [];
    c.onEvent((e) => ev.push(e));
    c.insertDisk(0, disk("disk1"));
    c.insertDisk(0, disk("disk2"));
    expect(ev.map((e) => e.type + ":" + (e as { media: { id: string } }).media.id)).toEqual(["insert:disk1", "eject:disk1", "insert:disk2"]);
    expect(c.getState(0).media?.id).toBe("disk2");
    expect(c.eject(0)?.id).toBe("disk2");
    expect(c.eject(0)).toBeUndefined();
    expect(c.getState(0).diskInserted).toBe(false);
  });
  it("motor and LED: green when spinning, amber on activity, off when stopped", () => {
    vi.useFakeTimers();
    const c = new FloppyController();
    c.insertDisk(1, disk("d"));
    c.pulseActivity(1, "read"); // motor off => ignored
    expect(c.getState(1).activity).toBe("idle");
    c.setMotor(1, true);
    expect(c.getState(1).ledColor).toBe("green");
    c.pulseActivity(1, "write", 100);
    expect(c.getState(1)).toMatchObject({ activity: "write", ledColor: "amber" });
    vi.advanceTimersByTime(100);
    expect(c.getState(1)).toMatchObject({ activity: "idle", ledColor: "green" });
    c.pulseActivity(1, "read");
    c.setMotor(1, false);
    expect(c.getState(1)).toMatchObject({ activity: "idle", ledColor: "off", motor: false });
    vi.useRealTimers();
  });
  it("unsubscribe stops events; getState returns copies", () => {
    const c = new FloppyController();
    const fn = vi.fn();
    const off = c.onEvent(fn);
    c.setMotor(0, true);
    off();
    c.setMotor(0, false);
    expect(fn).toHaveBeenCalledTimes(1);
    c.getState(0).motor = true;
    expect(c.getState(0).motor).toBe(false);
  });
});

function fakeAudio() {
  const starts: Array<{ type: string; at: number }> = [];
  let now = 1;
  let closed = false;
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => ({ connect() {}, disconnect() {} });
  const ctx: FloppyAudioContext = {
    get currentTime() { return now; },
    sampleRate: 100, destination: {},
    createOscillator: () => { const o = { ...node(), type: "", frequency: param(), start: (t: number) => void starts.push({ type: "osc:" + o.type, at: t }), stop() {} }; return o; },
    createGain: () => ({ ...node(), gain: param() }),
    createBiquadFilter: () => ({ ...node(), type: "", frequency: param(), Q: param() }),
    createBuffer: (_c, len) => ({ getChannelData: () => new Float32Array(len) }),
    createBufferSource: () => ({ ...node(), buffer: null, start: (t: number) => void starts.push({ type: "noise", at: t }), stop() {} }),
    close: async () => void (closed = true)
  };
  return { ctx, starts, isClosed: () => closed };
}

describe("FloppySoundSynth", () => {
  it("creates its context lazily and renders step clacks spaced for a buzz", () => {
    const f = fakeAudio();
    let created = 0;
    const synth = new FloppySoundSynth(() => { created++; return f.ctx; });
    const c = new FloppyController();
    synth.attach(c);
    expect(created).toBe(0);
    c.seek(0, 10);
    expect(created).toBe(1);
    const noise = f.starts.filter((s) => s.type === "noise").map((s) => s.at);
    expect(noise).toHaveLength(10);
    expect(noise[1]! - noise[0]!).toBeCloseTo(STEP_SPACING, 6);
    expect(f.starts.some((s) => s.type === "osc:sawtooth")).toBe(true); // seek chirp for >3 steps
  });
  it("plays track0 click, spin hum on/off, and disk insert thunk", () => {
    const f = fakeAudio();
    const synth = new FloppySoundSynth(() => f.ctx);
    const c = new FloppyController();
    synth.attach(c);
    c.seek(0, 1);
    const before = synth.played;
    c.seek(0, 0);
    expect(synth.played).toBeGreaterThan(before);
    c.setMotor(0, true);
    expect(f.starts.some((s) => s.type === "osc:sawtooth")).toBe(true);
    c.setMotor(0, false);
    c.insertDisk(0, disk("d"));
    synth.dispose();
    expect(f.isClosed()).toBe(true);
  });
  it("is silent and safe without Web Audio, and supports mute", () => {
    const none = new FloppySoundSynth(() => undefined);
    const c = new FloppyController();
    none.attach(c);
    expect(() => { c.seek(0, 5); c.setMotor(0, true); none.setMuted(true); none.dispose(); }).not.toThrow();
    expect(none.played).toBe(0);
    const f = fakeAudio();
    const s = new FloppySoundSynth(() => f.ctx);
    s.setMuted(true);
    s.handle({ type: "track0", drive: 0 });
    expect(s.played).toBe(1);
  });
});
