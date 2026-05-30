import { SkeletonTopBar } from "@/components/ui/skeletons";

export default function SettingsLoading() {
  return (
    <div>
      <SkeletonTopBar />
      <div className="p-6 space-y-5" style={{ maxWidth: 672 }}>
        {[0, 1, 2].map((card) => (
          <div key={card} className="card" style={{ padding: "24px" }}>
            <div className="skeleton skeleton-text" style={{ width: 140, marginBottom: 8 }} />
            <div
              className="skeleton skeleton-text"
              style={{ width: 240, marginBottom: 20, opacity: 0.6 }}
            />
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                {[0, 1, 2].map((col) => (
                  <div key={col}>
                    <div
                      className="skeleton skeleton-text"
                      style={{ width: "60%", marginBottom: 8 }}
                    />
                    <div className="skeleton skeleton-row" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
