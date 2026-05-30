/** Reusable skeleton building blocks used across all loading.tsx files */

export function SkeletonTopBar() {
  return (
    <div
      style={{
        height:       49,
        borderBottom: "1px solid var(--border)",
        background:   "rgba(6,14,31,0.85)",
        display:      "flex",
        alignItems:   "center",
        justifyContent: "space-between",
        padding:      "0 24px",
      }}
    >
      <div className="skeleton skeleton-text" style={{ width: 180 }} />
      <div className="skeleton skeleton-text" style={{ width: 120 }} />
    </div>
  );
}

export function SkeletonStatCards({ count = 4 }: { count?: number }) {
  return (
    <div
      style={{
        display:             "grid",
        gridTemplateColumns: `repeat(${count}, 1fr)`,
        gap:                 16,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="card"
          style={{ padding: "18px 20px", animationDelay: `${i * 0.06}s` }}
        >
          <div className="skeleton skeleton-text" style={{ width: "55%", marginBottom: 14 }} />
          <div className="skeleton skeleton-title" style={{ width: "75%" }} />
          <div className="skeleton skeleton-text" style={{ width: "40%", marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="card">
      <div
        style={{
          display:       "flex",
          gap:           12,
          padding:       "16px 24px",
          borderBottom:  "1px solid var(--border)",
        }}
      >
        <div className="skeleton skeleton-text" style={{ width: 160 }} />
        <div className="skeleton skeleton-text" style={{ width: 80, marginLeft: "auto" }} />
      </div>
      <div style={{ padding: "8px 0" }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            style={{
              display:    "flex",
              gap:        12,
              alignItems: "center",
              padding:    "10px 24px",
              borderBottom: i < rows - 1 ? "1px solid var(--border)" : "none",
            }}
          >
            <div style={{ flex: 2 }}>
              <div className="skeleton skeleton-text" style={{ width: "70%", marginBottom: 6 }} />
              <div className="skeleton skeleton-text" style={{ width: "40%", opacity: 0.5 }} />
            </div>
            <div className="skeleton" style={{ width: 48, height: 20, borderRadius: 4 }} />
            <div className="skeleton skeleton-text" style={{ width: 60 }} />
            <div className="skeleton skeleton-text" style={{ width: 70 }} />
            <div className="skeleton skeleton-text" style={{ width: 80 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonHeroCard() {
  return (
    <div className="card card-gold" style={{ padding: "28px 32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div className="skeleton skeleton-text" style={{ width: 120, marginBottom: 16 }} />
          <div className="skeleton skeleton-hero" style={{ width: 280 }} />
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="skeleton skeleton-text" style={{ width: 80, marginBottom: 10, marginLeft: "auto" }} />
          <div className="skeleton skeleton-title" style={{ width: 100 }} />
        </div>
      </div>
      <div
        className="skeleton"
        style={{ height: 10, marginTop: 24, borderRadius: 5 }}
      />
      <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
        {[100, 80, 60].map((w, i) => (
          <div key={i}>
            <div className="skeleton skeleton-text" style={{ width: w * 0.6, marginBottom: 4 }} />
            <div className="skeleton skeleton-text" style={{ width: w }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonTwoColumnCards() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 320px", gap: 16 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="card" style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <div className="skeleton skeleton-text" style={{ width: 80, marginBottom: 8 }} />
              <div className="skeleton skeleton-title" style={{ width: 120 }} />
            </div>
            <div className="skeleton" style={{ width: 64, height: 20, borderRadius: 4 }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[0, 1, 2, 3].map((j) => (
              <div key={j}>
                <div className="skeleton skeleton-text" style={{ width: "60%", marginBottom: 4 }} />
                <div className="skeleton skeleton-text" style={{ width: "80%" }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonSubNav() {
  return (
    <div
      style={{
        display:      "flex",
        gap:          4,
        padding:      "12px 24px",
        borderBottom: "1px solid var(--border)",
        background:   "var(--bg-1)",
      }}
    >
      {[80, 100, 70, 100, 80].map((w, i) => (
        <div
          key={i}
          className="skeleton"
          style={{ width: w, height: 32, borderRadius: 8 }}
        />
      ))}
    </div>
  );
}
