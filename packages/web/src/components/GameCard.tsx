import { useState } from "react";
import type { RetroGameMetadata, RetroGameVersion } from "@rgme/core";

export interface GameCardProps {
  game: RetroGameMetadata;
  isBookmarked?: boolean;
  onToggleBookmark?: (game: RetroGameMetadata) => void;
  onStreamAndMount: (game: RetroGameMetadata, version: RetroGameVersion) => void;
  isStreaming?: boolean;
}

export function GameCard({
  game,
  isBookmarked = false,
  onToggleBookmark,
  onStreamAndMount,
  isStreaming = false
}: GameCardProps) {
  const [selectedVersion, setSelectedVersion] = useState<RetroGameVersion>(game.defaultVersion);

  return (
    <div
      className="rgme-panel flex flex-col justify-between p-3 rounded-lg border transition-all duration-200 hover:border-sky-500/60 hover:shadow-lg group"
      style={{
        backgroundColor: "var(--rgme-bg-panel, #15161e)",
        borderColor: isBookmarked ? "rgba(56, 189, 248, 0.4)" : "var(--rgme-border, #2d3139)"
      }}
      data-testid={`game-card-${game.id}`}
    >
      {/* Header Tags */}
      <div>
        <div className="flex items-center justify-between gap-1 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-950/80 text-sky-400 border border-sky-600/40">
              {game.genre}
            </span>
            {game.totalDisks && game.totalDisks > 1 && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-600/40">
                {game.totalDisks} Disks
              </span>
            )}
          </div>
          {onToggleBookmark && (
            <button
              className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
                isBookmarked
                  ? "bg-sky-500/20 text-sky-300 border border-sky-400/50"
                  : "text-slate-400 hover:text-sky-300 bg-slate-800/40"
              }`}
              onClick={() => onToggleBookmark(game)}
              title={isBookmarked ? "Remove from My Library" : "Bookmark into My Library"}
              aria-label={isBookmarked ? "Remove bookmark" : "Bookmark"}
            >
              {isBookmarked ? "★" : "☆"}
            </button>
          )}
        </div>

        {/* Title & Metadata */}
        <h3 className="text-sm font-bold text-slate-100 group-hover:text-sky-300 transition-colors line-clamp-2 mb-1" title={game.canonicalTitle}>
          {game.canonicalTitle}
        </h3>
        <p className="text-xs text-slate-400 mb-3">
          {game.studio ? `${game.studio} • ` : ""}
          {game.year ?? "Classic"} • <span className="text-slate-500">{game.sourceTitle}</span>
        </p>
      </div>

      {/* Version Selector (if multiple) & Action Buttons */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/60">
        {game.versions.length > 1 && (
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] text-slate-400 whitespace-nowrap">Link / Disk:</label>
            <select
              className="rgme-input text-[11px] p-1 rounded bg-[#101116] border border-slate-700 text-slate-200 flex-1 truncate"
              value={selectedVersion.filename}
              onChange={(e) => {
                const found = game.versions.find((v) => v.filename === e.target.value);
                if (found) setSelectedVersion(found);
              }}
              data-testid="version-select"
            >
              {game.versions.map((v) => (
                <option key={v.filename} value={v.filename}>
                  {v.label} ({v.format.toUpperCase()})
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          className="rgme-btn flex items-center justify-center gap-1 w-full text-[11px] py-1 font-medium"
          onClick={() => onStreamAndMount(game, selectedVersion)}
          disabled={isStreaming}
          title="Stream & Mount DF0:"
          aria-label="Stream & Mount DF0:"
        >
          <span>▶</span>
          <span>{isStreaming ? "Loading..." : "Play"}</span>
        </button>
      </div>
    </div>
  );
}
