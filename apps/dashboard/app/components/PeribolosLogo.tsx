import type { SVGProps } from "react";

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
      <defs>
        {/* Emerald accent gradient */}
        <linearGradient id="p-shield-grad" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>

        {/* Inner vault lock gradient */}
        <linearGradient id="p-core-grad" x1="10" y1="8" x2="22" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#a7f3d0" />
        </linearGradient>

        {/* Ambient glow filter */}
        <filter id="p-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#34d399" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* Outer Hexagonal Protective Shield / Perimeter Wall */}
      <path
        d="M16 2.5L28.5 7.5V16.5C28.5 23.5 23 27.8 16 30C9 27.8 3.5 23.5 3.5 16.5V7.5L16 2.5Z"
        fill="#131316"
        stroke="url(#p-shield-grad)"
        strokeWidth="2"
        strokeLinejoin="round"
        filter="url(#p-glow)"
      />

      {/* Inner Circuit Node Lines */}
      <path
        d="M16 6V9.5M8.5 10.5L11.5 12.5M23.5 10.5L20.5 12.5"
        stroke="#34d399"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeOpacity="0.6"
      />

      {/* Stylized Vault "P" & Keyhole Lock Monogram */}
      <path
        d="M11 10.5H17C19.5 10.5 21.2 12.1 21.2 14.5C21.2 16.9 19.5 18.5 17 18.5H14.2V23"
        stroke="url(#p-core-grad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Agent Vault Core Node */}
      <circle cx="14.2" cy="14.5" r="1.8" fill="#34d399" />
    </svg>
  );
}

/**
 * Full Brand Header Component with Logo Mark and Typography
 */
export function PeribolosLogo({ size = 26, showBadge = true }: { size?: number; showBadge?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <PeribolosLogoMark size={size} />
      <div className="flex items-center gap-2 font-bold tracking-tight text-text text-base">
        <span>Peribolos</span>
        {showBadge && (
          <span className="text-[10px] font-mono font-medium tracking-wide text-accent bg-accent-tint border border-accent/20 px-1.5 py-0.5 rounded">
            V2
          </span>
        )}
      </div>
    </div>
  );
}
