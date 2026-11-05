import { useState, useRef, useEffect, type MouseEvent } from "react";

export interface FloatingRemoteControlProps {
  activeInputs: ReadonlySet<string>;
  press: (action: string, down: boolean) => void;
  minimized: boolean;
  onToggleMinimize: () => void;
  onOpenRemap?: () => void;
}

export function FloatingRemoteControl({
  activeInputs,
  press,
  minimized,
  onToggleMinimize,
  onOpenRemap
}: FloatingRemoteControlProps) {
  // Draggable position state
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const startDrag = (e: MouseEvent<HTMLDivElement>) => {
    // Only drag from header handle
    isDragging.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  useEffect(() => {
    const onMouseMove = (e: globalThis.MouseEvent) => {
      if (!isDragging.current) return;
      const x = Math.max(10, Math.min(window.innerWidth - 220, e.clientX - dragOffset.current.x));
      const y = Math.max(10, Math.min(window.innerHeight - 180, e.clientY - dragOffset.current.y));
      setPos({ x, y });
    };

    const onMouseUp = () => {
      isDragging.current = false;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  if (minimized) {
    return (
      <button
        onClick={onToggleMinimize}
        data-testid="remote-minimized-pill"
        className="fixed bottom-6 right-[130px] z-50 flex items-center gap-1.5 px-3 py-2.5 rounded-full bg-[#161822]/95 hover:bg-[#202334] border border-[#38bdf8]/60 text-sky-200 hover:text-white shadow-[0_8px_32px_rgba(0,0,0,0.8)] backdrop-blur-md font-mono text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer group"
        title="Show Remote Controller"
      >
        <span className="text-base group-hover:scale-110 transition-transform">🎮</span>
        <span className="text-[11px] uppercase tracking-wider font-semibold">Remote</span>
      </button>
    );
  }

  const dpadBtn = (action: string, icon: string, label: string) => {
    const active = activeInputs.has(action);
    return (
      <button
        type="button"
        data-testid={`hud-${action}`}
        data-active={active ? "true" : "false"}
        aria-label={label}
        className={`w-8 h-8 rounded flex items-center justify-center font-bold text-xs select-none transition-all cursor-pointer ${
          active
            ? "bg-[#38bdf8] text-black shadow-[0_0_10px_#38bdf8] scale-95"
            : "bg-[#1f2434] hover:bg-[#2c3349] text-white border border-[#3b435c]"
        }`}
        onPointerDown={() => press(action, true)}
        onPointerUp={() => press(action, false)}
        onPointerLeave={() => press(action, false)}
      >
        {icon}
      </button>
    );
  };

  const actionBtn = (action: string, label: string) => {
    const active = activeInputs.has(action);
    return (
      <button
        type="button"
        data-testid={`hud-${action}`}
        data-active={active ? "true" : "false"}
        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs select-none transition-all cursor-pointer ${
          active
            ? "bg-red-500 text-white shadow-[0_0_12px_#ef4444] scale-95"
            : "bg-red-950/80 hover:bg-red-900 border border-red-700/80 text-red-200"
        }`}
        onPointerDown={() => press(action, true)}
        onPointerUp={() => press(action, false)}
        onPointerLeave={() => press(action, false)}
      >
        {label}
      </button>
    );
  };

  const style = pos
    ? { left: `${pos.x}px`, top: `${pos.y}px` }
    : undefined;

  return (
    <div
      data-testid="floating-remote-control"
      style={style}
      className={`${
        pos ? "fixed" : "fixed bottom-24 right-6"
      } z-40 bg-[#13141c]/95 border border-[#2e3346] shadow-[0_12px_40px_rgba(0,0,0,0.85)] backdrop-blur-xl rounded-2xl p-3 flex flex-col gap-2 select-none`}
    >
      {/* Drag handle header */}
      <div
        onMouseDown={startDrag}
        className="flex items-center justify-between cursor-move pb-1 border-b border-[#232734] px-1 text-[11px] font-mono text-[#94a3b8]"
      >
        <span className="flex items-center gap-1.5 font-bold text-white tracking-wider">
          <span>🎮</span> REMOTE
        </span>
        <div className="flex items-center gap-1.5">
          {onOpenRemap && (
            <button
              onClick={onOpenRemap}
              className="hover:text-sky-300 text-[10px] px-1"
              title="Gamepad Mapping"
            >
              ⚙
            </button>
          )}
          <button
            onClick={onToggleMinimize}
            data-testid="minimize-remote-btn"
            className="hover:text-red-400 text-xs px-1 font-bold"
            title="Minimize to bottom right"
          >
            ─
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 pt-1">
        {/* D-Pad Matrix */}
        <div className="grid grid-cols-3 gap-1 w-26 h-26 place-items-center bg-[#0c0d13] p-1.5 rounded-xl border border-[#1e2332]">
          <div />
          {dpadBtn("up", "▲", "Up")}
          <div />
          {dpadBtn("left", "◄", "Left")}
          <div className="w-4 h-4 rounded-full bg-[#1e2332]" />
          {dpadBtn("right", "►", "Right")}
          <div />
          {dpadBtn("down", "▼", "Down")}
          <div />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 justify-center pl-1">
          {actionBtn("fire", "1")}
          {actionBtn("fire2", "2")}
        </div>
      </div>
    </div>
  );
}
