import { SkeletonTopBar, SkeletonTable } from "@/components/ui/skeletons";

export default function HistoryLoading() {
  return (
    <div>
      <SkeletonTopBar />
      <div className="p-6 space-y-5">
        <div className="card" style={{ padding: "24px" }}>
          <div className="skeleton skeleton-text" style={{ width: 160, marginBottom: 20 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i}>
                <div className="skeleton skeleton-text" style={{ width: "60%", marginBottom: 8 }} />
                <div className="skeleton skeleton-row" />
              </div>
            ))}
          </div>
        </div>
        <SkeletonTable rows={6} />
        <SkeletonTable rows={6} />
      </div>
    </div>
  );
}
