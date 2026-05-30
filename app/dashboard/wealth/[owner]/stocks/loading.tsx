import {
  SkeletonTopBar,
  SkeletonSubNav,
  SkeletonStatCards,
  SkeletonTable,
} from "@/components/ui/skeletons";

export default function StocksLoading() {
  return (
    <div>
      <SkeletonTopBar />
      <SkeletonSubNav />
      <div className="p-6 space-y-5">
        <SkeletonStatCards count={3} />
        <div style={{ display: "flex", gap: 8 }}>
          {[80, 90].map((w, i) => (
            <div key={i} className="skeleton" style={{ width: w, height: 36, borderRadius: 8 }} />
          ))}
        </div>
        <SkeletonTable rows={9} />
      </div>
    </div>
  );
}
