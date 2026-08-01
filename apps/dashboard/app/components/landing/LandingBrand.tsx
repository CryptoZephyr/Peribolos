import Image from "next/image";
import PeribolosArtwork from "../../../../../Peribolos_redesign/Peribolos_logo.png";

export function LandingBrand() {
  return (
    <span className="flex items-center gap-2.5 select-none">
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[11px] border border-line bg-white shadow-[0_4px_12px_rgba(16,24,40,0.12)]">
        <Image
          src={PeribolosArtwork}
          alt="Peribolos logo"
          fill
          sizes="36px"
          className="scale-[1.65] object-cover"
          priority
        />
      </span>
      <span className="text-base font-semibold tracking-[-0.03em] text-text">
        Peribolos
      </span>
    </span>
  );
}
