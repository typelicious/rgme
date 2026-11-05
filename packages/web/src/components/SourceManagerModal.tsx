import { useState } from "react";
import {
  ArchiveSourceStore,
  type ArchiveSource,
  ArchiveOrgConnector
} from "@rgme/core";

export interface SourceManagerModalProps {
  open: boolean;
  onClose: () => void;
  sourceStore: ArchiveSourceStore;
  onSourcesChanged?: () => void;
  connector?: ArchiveOrgConnector;
}

const defaultConnector = new ArchiveOrgConnector();

export function SourceManagerModal({
  open,
  onClose,
  sourceStore,
  onSourcesChanged,
  connector = defaultConnector
}: SourceManagerModalProps) {
  const [sources, setSources] = useState<ArchiveSource[]>(() => sourceStore.getSources());
  const [newId, setNewId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [testing, setTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const refreshList = () => {
    const list = sourceStore.getSources();
    setSources(list);
    onSourcesChanged?.();
  };

  const handleAddSource = async () => {
    const cleanId = newId.trim().replace(/^https?:\/\/archive\.org\/(details|download)\//i, "").split("/")[0]!;
    if (!cleanId) {
      setError("Please enter a valid Archive.org collection identifier or URL.");
      return;
    }

    setTesting(true);
    setError(null);
    setStatusMessage(`Verifying "${cleanId}" on Archive.org...`);

    try {
      const meta = await connector.fetchMetadata(cleanId);
      const title = newTitle.trim() || meta.title || cleanId;
      sourceStore.addSource({
        id: cleanId,
        title,
        description: meta.description || `Archive.org retro collection with ${meta.files.length} items`,
        url: `https://archive.org/details/${cleanId}`,
        itemCount: meta.files.length
      });
      setNewId("");
      setNewTitle("");
      setStatusMessage(`Successfully added "${title}" (${meta.files.length} retro media items)!`);
      refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatusMessage(null);
    } finally {
      setTesting(false);
    }
  };

  const handleRemoveSource = (id: string) => {
    sourceStore.removeSource(id);
    refreshList();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Manage Archive.org Sources"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="rgme-panel flex flex-col w-full max-w-xl max-h-[85vh] rounded-lg shadow-2xl overflow-hidden"
        style={{
          backgroundColor: "var(--rgme-bg-panel, #15161e)",
          border: "1px solid var(--rgme-border, #2d3139)",
          color: "var(--rgme-fg-primary, #e2e8f0)"
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--rgme-border,#2d3139)]">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚙️</span>
            <div>
              <h2 className="text-lg font-bold">Manage Archive.org Sources</h2>
              <p className="text-xs text-[var(--rgme-fg-muted,#94a3b8)]">
                Connect and discover historical retro software collections
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rgme-btn" style={{ padding: "4px 8px", fontSize: "14px" }} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {/* Add New Source Section */}
          <div className="p-3 rounded border border-slate-800 bg-[#101116] flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-sky-400">Add New Archive.org Collection</h3>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Identifier or URL (e.g. tosec-amiga)"
                className="rgme-input flex-1 p-2 text-xs rounded bg-[#161822] border border-slate-700 text-white"
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
              />
              <input
                type="text"
                placeholder="Custom Title (optional)"
                className="rgme-input flex-1 p-2 text-xs rounded bg-[#161822] border border-slate-700 text-white"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <button
                className="rgme-btn text-xs whitespace-nowrap px-3"
                onClick={() => void handleAddSource()}
                disabled={testing || !newId.trim()}
              >
                {testing ? "Testing..." : "+ Add Source"}
              </button>
            </div>
            {statusMessage && (
              <div className="text-xs text-sky-400 bg-sky-950/40 p-2 rounded border border-sky-800">
                ✓ {statusMessage}
              </div>
            )}
            {error && (
              <div className="text-xs text-red-300 bg-red-950/40 p-2 rounded border border-red-800">
                ⚠️ {error}
              </div>
            )}
          </div>

          {/* Sources List */}
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-slate-300">Connected Sources ({sources.length})</h3>
            {sources.map((src) => (
              <div
                key={src.id}
                className="flex items-center justify-between p-3 rounded border border-slate-800 bg-[#13141c] hover:border-slate-700 transition-colors gap-3"
              >
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold truncate text-slate-100">{src.title}</span>
                    {src.isDefault && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        Built-in
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 truncate">{src.description}</span>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 font-mono">
                    <span>ID: {src.id}</span>
                    {src.itemCount !== undefined && <span>• {src.itemCount} items</span>}
                  </div>
                </div>

                {!src.isDefault && (
                  <button
                    className="rgme-btn text-[11px] text-red-400 hover:text-red-300 px-2 py-1"
                    onClick={() => handleRemoveSource(src.id)}
                    title="Remove collection"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[var(--rgme-border,#2d3139)] text-xs text-slate-400 flex items-center justify-between bg-[#101116]">
          <span>⚖️ Ephemeral memory: Zero local storage, zero server hosting.</span>
          <button className="rgme-btn text-xs px-3 py-1" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
