import { PeribolosLogoAvatar } from "@/app/components/PeribolosLogo";

export function LandingBrand() {
  return (
    <span className="flex items-center gap-2.5 select-none">
      <PeribolosLogoAvatar size={36} priority />
      <span className="text-base font-semibold tracking-[-0.03em] text-text">
        Peribolos
      </span>
    </span>
  );
}
