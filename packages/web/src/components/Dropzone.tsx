import { useRef, useState, type DragEvent } from "react";

export type IdentStatus = "Idle" | "Analyzing" | "Identified" | "Unknown";

export interface DroppedInfo {
  name: string;
  size: number;
  sha256?: string;
  status: IdentStatus;
}

export function Dropzone({ info, onFile }: { info?: DroppedInfo; onFile: (file: File) => void }) {
  const [active, setActive] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const drop = (e: DragEvent) => {
    e.preventDefault();
    setActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  return (
    <section className="rgme-panel">
      <div
        data-testid="dropzone"
        className="rgme-dropzone"
        data-active={active}
        role="button"
        tabIndex={0}
        aria-label="Drop an ADF disk image here or press Enter to browse"
        onDragOver={(e) => { e.preventDefault(); setActive(true); }}
        onDragLeave={() => setActive(false)}
        onDrop={drop}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") input.current?.click(); }}
        style={{ border: "2px dashed var(--rgme-border-subtle)", borderRadius: 6, padding: 24, textAlign: "center", cursor: "pointer", color: "var(--rgme-fg-secondary)" }}
      >
        Drop an <strong>.adf</strong> here to analyze
        <input
          ref={input}
          data-testid="file-input"
          type="file"
          accept=".adf"
          hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
        />
      </div>
      {info && (
        <dl className="mt-3 text-sm grid gap-1" data-testid="drop-info">
          <div><dt className="inline" style={{ color: "var(--rgme-fg-muted)" }}>File: </dt><dd className="inline">{info.name}</dd></div>
          <div><dt className="inline" style={{ color: "var(--rgme-fg-muted)" }}>Size: </dt><dd className="inline">{info.size.toLocaleString()} bytes</dd></div>
          <div><dt className="inline" style={{ color: "var(--rgme-fg-muted)" }}>SHA-256: </dt><dd className="inline rgme-mono break-all" data-testid="drop-hash">{info.sha256 ?? "…"}</dd></div>
          <div><dt className="inline" style={{ color: "var(--rgme-fg-muted)" }}>Status: </dt><dd className="inline" data-testid="drop-status">{info.status}</dd></div>
        </dl>
      )}
    </section>
  );
}
