import {
  SkeletonTopBar,
  SkeletonSubNav,
  SkeletonStatCards,
  SkeletonTable,
} from "@/components/ui/skeletons";

export default function WealthLoading() {
  return (
    <div>
      <SkeletonTopBar />
      <SkeletonSubNav />
      <div className="p-6 space-y-5">
        <SkeletonStatCards count={4} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <SkeletonTable rows={4} />
          <div className="card" style={{ padding: "20px 24px" }}>
            <div className="skeleton skeleton-text" style={{ width: 120, marginBottom: 20 }} />
            {[140, 110, 90, 120].map((w, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "10px 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div className="skeleton skeleton-text" style={{ width: w }} />
                <div className="skeleton skeleton-text" style={{ width: 60 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
