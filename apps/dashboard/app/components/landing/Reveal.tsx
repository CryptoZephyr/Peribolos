"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tiny scroll-reveal leaf: fades and lifts children into place once they
 * cross the viewport. CSS-driven transition; prefers-reduced-motion is
 * honored globally (globals.css collapses transition-duration to ~0).
 */
export function Reveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        // Keep content visible in the server-rendered shell. The observer adds
        // the lift when hydration is available, but never hides the page.
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-100"
      } ${className}`}
    >
      {children}
    </div>
  );
}
