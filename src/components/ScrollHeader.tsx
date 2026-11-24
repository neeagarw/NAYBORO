"use client";

import { useEffect, useRef } from "react";

/**
 * Instagram-style top bar. It moves with your finger: scroll down and it slides up out of view pixel by pixel,
 * scroll up and it slides back in the same way. When scrolling stops halfway, it snaps fully in or out.
 * Must be a direct child of the screen's scrolling column.
 */
export function ScrollHeader({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const show = useRef<() => void>(() => {});

  useEffect(() => {
    const bar = ref.current;
    const box = bar?.parentElement;
    if (!bar || !box) return;
    let last = box.scrollTop;
    let off = 0; // how far the bar is pushed up, 0 (shown) to its height (hidden)
    let settle: ReturnType<typeof setTimeout> | undefined;

    const apply = (animate: boolean) => {
      bar.style.transition = animate ? "transform 180ms ease-out" : "none";
      bar.style.transform = off ? `translateY(${-off}px)` : "";
    };
    const snap = () => {
      const h = bar.offsetHeight;
      off = off > h / 2 && box.scrollTop > h ? h : 0;
      apply(true);
    };
    const onScroll = () => {
      const y = Math.max(0, box.scrollTop);
      const h = bar.offsetHeight;
      off = y <= 0 ? 0 : Math.min(h, Math.max(0, off + (y - last)));
      last = y;
      apply(false);
      clearTimeout(settle);
      settle = setTimeout(snap, 140);
    };
    show.current = () => { off = 0; apply(true); };

    box.addEventListener("scroll", onScroll, { passive: true });
    return () => { box.removeEventListener("scroll", onScroll); clearTimeout(settle); };
  }, []);

  return (
    <div ref={ref} onFocusCapture={() => show.current()} className="sticky top-0 z-[3] bg-ground will-change-transform">
      {children}
    </div>
  );
}
