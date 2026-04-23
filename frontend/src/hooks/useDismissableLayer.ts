import { RefObject, useEffect, useRef } from "react";

type UseDismissableLayerOptions = {
  enabled: boolean;
  refs: Array<RefObject<HTMLElement | null>>;
  onDismiss: () => void;
  pointerEvent?: "pointerdown" | "mousedown";
};

export function useDismissableLayer({
  enabled,
  refs,
  onDismiss,
  pointerEvent = "pointerdown"
}: UseDismissableLayerOptions) {
  const refsRef = useRef(refs);
  refsRef.current = refs;
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!enabled) return;

    function onPointerDown(event: PointerEvent | MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;

      const isInsideSomeRef = refsRef.current.some((ref) => ref.current?.contains(target));
      if (!isInsideSomeRef) {
        onDismissRef.current();
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onDismissRef.current();
      }
    }

    document.addEventListener(pointerEvent, onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener(pointerEvent, onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [enabled, pointerEvent]);
}
