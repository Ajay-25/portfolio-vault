import {
  SkeletonTopBar,
  SkeletonHeroCard,
  SkeletonStatCards,
  SkeletonTwoColumnCards,
  SkeletonTable,
} from "@/components/ui/skeletons";

export default function DashboardLoading() {
  return (
    <div>
      <SkeletonTopBar />
      <div className="p-6 space-y-5">
        <SkeletonHeroCard />
        <SkeletonTwoColumnCards />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="card" style={{ padding: "20px 24px", height: 180 }}>
            <div className="skeleton skeleton-text" style={{ width: 120, marginBottom: 20 }} />
            {[0, 1].map((i) => (
              <div key={i} className="skeleton skeleton-row" style={{ marginBottom: 10 }} />
            ))}
          </div>
          <div className="card" style={{ padding: "20px 24px", height: 180 }}>
            <div className="skeleton skeleton-text" style={{ width: 100, marginBottom: 20 }} />
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "center" }}
              >
                <div
                  className="skeleton"
                  style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0 }}
                />
                <div className="skeleton skeleton-text" style={{ flex: 1 }} />
              </div>
            ))}
          </div>
        </div>
        <SkeletonTable rows={6} />
      </div>
    </div>
  );
}
