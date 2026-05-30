import {
  SkeletonTopBar,
  SkeletonSubNav,
  SkeletonStatCards,
  SkeletonTable,
} from "@/components/ui/skeletons";

export default function MFLoading() {
  return (
    <div>
      <SkeletonTopBar />
      <SkeletonSubNav />
      <div className="p-6 space-y-5">
        <SkeletonStatCards count={4} />
        <SkeletonTable rows={10} />
      </div>
    </div>
  );
}
