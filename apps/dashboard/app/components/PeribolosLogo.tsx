import Image from "next/image";
import type { SVGProps } from "react";
import PeribolosArtwork from "../../../../Peribolos_redesign/Peribolos_logo.png";

interface PeribolosLogoProps extends SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
}

/**
 * Peribolos Brand Logo Mark
 * Concept: "Peribolos" (Ancient Greek perimeter wall / protective sanctuary enclosure).
 * Features a geometric shield perimeter surrounding an interconnected vault keyhole & stylized "P".
 */
export function PeribolosLogoMark({ size = 28, className = "", ...props }: PeribolosLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      {...props}
    >
      <rect x="2.5" y="2.5" width="27" height="27" rx="8" fill="#14243C" />
      <path
        d="M9 10.5v8.8a4.7 4.7 0 0 0 4.7 4.7h1.1a5.2 5.2 0 0 0 5.2-5.2v-1.1a5.2 5.2 0 0 0-5.2-5.2H13"
        stroke="#22C980"
        strokeWidth="3.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9 21.4h5.8" stroke="#22C980" strokeWidth="3.1" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Full Brand Header Component with Logo Mark and Typography
 */
export function PeribolosLogo({ size = 26, showBadge = true }: { size?: number; showBadge?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <span
        className="relative flex shrink-0 items-center justify-center overflow-hidden border border-line bg-white shadow-[0_4px_12px_rgba(16,24,40,0.12)]"
        style={{ width: size, height: size, borderRadius: Math.max(7, Math.round(size * 0.28)) }}
      >
        <Image
          src={PeribolosArtwork}
          alt="Peribolos logo"
          fill
          sizes={`${size}px`}
          className="scale-[1.65] object-cover"
        />
      </span>
      <div className="flex items-center gap-2 font-semibold tracking-[-0.02em] text-text text-base">
        <span>Peribolos</span>
        {showBadge && (
          <span className="text-[10px] font-mono font-medium tracking-wide text-accent bg-accent-tint border border-accent/20 px-1.5 py-0.5 rounded-md">
            V2
          </span>
        )}
      </div>
    </div>
  );
}
