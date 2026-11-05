import { useEffect, useMemo, useRef, useState } from "react";

export interface PaletteAction {
  id: string;
  category: "Game" | "Runtime" | "Display" | "Floppy" | "Audio" | "Help";
  title: string;
  detail?: string;
  shortcut?: string;
  run: () => void;
}

export function CommandPalette({
  open,
  onClose,
  actions
}: {
  open: boolean;
  onClose: () => void;
  actions: PaletteAction[];
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);

      const handleWindowKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      };
      window.addEventListener("keydown", handleWindowKeyDown);
      return () => window.removeEventListener("keydown", handleWindowKeyDown);
    }
  }, [open, onClose]);

  const filtered = useMemo(() => {
    if (!query.trim()) return actions;
    const q = query.toLowerCase();
    return actions.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        (a.detail && a.detail.toLowerCase().includes(q))
    );
  }, [actions, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (filtered.length ? (i + 1) % filtered.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (filtered.length ? (i - 1 + filtered.length) % filtered.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const action = filtered[selectedIndex];
      if (action) {
        action.run();
        onClose();
      }
    }
  };

  if (!open) return null;

  return (
    <div
      className="rgme-modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "15vh",
        zIndex: 9999
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      data-testid="command-palette"
    >
      <div
        className="rgme-panel"
        style={{
          width: "560px",
          maxWidth: "92vw",
          background: "#0f131d",
          border: "1px solid var(--rgme-border-focus)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.8), 0 0 0 1px rgba(59,130,246,0.3)",
          borderRadius: "8px",
          overflow: "hidden",
          padding: 0
        }}
        onKeyDown={handleKeyDown}
      >
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--rgme-border-subtle)" }}>
          <input
            ref={inputRef}
            data-testid="command-palette-input"
            type="text"
            placeholder="Type a command or search games, runtimes, shaders… (ESC to exit)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--rgme-fg-primary)",
              fontSize: "14px",
              fontFamily: "inherit"
            }}
          />
        </div>

        <ul
          style={{
            maxHeight: "340px",
            overflowY: "auto",
            margin: 0,
            padding: "8px 0",
            listStyle: "none"
          }}
        >
          {filtered.length === 0 ? (
            <li style={{ padding: "12px 16px", color: "var(--rgme-fg-muted)", fontSize: "13px" }}>
              No commands matching "{query}"
            </li>
          ) : (
            filtered.map((action, idx) => {
              const active = idx === selectedIndex;
              return (
                <li
                  key={action.id}
                  data-testid="command-palette-item"
                  onClick={() => {
                    action.run();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    padding: "8px 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    background: active ? "rgba(59, 130, 246, 0.15)" : "transparent",
                    borderLeft: active ? "3px solid #3b82f6" : "3px solid transparent",
                    color: active ? "#ffffff" : "var(--rgme-fg-primary)"
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="rgme-badge"
                      style={{
                        fontSize: "10px",
                        padding: "2px 6px",
                        borderColor: "var(--rgme-border-subtle)",
                        color: "var(--rgme-fg-secondary)"
                      }}
                    >
                      {action.category}
                    </span>
                    <span style={{ fontSize: "13px", fontWeight: active ? 600 : 400 }}>{action.title}</span>
                    {action.detail && (
                      <span style={{ fontSize: "11px", color: "var(--rgme-fg-muted)" }}>({action.detail})</span>
                    )}
                  </div>
                  {action.shortcut && (
                    <kbd
                      className="rgme-mono"
                      style={{
                        fontSize: "10px",
                        background: "#161c2b",
                        padding: "2px 6px",
                        borderRadius: "3px",
                        border: "1px solid var(--rgme-border-subtle)"
                      }}
                    >
                      {action.shortcut}
                    </kbd>
                  )}
                </li>
              );
            })
          )}
        </ul>

        <div
          style={{
            padding: "8px 16px",
            background: "#080a11",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            fontSize: "11px",
            color: "var(--rgme-fg-muted)",
            display: "flex",
            justifyContent: "space-between"
          }}
        >
          <span>↑↓ Navigate · ↵ Select · ESC Close</span>
          <span className="rgme-mono">RGME PRO-MAX</span>
        </div>
      </div>
    </div>
  );
}
