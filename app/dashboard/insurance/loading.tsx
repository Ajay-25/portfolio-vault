import { SkeletonTopBar, SkeletonStatCards, SkeletonTable } from "@/components/ui/skeletons";

export default function InsuranceOverviewLoading() {
  return (
    <div>
      <SkeletonTopBar />
      <div className="p-6 space-y-5">
        <SkeletonStatCards count={4} />
        <SkeletonTable rows={6} />
      </div>
    </div>
  );
}
