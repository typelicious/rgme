import { useState } from "react";
import { toYaml, type GameProfile } from "@rgme/core";
import type { LibraryRecord } from "../lib/library";

export interface GameConfigModalProps {
  record: LibraryRecord | null;
  onClose: () => void;
  onSave: (recordId: string, updatedProfile: GameProfile) => Promise<void>;
}

export function GameConfigModal({ record, onClose, onSave }: GameConfigModalProps) {
  if (!record) return null;

  const [profile, setProfile] = useState<GameProfile>(() => JSON.parse(JSON.stringify(record.profile)));
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const model = profile.machine?.model ?? "A500";
  const chipset = profile.machine?.chipset ?? "OCS";
  const kickstart = profile.machine?.kickstart ?? "1.3";
  const chipKb = profile.machine?.ram?.chipKb ?? 512;
  const fastKb = profile.machine?.ram?.fastKb ?? 512;

  const yamlContent = toYaml(profile);

  const updateMachine = (patch: Partial<NonNullable<GameProfile["machine"]>>) => {
    setProfile((prev) => ({
      ...prev,
      machine: {
        ...prev.machine,
        ...patch
      }
    }));
  };

  const handleModelChange = (newModel: string) => {
    if (newModel === "A1200") {
      updateMachine({ model: "A1200", chipset: "AGA", kickstart: "3.1", ram: { chipKb: 2048, fastKb: 0 } });
    } else if (newModel === "A600") {
      updateMachine({ model: "A600", chipset: "ECS", kickstart: "3.1", ram: { chipKb: 1024, fastKb: 1024 } });
    } else if (newModel === "A500Plus") {
      updateMachine({ model: "A500Plus", chipset: "ECS", kickstart: "2.04", ram: { chipKb: 1024, fastKb: 1024 } });
    } else {
      updateMachine({ model: "A500", chipset: "OCS", kickstart: "1.3", ram: { chipKb: 512, fastKb: 512 } });
    }
  };

  const handleDownload = () => {
    const blob = new Blob([yamlContent], { type: "text/yaml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${record.title.replace(/[^a-zA-Z0-9_-]/g, "_")}-config.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(yamlContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(record.id, profile);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Game Configuration Profile"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#0f111a] border border-[#262b3d] rounded-xl shadow-2xl p-5 text-slate-200 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>⚙️</span>
              <span>Game Config & Hardware Profile</span>
            </h2>
            <div className="text-xs text-slate-400 mt-0.5">
              {record.title} · <span className="font-mono text-[11px] text-slate-500">{record.filename}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 cursor-pointer text-sm"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {/* Quick Hardware Controls */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#151926] p-3 rounded-lg border border-slate-800">
            <div>
              <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">Amiga Model</label>
              <select
                value={model}
                onChange={(e) => handleModelChange(e.target.value)}
                className="w-full bg-[#0a0c13] border border-slate-700 text-xs text-emerald-400 rounded px-2 py-1 font-mono focus:outline-none focus:border-emerald-500"
              >
                <option value="A500">A500 (OCS Standard)</option>
                <option value="A500Plus">A500+ (ECS 2MB)</option>
                <option value="A600">A600 (Gayle IDE)</option>
                <option value="A1200">A1200 (AGA)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">Target Kickstart</label>
              <select
                value={kickstart}
                onChange={(e) => updateMachine({ kickstart: e.target.value })}
                className="w-full bg-[#0a0c13] border border-slate-700 text-xs text-emerald-400 rounded px-2 py-1 font-mono focus:outline-none focus:border-emerald-500"
              >
                <option value="1.3">Kickstart 1.3 (34.005)</option>
                <option value="1.2">Kickstart 1.2 (33.180)</option>
                <option value="2.04">Kickstart 2.04 (37.175)</option>
                <option value="2.05">Kickstart 2.05 (37.299)</option>
                <option value="3.1">Kickstart 3.1 (40.063/40.068)</option>
                <option value="AROS">AROS 68k (Built-in)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">Chipset</label>
              <select
                value={chipset}
                onChange={(e) => updateMachine({ chipset: e.target.value })}
                className="w-full bg-[#0a0c13] border border-slate-700 text-xs text-slate-300 rounded px-2 py-1 font-mono focus:outline-none focus:border-slate-500"
              >
                <option value="OCS">OCS</option>
                <option value="ECS">ECS</option>
                <option value="AGA">AGA</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">Chip / Fast RAM</label>
              <select
                value={`${chipKb}/${fastKb}`}
                onChange={(e) => {
                  const [c, f] = e.target.value.split("/").map(Number);
                  updateMachine({ ram: { chipKb: c, fastKb: f } });
                }}
                className="w-full bg-[#0a0c13] border border-slate-700 text-xs text-slate-300 rounded px-2 py-1 font-mono focus:outline-none focus:border-slate-500"
              >
                <option value="512/512">512K Chip + 512K Fast (1MB)</option>
                <option value="1024/0">1MB Chip Only</option>
                <option value="1024/1024">1MB Chip + 1MB Fast (2MB)</option>
                <option value="2048/0">2MB Chip (A1200 / AGA)</option>
                <option value="2048/2048">2MB Chip + 2MB Fast (4MB)</option>
              </select>
            </div>
          </div>

          {/* YAML Live Representation */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-mono uppercase text-slate-400 flex items-center gap-1.5">
                <span>📄</span>
                <span>Generated config.yaml</span>
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs text-slate-400 hover:text-white font-mono px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 cursor-pointer"
              >
                {copied ? "✓ Copied!" : "📋 Copy YAML"}
              </button>
            </div>
            <pre className="bg-[#080a10] border border-slate-800 rounded-lg p-3 text-[11px] font-mono text-emerald-300/90 overflow-x-auto max-h-56 leading-relaxed select-all">
              {yamlContent}
            </pre>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={handleDownload}
            className="rgme-btn text-xs flex items-center gap-1.5 py-1.5 px-3"
            title="Download config.yaml to disk"
          >
            <span>⬇️</span>
            <span>Download config.yaml</span>
          </button>

          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rgme-btn text-xs py-1.5 px-3">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rgme-btn text-xs py-1.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold border-emerald-400"
            >
              {saving ? "Saving…" : "💾 Save & Apply"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
