import Image from "next/image";
import PeribolosArtwork from "../../../../Peribolos_redesign/Peribolos_logo.png";

export function PeribolosLogoAvatar({
  size = 28,
  className = "",
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden border border-line bg-white shadow-[0_4px_12px_rgba(16,24,40,0.12)] ${className}`}
      style={{ width: size, height: size, borderRadius: Math.max(7, Math.round(size * 0.28)) }}
    >
      <Image
        src={PeribolosArtwork}
        alt="Peribolos logo"
        fill
        sizes={`${size}px`}
        className="scale-[1.65] object-cover"
        priority={priority}
      />
    </span>
  );
}

/**
 * Full Brand Header Component with Logo Mark and Typography
 */
export function PeribolosLogo({ size = 26, showBadge = true }: { size?: number; showBadge?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <PeribolosLogoAvatar size={size} priority />
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
