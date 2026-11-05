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
}

/**
 * Original, generic "retro 1084-style" beige colour monitor housing. It uses no third-party logos or artwork:
 * the badge reads RGME / STEREO COLOR MONITOR.
 */
export function Commodore1084sBezel({ children, powered, defaultPowered = true, onPowerChange, fullscreenTarget, className }: Commodore1084sBezelProps) {
  const root = useRef<HTMLDivElement>(null);
  const [internalOn, setInternalOn] = useState(defaultPowered);
  const desiredOn = powered ?? internalOn;
  const [state, dispatch] = useReducer(reduce, desiredOn, initialState);
  const reduced = usePrefersReducedMotion();
  const [nativeFs, setNativeFs] = useState(false);
  const [pseudoFs, setPseudoFs] = useState(false);

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
            <span className="rgme-bezel__knob" aria-hidden="true" title="Brightness (decorative)" />
            <span className="rgme-bezel__knob" aria-hidden="true" title="Contrast (decorative)" />
          </div>
        </div>
      </div>
      <svg className="rgme-bezel__foot" viewBox="0 0 200 22" role="presentation" aria-hidden="true">
        <path d="M30 0 H170 L196 20 Q198 22 194 22 H6 Q2 22 4 20 Z" />
      </svg>
    </div>
  );
}
