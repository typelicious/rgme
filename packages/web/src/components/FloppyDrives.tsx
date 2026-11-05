import { useEffect, useState } from "react";
import type { DriveState, FloppyController } from "@rgme/core";

export interface DiscOption {
  id: string;
  label: string;
  sha256?: string;
}

export interface FloppyDrivesProps {
  controller: FloppyController;
  /** Discs of the loaded title (e.g. "Disk 1 of 11"); enables the swap drawer. */
  discs?: DiscOption[];
  /** Called after a disc was inserted through the drawer. */
  onSwap?: (drive: number, discId: string) => void;
}

const LED_COLOR = { off: "var(--rgme-fg-muted)", green: "var(--rgme-accent-phosphor-green)", amber: "var(--rgme-accent-phosphor-amber)" } as const;

export function FloppyDrives({ controller, discs = [], onSwap }: FloppyDrivesProps) {
  const [drives, setDrives] = useState<DriveState[]>(() => controller.getAll());
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<Record<string, number>>({});

  useEffect(() => {
    setDrives(controller.getAll());
    return controller.onEvent(() => setDrives(controller.getAll()));
  }, [controller]);

  const insert = (discId: string) => {
    const disc = discs.find((d) => d.id === discId);
    if (!disc) return;
    const drive = target[discId] ?? 0;
    controller.insertDisk(drive, disc);
    onSwap?.(drive, disc.id);
  };

  return (
    <section className="rgme-panel" aria-label="Floppy drives" data-testid="floppy-drives">
      <div className="flex items-center justify-between">
        <h2 className="text-lg">Drives</h2>
        <button className="rgme-btn" aria-expanded={open} data-testid="swap-toggle" onClick={() => setOpen((o) => !o)}>
          {open ? "Hide disk swap" : "Disk swap"}
        </button>
      </div>
      <ul className="mt-2 flex flex-col gap-2">
        {drives.map((d) => (
          <li key={d.drive} className="flex items-center gap-2 text-sm" data-testid={`drive-${d.drive}`} data-motor={d.motor} data-activity={d.activity}>
            <span
              data-testid={`led-${d.drive}`}
              data-led={d.ledColor}
              role="img"
              aria-label={`${d.name} LED ${d.ledColor}`}
              style={{ width: 10, height: 10, borderRadius: 2, background: LED_COLOR[d.ledColor], boxShadow: d.ledColor === "off" ? "none" : `0 0 6px ${LED_COLOR[d.ledColor]}` }}
            />
            <span className="font-mono">{d.name}</span>
            <span style={{ color: "var(--rgme-fg-secondary)" }} className="flex-1 truncate" data-testid={`disk-${d.drive}`}>
              {d.diskInserted ? (d.media?.label ?? d.media?.id) : "— empty —"}
            </span>
            <span className="font-mono" data-testid={`cyl-${d.drive}`} title="Cylinder">{String(d.cylinder).padStart(2, "0")}</span>
            <span data-testid={`motor-${d.drive}`} aria-label={d.motor ? "Motor on" : "Motor off"}>{d.motor ? "⟳" : "·"}</span>
            <button className="rgme-btn" disabled={!d.diskInserted} onClick={() => controller.eject(d.drive)} data-testid={`eject-${d.drive}`}>Eject</button>
          </li>
        ))}
      </ul>
      {open && (
        <div className="mt-3" data-testid="swap-drawer">
          {discs.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--rgme-fg-secondary)" }}>No multi-disk title loaded.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {discs.map((disc) => (
                <li key={disc.id} className="flex items-center gap-2 text-sm" data-testid={`disc-${disc.id}`}>
                  <span className="flex-1 truncate">{disc.label}</span>
                  <select
                    aria-label={`Drive for ${disc.label}`}
                    data-testid={`target-${disc.id}`}
                    value={target[disc.id] ?? 0}
                    onChange={(e) => setTarget((t) => ({ ...t, [disc.id]: Number(e.target.value) }))}
                  >
                    {[0, 1, 2, 3].map((n) => (
                      <option key={n} value={n}>{`DF${n}:`}</option>
                    ))}
                  </select>
                  <button className="rgme-btn" onClick={() => insert(disc.id)} data-testid={`insert-${disc.id}`}>Insert</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
