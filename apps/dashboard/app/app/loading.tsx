import { SkeletonCard, SkeletonTableRows } from "@/app/components/Skeleton";

export default function AppLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between border-b border-line pb-6">
        <div className="space-y-2">
          <div className="h-4 w-28 rounded bg-line" />
          <div className="h-7 w-56 rounded bg-line" />
        </div>
        <div className="h-9 w-36 rounded-md bg-line" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="rounded-xl border border-line bg-surface-raised p-6">
        <SkeletonTableRows rows={6} />
      </div>
    </div>
  );
}
