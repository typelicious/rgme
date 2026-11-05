export interface GuruMeditationOverlayProps {
  error: string | null | undefined;
  onDismiss: () => void;
  minimized: boolean;
  onRestore: () => void;
}

export function GuruMeditationOverlay({
  error,
  onDismiss,
  minimized,
  onRestore
}: GuruMeditationOverlayProps) {
  if (!error) return null;

  if (minimized) {
    return (
      <button
        onClick={onRestore}
        data-testid="guru-minimized-pill"
        className="fixed bottom-6 left-6 z-40 flex items-center gap-2 px-3.5 py-2 rounded-full bg-red-950/90 border border-red-500 text-red-200 text-xs font-mono font-bold shadow-[0_4px_20px_rgba(220,38,38,0.5)] hover:scale-105 active:scale-95 transition-all cursor-pointer animate-pulse"
        title="Click to view error details"
      >
        <span className="text-red-400">⚠️</span>
        <span>Software Failure (Error)</span>
      </button>
    );
  }

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Software Failure"
      data-testid="guru-meditation-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
      onClick={onDismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-w-lg w-full bg-black border-4 border-red-600 p-6 text-center shadow-[0_0_50px_rgba(220,38,38,0.7)] animate-pulse font-mono select-none"
      >
        <div className="text-red-500 text-sm tracking-widest uppercase font-bold mb-3">
          Software Failure. Press left mouse button to continue.
        </div>
        <div className="text-red-400 text-xs tracking-wider mb-4">
          Guru Meditation #00000004.00004845
        </div>
        <div
          data-testid="runtime-error"
          className="text-red-200 text-xs bg-red-950/40 p-3.5 border border-red-800/80 rounded text-left break-words mb-5"
        >
          {error}
        </div>
        <div className="flex justify-center gap-3">
          <button
            onClick={onDismiss}
            data-testid="dismiss-guru-btn"
            className="px-5 py-2 border-2 border-red-500 bg-red-900/60 hover:bg-red-800 text-red-100 text-xs uppercase tracking-wider cursor-pointer font-bold shadow-md hover:scale-105 active:scale-95 transition-all"
          >
            Dismiss & Minimize
          </button>
        </div>
      </div>
    </div>
  );
}
