import {
  SkeletonTopBar,
  SkeletonSubNav,
  SkeletonStatCards,
  SkeletonTable,
} from "@/components/ui/skeletons";

export default function InsuranceLoading() {
  return (
    <div>
      <SkeletonTopBar />
      <SkeletonSubNav />
      <div className="p-6 space-y-5">
        <SkeletonStatCards count={4} />
        <div className="card" style={{ padding: "20px 24px" }}>
          <div className="skeleton skeleton-text" style={{ width: 140, marginBottom: 16 }} />
          {[0, 1].map((i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 16,
                padding: "10px 0",
                borderBottom: "1px solid var(--border)",
                alignItems: "center",
              }}
            >
              <div className="skeleton" style={{ width: 40, height: 44, borderRadius: 6 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton skeleton-text" style={{ width: "60%", marginBottom: 6 }} />
                <div className="skeleton skeleton-text" style={{ width: "40%", opacity: 0.5 }} />
              </div>
              <div className="skeleton" style={{ width: 64, height: 20, borderRadius: 4 }} />
            </div>
          ))}
        </div>
        <SkeletonTable rows={4} />
      </div>
    </div>
  );
}
