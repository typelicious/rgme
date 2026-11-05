import { useState, useMemo, useEffect } from "react";
import {
  ArchiveOrgConnector,
  ARCHIVE_COLLECTION_PRESETS,
  type ArchiveOrgFile,
  type StreamedRetroMedia
} from "@rgme/core";

export interface CloudStreamModalProps {
  open: boolean;
  onClose: () => void;
  onMountMedia: (media: StreamedRetroMedia) => Promise<void>;
  connector?: ArchiveOrgConnector;
}

export function CloudStreamModal({
  open,
  onClose,
  onMountMedia,
  connector = new ArchiveOrgConnector()
}: CloudStreamModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<string>(ARCHIVE_COLLECTION_PRESETS[0]!.id);
  const [customInput, setCustomInput] = useState<string>("");
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [streamingName, setStreamingName] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collectionTitle, setCollectionTitle] = useState<string>("");
  const [files, setFiles] = useState<ArchiveOrgFile[]>([]);
  const [filterQuery, setFilterQuery] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const activeIdentifier = isCustom ? customInput.trim() : selectedPreset;

  const handleFetchFiles = async (idToFetch = activeIdentifier) => {
    if (!idToFetch) return;
    setLoading(true);
    setError(null);
    try {
      const meta = await connector.fetchMetadata(idToFetch);
      setCollectionTitle(meta.title);
      setFiles(meta.files);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredFiles = useMemo(() => {
    if (!filterQuery) return files;
    const q = filterQuery.toLowerCase();
    return files.filter((f) => f.name.toLowerCase().includes(q));
  }, [files, filterQuery]);

  const handleStreamAndMount = async (file: ArchiveOrgFile) => {
    setStreamingName(file.name);
    setStreamStatus(`Connecting to Archive.org for "${file.name}"...`);
    setError(null);
    try {
      const media = await connector.streamFile(activeIdentifier, file.name, (ev) => {
        setStreamStatus(ev.message);
      });
      setStreamStatus(`Mounting ${media.diskFilename} into DF0:...`);
      await onMountMedia(media);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStreamingName(null);
      setStreamStatus(null);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Stream from Archive.org"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="rgme-panel flex flex-col w-full max-w-2xl max-h-[85vh] rounded-lg shadow-2xl overflow-hidden"
        style={{
          backgroundColor: "var(--rgme-bg-panel, #15161e)",
          border: "1px solid var(--rgme-border, #2d3139)",
          color: "var(--rgme-fg-primary, #e2e8f0)"
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--rgme-border,#2d3139)]">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌐</span>
            <div>
              <h2 className="text-lg font-bold">Stream from Archive.org</h2>
              <p className="text-xs text-[var(--rgme-fg-muted,#94a3b8)]">
                Zero-Hosting Ephemeral In-Memory Streaming & DF0: Mount
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rgme-btn"
            style={{ padding: "4px 8px", fontSize: "14px" }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Source Selector */}
        <div className="p-4 border-b border-[var(--rgme-border,#2d3139)] flex flex-col gap-3">
          <div className="flex gap-2">
            <button
              className={`rgme-btn flex-1 text-xs ${!isCustom ? "border-[var(--rgme-accent,#38bdf8)]" : ""}`}
              onClick={() => {
                setIsCustom(false);
                setError(null);
              }}
            >
              Curated Collections
            </button>
            <button
              className={`rgme-btn flex-1 text-xs ${isCustom ? "border-[var(--rgme-accent,#38bdf8)]" : ""}`}
              onClick={() => {
                setIsCustom(true);
                setError(null);
              }}
            >
              Custom Identifier / URL
            </button>
          </div>

          {!isCustom ? (
            <div className="flex gap-2">
              <select
                className="rgme-input flex-1 p-2 text-sm rounded bg-[#101116] border border-[#2d3139] text-white"
                value={selectedPreset}
                onChange={(e) => {
                  setSelectedPreset(e.target.value);
                  setError(null);
                  void handleFetchFiles(e.target.value);
                }}
              >
                {ARCHIVE_COLLECTION_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.id})
                  </option>
                ))}
              </select>
              <button
                className="rgme-btn text-sm"
                onClick={() => void handleFetchFiles(selectedPreset)}
                disabled={loading || streamingName !== null}
              >
                {loading ? "Loading..." : "Query Files"}
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                className="rgme-input flex-1 p-2 text-sm rounded bg-[#101116] border border-[#2d3139] text-white"
                placeholder="e.g. Amiga-Arquivista or https://archive.org/details/..."
                value={customInput}
                onChange={(e) => {
                  setCustomInput(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleFetchFiles();
                }}
              />
              <button
                className="rgme-btn text-sm"
                onClick={() => void handleFetchFiles()}
                disabled={loading || !customInput.trim() || streamingName !== null}
              >
                {loading ? "Loading..." : "Query"}
              </button>
            </div>
          )}

          {/* Active Streaming Progress Banner */}
          {streamStatus && (
            <div className="flex items-center gap-2 text-xs p-2.5 rounded bg-sky-950/50 border border-sky-600 text-sky-200 animate-pulse">
              <span className="inline-block animate-spin">⏳</span>
              <span className="font-mono">{streamStatus}</span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div
              className="text-xs p-2.5 rounded bg-red-950/60 border border-red-700 text-red-200 flex flex-col gap-1"
              role="alert"
            >
              <div className="flex items-center justify-between font-semibold">
                <span>⚠️ Stream Error</span>
                <button
                  className="text-[10px] text-red-400 hover:text-red-200 underline"
                  onClick={() => setError(null)}
                >
                  Dismiss
                </button>
              </div>
              <div className="break-words">{error}</div>
            </div>
          )}
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 min-h-[220px]">
          {collectionTitle && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[var(--rgme-fg-muted,#94a3b8)]">
                Found {files.length} retro media items in <strong>{collectionTitle}</strong>
              </span>
              {files.length > 0 && (
                <input
                  type="text"
                  placeholder="Filter by title..."
                  className="rgme-input p-1 px-2 text-xs rounded bg-[#101116] border border-[#2d3139] text-white w-48"
                  value={filterQuery}
                  onChange={(e) => {
                    setFilterQuery(e.target.value);
                    setError(null);
                  }}
                />
              )}
            </div>
          )}

          {files.length === 0 && !loading && !error && (
            <div className="flex flex-col items-center justify-center p-8 text-center text-sm text-[var(--rgme-fg-muted,#94a3b8)]">
              <span>Select a preset or enter an Archive.org identifier, then click "Query Files".</span>
            </div>
          )}

          {filteredFiles.map((file) => (
            <div
              key={file.name}
              className="flex items-center justify-between p-2 rounded border border-[var(--rgme-border,#2d3139)] hover:bg-[#1a1d26] transition-colors gap-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-[#202430] text-[#38bdf8] border border-[#38bdf8]/30">
                  {file.name.split(".").pop()?.toUpperCase() ?? "FILE"}
                </span>
                <span className="text-sm truncate" title={file.name}>
                  {file.name}
                </span>
                {file.size && (
                  <span className="text-xs text-[var(--rgme-fg-muted,#94a3b8)]">
                    ({Math.round(file.size / 1024)} KB)
                  </span>
                )}
              </div>
              <button
                className="rgme-btn whitespace-nowrap"
                style={{ fontSize: "11px", padding: "3px 8px" }}
                onClick={() => void handleStreamAndMount(file)}
                disabled={streamingName !== null}
              >
                {streamingName === file.name ? "Streaming..." : "Stream & Mount DF0:"}
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[var(--rgme-border,#2d3139)] text-xs text-[var(--rgme-fg-muted,#94a3b8)] flex items-center justify-between bg-[#101116]">
          <span>⚖️ Ephemeral memory: Zero local storage, zero server hosting.</span>
          <button className="rgme-btn" onClick={onClose} style={{ fontSize: "11px", padding: "4px 8px" }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
