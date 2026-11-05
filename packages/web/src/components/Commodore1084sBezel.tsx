import { useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { COLLAPSE_MS, DEGAUSS_MS, WARM_MS, initialState, ledColor, reduce, usePrefersReducedMotion } from "../lib/bezel";
import "../bezel.css";

type FullscreenTarget = HTMLElement | null | (() => HTMLElement | null);

export interface Commodore1084sBezelProps {
  /** The viewport/canvas. Always stays mounted, also while the monitor is switched off. */
  children: ReactNode;
  /** Controlled power. Omit for uncontrolled mode. */
  powered?: boolean;
  /** Initial power in uncontrolled mode (default: on). */
  defaultPowered?: boolean;
  onPowerChange?: (on: boolean) => void;
  /** Element to put into fullscreen (default: the bezel itself). */
  fullscreenTarget?: FullscreenTarget;
  className?: string;
  onToggleCrt?: () => void;
  crt?: boolean;
  crtMenuContent?: ReactNode;
}

/**
 * Original, generic "retro 1084-style" beige colour monitor housing. It uses no third-party logos or artwork:
 * the badge reads RGME / STEREO COLOR MONITOR.
 */
export function Commodore1084sBezel({
  children,
  powered,
  defaultPowered = true,
  onPowerChange,
  fullscreenTarget,
  className,
  onToggleCrt,
  crt = false,
  crtMenuContent
}: Commodore1084sBezelProps) {
  const root = useRef<HTMLDivElement>(null);
  const crtMenuRef = useRef<HTMLDivElement>(null);
  const [internalOn, setInternalOn] = useState(defaultPowered);
  const desiredOn = powered ?? internalOn;
  const [state, dispatch] = useReducer(reduce, desiredOn, initialState);
  const reduced = usePrefersReducedMotion();
  const [nativeFs, setNativeFs] = useState(false);
  const [pseudoFs, setPseudoFs] = useState(false);
  const [crtMenuOpen, setCrtMenuOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (crtMenuRef.current && !crtMenuRef.current.contains(e.target as Node)) {
        setCrtMenuOpen(false);
      }
    };
    if (crtMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [crtMenuOpen]);

  // Follow the desired power (controlled or uncontrolled).
  useEffect(() => {
    dispatch({ type: desiredOn ? "POWER_ON" : "POWER_OFF" });
  }, [desiredOn]);

  // Phase timers.
  useEffect(() => {
    if (state.power !== "warming" && state.power !== "collapsing") return;
    const t = setTimeout(() => dispatch({ type: "TIMER_DONE" }), state.power === "warming" ? WARM_MS : COLLAPSE_MS);
    return () => clearTimeout(t);
  }, [state.power]);

  useEffect(() => {
    if (state.degauss !== "active") return;
    const t = setTimeout(() => dispatch({ type: "DEGAUSS_END" }), DEGAUSS_MS);
    return () => clearTimeout(t);
  }, [state.degauss]);

  const resolveTarget = useCallback((): HTMLElement | null => {
    const t = typeof fullscreenTarget === "function" ? fullscreenTarget() : fullscreenTarget;
    return t ?? root.current;
  }, [fullscreenTarget]);

  useEffect(() => {
    const onChange = () => setNativeFs(Boolean(document.fullscreenElement) && document.fullscreenElement === resolveTarget());
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [resolveTarget]);

  useEffect(() => {
    if (!pseudoFs) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPseudoFs(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pseudoFs]);

  const togglePower = () => {
    const next = !desiredOn;
    if (powered === undefined) setInternalOn(next);
    onPowerChange?.(next);
  };

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen?.();
      return;
    }
    if (pseudoFs) {
      setPseudoFs(false);
      return;
    }
    const el = resolveTarget();
    if (el && typeof el.requestFullscreen === "function") {
      try {
        await el.requestFullscreen();
        return;
      } catch {
        /* denied or unsupported in this context: use the CSS fallback below */
      }
    }
    setPseudoFs(true);
  };

  const fullscreen = nativeFs || pseudoFs;
  const led = ledColor(state.power);

  return (
    <div
      ref={root}
      className={["rgme-bezel", reduced ? "rgme-bezel--reduced" : "", pseudoFs ? "rgme-bezel--pseudo-fs" : "", className ?? ""].filter(Boolean).join(" ")}
      data-testid="bezel"
      data-power={state.power}
      data-degauss={state.degauss}
      data-fullscreen={fullscreen ? "true" : "false"}
    >
      <div className="rgme-bezel__housing">
        <div className="rgme-bezel__tube">
          <div className="rgme-bezel__screen" data-testid="bezel-screen">
            <div className="rgme-bezel__content" data-testid="bezel-content">
              {children}
            </div>
            <div className="rgme-bezel__flash" aria-hidden="true" data-testid="bezel-flash" />
            <div className="rgme-bezel__off" aria-hidden="true" data-testid="bezel-off-overlay" />
          </div>
        </div>

        <div className="rgme-bezel__panel">
          <div className="rgme-bezel__badge" aria-label="RGME stereo color monitor">
            <span className="rgme-bezel__badge-name">RGME</span>
            <span className="rgme-bezel__badge-sub">STEREO COLOR MONITOR</span>
          </div>

          <svg className="rgme-bezel__slats" viewBox="0 0 120 28" role="presentation" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => (
              <rect key={i} x={4 + i * 13} y={3} width={7} height={22} rx={3.5} />
            ))}
          </svg>

          <div className="rgme-bezel__controls">
            <span className="rgme-bezel__led" data-led={led} data-testid="bezel-led" role="img" aria-label={`Power LED ${led}`} />
            <button type="button" className="rgme-bezel__btn" data-testid="bezel-power" aria-label="Power" aria-pressed={desiredOn} onClick={togglePower}>
              Power
            </button>
            <button type="button" className="rgme-bezel__btn" data-testid="bezel-degauss" aria-label="Degauss" disabled={state.power !== "on" || state.degauss === "active"} onClick={() => dispatch({ type: "DEGAUSS_START" })}>
              Degauss
            </button>
            <button type="button" className="rgme-bezel__btn" data-testid="bezel-fullscreen" aria-label="Toggle fullscreen" aria-pressed={fullscreen} onClick={() => void toggleFullscreen()}>
              {fullscreen ? "Exit" : "Fullscreen"}
            </button>
            {/* Interactive CRT Scanlines Knob */}
            <button
              type="button"
              className="rgme-bezel__knob flex items-center justify-center cursor-pointer transition-transform hover:scale-110 active:scale-95"
              data-testid="crt-corner-trigger"
              aria-label="CRT scanlines"
              aria-pressed={crt}
              onClick={onToggleCrt}
              title={crt ? "Disable CRT Scanlines" : "Enable CRT Scanlines"}
              style={{
                background: crt
                  ? "radial-gradient(circle at 35% 30%, #4ade80, #15803d)"
                  : undefined,
                borderColor: crt ? "#22c55e" : undefined,
                boxShadow: crt ? "0 0 6px #22c55e" : undefined
              }}
            >
              <span className="text-[9px] select-none pointer-events-none" style={{ filter: crt ? "drop-shadow(0 0 2px #fff)" : "opacity(0.8)" }}>
                📺
              </span>
              <span className="sr-only">CRT scanlines</span>
            </button>

            {/* Interactive CRT Display Settings Knob with Popover popping up-left */}
            <div className="relative flex items-center justify-center h-[15px]" ref={crtMenuRef}>
              <button
                type="button"
                className="rgme-bezel__knob flex items-center justify-center cursor-pointer transition-transform hover:scale-110 active:scale-95"
                data-testid="crt-menu-toggle-btn"
                aria-label="CRT Display Settings"
                onClick={() => setCrtMenuOpen((o) => !o)}
                title="CRT Display Settings"
              >
                <span className="text-[9px] select-none pointer-events-none" style={{ opacity: 0.85 }}>
                  ⚙️
                </span>
              </button>

              {crtMenuOpen && crtMenuContent && (
                <div
                  data-testid="crt-layover-panel"
                  className="absolute bottom-8 right-0 z-50 bg-[#12141f]/95 border border-[#2b2f45] shadow-[0_12px_36px_rgba(0,0,0,0.9)] backdrop-blur-xl p-4 rounded-xl text-xs text-slate-200 w-80 animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
                    <span className="font-bold text-white uppercase tracking-wider text-[11px]">📺 CRT Display Settings</span>
                    <button
                      onClick={() => setCrtMenuOpen(false)}
                      data-testid="crt-layover-close-btn"
                      className="text-slate-400 hover:text-white text-xs cursor-pointer"
                    >
                      ✕ Close
                    </button>
                  </div>
                  {crtMenuContent}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <svg className="rgme-bezel__foot" viewBox="0 0 200 22" role="presentation" aria-hidden="true">
        <path d="M30 0 H170 L196 20 Q198 22 194 22 H6 Q2 22 4 20 Z" />
      </svg>
    </div>
  );
}
