export const DRIVE_COUNT = 4;
export const MAX_CYLINDER = 79;
export type DriveId = 0 | 1 | 2 | 3;
export type DriveActivity = "idle" | "read" | "write";
export type DriveLed = "off" | "green" | "amber";

export interface FloppyMedia {
  id: string;
  label?: string;
  sha256?: string;
  /** Container the image came from (set by ipf/mount.ts). */
  format?: "adf" | "ipf";
  /** Plain 901,120-byte ADF image mounted in the drive (decoded from the IPF when format is 'ipf'). */
  image?: Uint8Array;
}

export interface DriveState {
  readonly drive: DriveId;
  readonly name: string; // "DF0:"
  motor: boolean;
  cylinder: number;
  side: 0 | 1;
  diskInserted: boolean;
  media?: FloppyMedia;
  activity: DriveActivity;
  /** green = motor spinning, amber = read/write activity, off = idle. */
  ledColor: DriveLed;
}

export type FloppyEvent =
  | { type: "insert"; drive: DriveId; media: FloppyMedia }
  | { type: "eject"; drive: DriveId; media: FloppyMedia }
  | { type: "motor"; drive: DriveId; on: boolean }
  | { type: "step"; drive: DriveId; cylinder: number; direction: 1 | -1 }
  | { type: "track0"; drive: DriveId }
  | { type: "seek"; drive: DriveId; from: number; to: number; steps: number }
  | { type: "activity"; drive: DriveId; activity: DriveActivity };

export type FloppyListener = (e: FloppyEvent) => void;

function assertDrive(d: number): asserts d is DriveId {
  if (!Number.isInteger(d) || d < 0 || d >= DRIVE_COUNT) throw new RangeError(`Drive must be 0-${DRIVE_COUNT - 1} (DF0:-DF3:)`);
}

/** Virtual floppy drives DF0:-DF3: (state machine only; no emulation, no media bytes). */
export class FloppyController {
  private drives: DriveState[] = ([0, 1, 2, 3] as const).map((drive) => ({
    drive, name: `DF${drive}:`, motor: false, cylinder: 0, side: 0 as const,
    diskInserted: false, activity: "idle" as const, ledColor: "off" as const
  }));
  private listeners = new Set<FloppyListener>();
  private timers = new Map<DriveId, ReturnType<typeof setTimeout>>();

  onEvent(l: FloppyListener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  private emit(e: FloppyEvent) {
    for (const l of this.listeners) l(e);
  }
  private refreshLed(s: DriveState) {
    s.ledColor = s.activity !== "idle" ? "amber" : s.motor ? "green" : "off";
  }

  /** Snapshot copy of a drive's state. */
  getState(drive: number): DriveState {
    assertDrive(drive);
    return { ...this.drives[drive]! };
  }
  getAll(): DriveState[] {
    return this.drives.map((d) => ({ ...d }));
  }

  /** Inserts a disk; an already inserted disk is ejected first (disk swap). */
  insertDisk(drive: number, media: FloppyMedia) {
    assertDrive(drive);
    const s = this.drives[drive]!;
    if (s.diskInserted) this.eject(drive);
    s.diskInserted = true;
    s.media = { ...media };
    this.emit({ type: "insert", drive, media: s.media });
  }

  /** Atomically swaps disk media in the drive, resetting head to cylinder 0 and pulsing read activity. */
  swapDisk(drive: number, media: FloppyMedia) {
    assertDrive(drive);
    this.eject(drive);
    this.insertDisk(drive, media);
    this.setMotor(drive, true);
    this.recalibrate(drive);
    this.pulseActivity(drive, "read", 200);
  }

  eject(drive: number): FloppyMedia | undefined {
    assertDrive(drive);
    const s = this.drives[drive]!;
    if (!s.diskInserted || !s.media) return undefined;
    const media = s.media;
    this.clearActivity(drive);
    s.diskInserted = false;
    s.media = undefined;
    this.emit({ type: "eject", drive, media });
    return media;
  }

  setMotor(drive: number, on: boolean) {
    assertDrive(drive);
    const s = this.drives[drive]!;
    if (s.motor === on) return;
    s.motor = on;
    if (!on) this.clearActivity(drive);
    this.refreshLed(s);
    this.emit({ type: "motor", drive, on });
  }

  /** Moves the head, emitting one 'step' per cylinder, 'track0' when it arrives at cylinder 0, then 'seek'. */
  seek(drive: number, cylinder: number) {
    assertDrive(drive);
    if (!Number.isInteger(cylinder) || cylinder < 0 || cylinder > MAX_CYLINDER) throw new RangeError(`Cylinder must be 0-${MAX_CYLINDER}`);
    const s = this.drives[drive]!;
    const from = s.cylinder;
    const direction: 1 | -1 = cylinder >= from ? 1 : -1;
    while (s.cylinder !== cylinder) {
      s.cylinder += direction;
      this.emit({ type: "step", drive, cylinder: s.cylinder, direction });
    }
    if (from !== cylinder) {
      if (cylinder === 0) this.emit({ type: "track0", drive });
      this.emit({ type: "seek", drive, from, to: cylinder, steps: Math.abs(cylinder - from) });
    }
  }

  /** Recalibrate: seek to cylinder 0; always produces the track-0 click, even if already there. */
  recalibrate(drive: number) {
    assertDrive(drive);
    const s = this.drives[drive]!;
    if (s.cylinder === 0) this.emit({ type: "track0", drive });
    else this.seek(drive, 0);
  }

  setSide(drive: number, side: 0 | 1) {
    assertDrive(drive);
    this.drives[drive]!.side = side;
  }

  /** Light the drive LED amber for `ms` (read/write activity). Requires a disk and a spinning motor. */
  pulseActivity(drive: number, activity: "read" | "write", ms = 120) {
    assertDrive(drive);
    const s = this.drives[drive]!;
    if (!s.diskInserted || !s.motor) return;
    this.clearTimer(drive);
    s.activity = activity;
    this.refreshLed(s);
    this.emit({ type: "activity", drive, activity });
    this.timers.set(drive, setTimeout(() => this.clearActivity(drive), ms));
  }

  private clearTimer(drive: DriveId) {
    const t = this.timers.get(drive);
    if (t !== undefined) clearTimeout(t);
    this.timers.delete(drive);
  }
  private clearActivity(drive: DriveId) {
    this.clearTimer(drive);
    const s = this.drives[drive]!;
    if (s.activity === "idle") return;
    s.activity = "idle";
    this.refreshLed(s);
    this.emit({ type: "activity", drive, activity: "idle" });
  }

  dispose() {
    for (const d of [0, 1, 2, 3] as const) this.clearTimer(d);
    this.listeners.clear();
  }
}
