import { useEffect } from "react";

export function KeyboardShortcutsModal({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  const shortcuts = [
    { key: "Cmd+K / /", desc: "Open Command Palette (quick search across all features)" },
    { key: "?", desc: "Open / close this Keyboard Shortcuts dialog" },
    { key: "1 – 9", desc: "Quick-swap to Disk 1..9 in multi-disk playlist" },
    { key: "Arrow Keys", desc: "Virtual Amiga D-Pad (Up, Down, Left, Right)" },
    { key: "Space / Enter", desc: "Virtual Amiga Joystick Fire button" },
    { key: "C", desc: "Cycle CRT Shader preset (Clean → 1084S → Trinitron → Arcade)" },
    { key: "F", desc: "Toggle monitor bezel fullscreen mode" },
    { key: "M", desc: "Toggle audio mute (synthesizer and floppy sounds)" },
    { key: "Escape", desc: "Dismiss open modals or overlay panels" }
  ];

  return (
    <div
      className="rgme-modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      data-testid="shortcuts-modal"
    >
      <div
        className="rgme-panel"
        style={{
          width: "520px",
          maxWidth: "92vw",
          background: "#0f131d",
          border: "1px solid var(--rgme-border-focus)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.8)",
          borderRadius: "8px",
          padding: "20px"
        }}
      >
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-base font-bold" style={{ color: "var(--rgme-fg-primary)" }}>
            ⌨ Keyboard Shortcuts
          </h3>
          <button
            className="rgme-btn"
            onClick={onClose}
            aria-label="Close shortcuts"
            style={{ padding: "2px 8px", fontSize: "12px" }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: "grid", gap: "8px" }}>
          {shortcuts.map((s, idx) => (
            <div
              key={idx}
              className="flex justify-between items-center py-1"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
            >
              <kbd
                className="rgme-mono"
                style={{
                  fontSize: "12px",
                  background: "#161c2b",
                  color: "#38bdf8",
                  padding: "3px 8px",
                  borderRadius: "4px",
                  border: "1px solid var(--rgme-border-subtle)"
                }}
              >
                {s.key}
              </kbd>
              <span style={{ fontSize: "12px", color: "var(--rgme-fg-secondary)", textAlign: "right" }}>
                {s.desc}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-2 flex justify-between items-center text-xs text-muted" style={{ borderTop: "1px solid var(--rgme-border-subtle)" }}>
          <span>Press <kbd className="rgme-mono">?</kbd> anywhere to toggle</span>
          <button className="rgme-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
