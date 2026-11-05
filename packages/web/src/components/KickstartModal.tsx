import { useState, useEffect, useCallback, type DragEvent, type ChangeEvent } from "react";
import {
  KickstartRomStore,
  type KickstartRomMeta,
  BUILTIN_AROS_META,
  KNOWN_COMMODORE_ROMS
} from "@rgme/core";

export interface KickstartModalProps {
  open: boolean;
  onClose: () => void;
  store: KickstartRomStore;
  onRomChanged?: (meta: KickstartRomMeta) => void;
}

export function KickstartModal({ open, onClose, store, onRomChanged }: KickstartModalProps) {
  const [roms, setRoms] = useState<KickstartRomMeta[]>([BUILTIN_AROS_META]);
  const [activeId, setActiveId] = useState<string>(store.getActiveRomId());
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const refreshRoms = useCallback(async () => {
    const list = await store.listRoms();
    setRoms(list);
    setActiveId(store.getActiveRomId());
  }, [store]);

  useEffect(() => {
    if (open) {
      void refreshRoms();
    }
  }, [open, refreshRoms]);

  const handleSelect = (rom: KickstartRomMeta) => {
    store.setActiveRomId(rom.id);
    setActiveId(rom.id);
    onRomChanged?.(rom);
  };

  const processFile = async (file: File) => {
    setIsUploading(true);
    setStatusMessage(null);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const sha256 = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      const meta = await store.registerRom(bytes, sha256, file.name);
      await refreshRoms();
      onRomChanged?.(meta);
      setStatusMessage(`Successfully registered ${meta.name}`);
    } catch (err) {
      setStatusMessage(`Error importing ROM: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      void processFile(e.dataTransfer.files[0]!);
    }
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void processFile(e.target.files[0]!);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Kickstart ROM Management"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-xl rounded-xl border border-[#232734] bg-[#13141c] shadow-2xl p-6 text-sm font-sans flex flex-col gap-4 text-[#e2e8f0]">
        <div className="flex items-center justify-between border-b border-[#232734] pb-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="text-emerald-400">⚡</span> Kickstart ROM Management
            </h2>
            <p className="text-xs text-[#94a3b8]">
              Configure Kickstart ROM for WebAssembly Amiga 68000 execution.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#94a3b8] hover:text-white px-2 py-1 rounded hover:bg-[#1f2937]"
            data-testid="close-rom-modal"
          >
            ✕
          </button>
        </div>

        {/* ROM List */}
        <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
          {roms.map((rom) => {
            const isSelected = rom.id === activeId;
            return (
              <div
                key={rom.id}
                onClick={() => handleSelect(rom)}
                data-testid={`rom-item-${rom.id}`}
                className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? "border-emerald-500/80 bg-emerald-950/20"
                    : "border-[#232734] bg-[#181a24] hover:border-[#38bdf8]/50"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{rom.name}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                        rom.builtIn
                          ? "bg-emerald-900/60 text-emerald-300 border border-emerald-700/50"
                          : "bg-blue-900/60 text-blue-300 border border-blue-700/50"
                      }`}
                    >
                      {rom.builtIn ? "Built-in Clean" : "BYOR (Custom)"}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-[#94a3b8] mt-1">
                    SHA-256: {rom.sha256.slice(0, 16)}… • Size: {(rom.size / 1024).toFixed(0)} KB
                  </div>
                </div>
                {isSelected ? (
                  <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1">
                    ✓ ACTIVE
                  </span>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(rom);
                    }}
                    className="rgme-btn text-xs px-2 py-1"
                  >
                    Select
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Drop Target */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed border-[#2b3042] hover:border-[#38bdf8] rounded-lg p-5 text-center bg-[#161822] cursor-pointer transition-colors"
          data-testid="rom-dropzone"
        >
          <input
            type="file"
            id="rom-file-input"
            className="hidden"
            accept=".rom,.bin"
            onChange={handleFileInput}
          />
          <label htmlFor="rom-file-input" className="cursor-pointer flex flex-col items-center gap-1">
            <span className="text-xl">📁</span>
            <span className="font-semibold text-white">
              {isUploading ? "Importing ROM…" : "Drop a Kickstart ROM (.rom / .bin) here"}
            </span>
            <span className="text-xs text-[#94a3b8]">
              Supports Kickstart 1.2, 1.3, 2.04, 3.1. Stored locally in your browser.
            </span>
          </label>
        </div>

        {statusMessage && (
          <div className="text-xs font-mono p-2 rounded bg-[#1e293b] text-[#38bdf8] border border-[#38bdf8]/30">
            {statusMessage}
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-[#232734]">
          <button
            onClick={onClose}
            className="rgme-btn px-4 py-1.5"
            data-testid="close-rom-modal-btn"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
