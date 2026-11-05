import type { FloppyController } from "@rgme/core";

export interface SwapDisc {
  id: string;
  label: string;
  sha256?: string;
}

export interface DiskSwapper {
  readonly drive: number;
  readonly discs: readonly SwapDisc[];
  readonly currentIndex: number;
  /** n is 1-based (hotkey semantics). Returns false when the disk doesn't exist. */
  insertNth(n: number): boolean;
  next(): void;
  prev(): void;
  setDiscs(discs: readonly SwapDisc[], current?: number): void;
}

/** Ejects and re-inserts DF<drive>: with real head activity so FloppySoundSynth produces its sounds. */
export function createDiskSwapper(opts: {
  controller: FloppyController;
  drive?: number;
  discs: readonly SwapDisc[];
  onSwap?: (index: number, disc: SwapDisc) => void;
  initialIndex?: number;
}): DiskSwapper {
  const { controller } = opts;
  const drive = opts.drive ?? 0;
  let discs = [...opts.discs];
  let current = opts.initialIndex ?? 0;

  const swapTo = (index: number) => {
    const disc = discs[index];
    if (!disc) return false;
    controller.eject(drive);
    controller.insertDisk(drive, { id: disc.id, label: disc.label, sha256: disc.sha256 });
    controller.setMotor(drive, true);
    controller.recalibrate(drive);
    controller.seek(drive, 40);
    controller.pulseActivity(drive, "read", 300);
    current = index;
    opts.onSwap?.(index, disc);
    return true;
  };

  return {
    drive,
    get discs() { return discs; },
    get currentIndex() { return current; },
    insertNth: (n) => Number.isInteger(n) && n >= 1 && swapTo(n - 1),
    next() { if (discs.length) swapTo((current + 1) % discs.length); },
    prev() { if (discs.length) swapTo((current - 1 + discs.length) % discs.length); },
    setDiscs(d, c = 0) { discs = [...d]; current = Math.min(Math.max(c, 0), Math.max(discs.length - 1, 0)); }
  };
}
