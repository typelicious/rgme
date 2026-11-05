import { useEffect } from "react";
import type { InputMapping } from "@rgme/core";

export function useKeyboardInput(
  press: (action: string, down: boolean) => void,
  mapping: InputMapping | undefined,
  enabled: boolean
) {
  useEffect(() => {
    if (!enabled || !mapping) return;
    const handler = (down: boolean) => (e: KeyboardEvent) => {
      const action = mapping.keyboard[e.code];
      if (!action) return;
      e.preventDefault();
      if (down && e.repeat) return;
      press(action, down);
    };
    const kd = handler(true);
    const ku = handler(false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, [press, mapping, enabled]);
}
