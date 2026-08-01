import { SkeletonCard, SkeletonTableRows } from "@/app/components/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse p-6">
      <div className="space-y-2">
        <div className="h-4 w-32 rounded bg-line" />
        <div className="h-8 w-64 rounded bg-line" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="rounded-xl border border-line bg-surface-raised p-6">
        <SkeletonTableRows rows={5} />
      </div>
    </div>
  );
}
