import {
  SkeletonTopBar,
  SkeletonSubNav,
  SkeletonStatCards,
  SkeletonTable,
} from "@/components/ui/skeletons";

export default function FixedIncomeLoading() {
  return (
    <div>
      <SkeletonTopBar />
      <SkeletonSubNav />
      <div className="p-6 space-y-5">
        <SkeletonStatCards count={3} />
        <SkeletonTable rows={5} />
      </div>
    </div>
  );
}
