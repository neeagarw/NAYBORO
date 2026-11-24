"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Instagram-style top bar: slides away while you scroll down and slides back as soon as you scroll up.
 * Must be a direct child of the screen's scrolling column.
 */
export function ScrollHeader({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const bar = ref.current;
    const box = bar?.parentElement;
    if (!bar || !box) return;
    let last = box.scrollTop;
    const onScroll = () => {
      const y = box.scrollTop;
      const moved = y - last;
      if (Math.abs(moved) < 6 && y > 0) return; // ignore tiny jitters
      setHidden(moved > 0 && y > bar.offsetHeight);
      last = y;
    };
    box.addEventListener("scroll", onScroll, { passive: true });
    return () => box.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div ref={ref} onFocusCapture={() => setHidden(false)}
      className={`sticky top-0 z-[3] bg-ground transition-transform duration-200 ease-out motion-reduce:transition-none ${hidden ? "-translate-y-full" : ""}`}>
      {children}
    </div>
  );
}
