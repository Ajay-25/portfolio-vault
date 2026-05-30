import { SkeletonTopBar } from "@/components/ui/skeletons";

export default function CalculatorsLoading() {
  return (
    <div>
      <SkeletonTopBar />
      <div className="p-6">
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {[140, 120].map((w, i) => (
            <div key={i} className="skeleton" style={{ width: w, height: 36, borderRadius: 8 }} />
          ))}
        </div>
        <div className="card" style={{ padding: "24px" }}>
          <div className="skeleton skeleton-text" style={{ width: 160, marginBottom: 8 }} />
          <div className="skeleton skeleton-text" style={{ width: 280, marginBottom: 24 }} />
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}
            >
              <div className="skeleton" style={{ width: 160, height: 40, borderRadius: 8 }} />
              <div className="skeleton" style={{ flex: 1, height: 40, borderRadius: 8 }} />
              <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 8 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
