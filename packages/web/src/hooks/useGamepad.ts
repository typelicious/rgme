import { useCallback, useEffect, useRef, useState } from "react";
import { GamepadManager, type GamepadState } from "../lib/gamepad/manager";
import { loadMapping, saveMapping, type AmigaAction, type GamepadMapping } from "../lib/gamepad/mapping";

const IDLE: GamepadState = { connected: false, name: "", physical: new Set(), autofire: false };

/** Polls navigator.getGamepads() on requestAnimationFrame while `enabled`. */
export function useGamepad(onAction: (action: AmigaAction, down: boolean, source: string) => void, enabled = true) {
  const [state, setState] = useState<GamepadState>(IDLE);
  const [mapping, setMappingState] = useState<GamepadMapping>(() => loadMapping());
  const actionRef = useRef(onAction);
  actionRef.current = onAction;
  const mgr = useRef<GamepadManager | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const m = new GamepadManager({ onAction: (a, d, s) => actionRef.current(a, d, s), onChange: setState, mapping });
    mgr.current = m;
    m.start();
    let raf = 0;
    const loop = () => { m.poll(); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); m.stop(); mgr.current = null; setState(IDLE); };
    // mapping changes are pushed via setMapping, not by recreating the manager
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const setMapping = useCallback((m: GamepadMapping) => {
    setMappingState(m);
    mgr.current?.setMapping(m);
    saveMapping(m);
  }, []);
  const rumble = useCallback((ms?: number) => mgr.current?.rumble(ms), []);

  return { connected: state.connected, name: state.name, physical: state.physical, autofire: state.autofire, mapping, setMapping, rumble };
}
