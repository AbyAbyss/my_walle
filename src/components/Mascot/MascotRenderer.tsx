import { forwardRef, useCallback, useRef } from "react";

import { useMascotHover } from "../../hooks/useMascotHover";
import type { Animation } from "../../lib/animation";
import type { Emotion } from "../../lib/emotion";
import { useWalleStore } from "../../store/walleStore";
import DuDuMascot from "./DuDuMascot";
import WalleMascot from "./WalleMascot";

const MascotRenderer = forwardRef<
  HTMLDivElement,
  { emotion: Emotion; animation: Animation; onPet: () => void }
>(function MascotRenderer({ emotion, animation, onPet }, ref) {
  const activeMascot = useWalleStore((s) => s.activeMascot);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      rootRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [ref],
  );

  useMascotHover(rootRef, animation, emotion, activeMascot);

  if (activeMascot === "dudu") {
    return <DuDuMascot ref={setRef} emotion={emotion} animation={animation} onPet={onPet} />;
  }
  return <WalleMascot ref={setRef} emotion={emotion} animation={animation} onPet={onPet} />;
});

export default MascotRenderer;
