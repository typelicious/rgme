import { useEffect } from "react";
import type { DiskSwapper } from "../lib/m3u";

const EDITABLE = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/** 1-9 insert disk N into the swapper's drive; [ and ] go to the previous / next disk. */
export function useDiskHotkeys(swapper: DiskSwapper | undefined, enabled = true, onChange?: () => void) {
  useEffect(() => {
    if (!swapper || !enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (EDITABLE.has(t.tagName) || t.isContentEditable)) return;
      let handled = false;
      if (/^[1-9]$/.test(e.key)) handled = swapper.insertNth(Number(e.key));
      else if (e.key === "]") { swapper.next(); handled = true; }
      else if (e.key === "[") { swapper.prev(); handled = true; }
      if (handled) { e.preventDefault(); onChange?.(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [swapper, enabled, onChange]);
}
