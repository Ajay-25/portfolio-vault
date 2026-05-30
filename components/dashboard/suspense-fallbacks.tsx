import {
  SkeletonStatCards,
  SkeletonTable,
  SkeletonHeroCard,
} from "@/components/ui/skeletons";

/** MF / stocks portfolio pages */
export function PortfolioContentFallback() {
  return (
    <div className="space-y-5">
      <SkeletonStatCards count={4} />
      <SkeletonTable rows={10} />
    </div>
  );
}

/** Wealth summary page */
export function WealthSummaryFallback() {
  return (
    <div className="space-y-5">
      <SkeletonStatCards count={4} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SkeletonTable rows={4} />
        <div className="card" style={{ padding: "20px 24px" }}>
          <div className="skeleton skeleton-text" style={{ width: 120, marginBottom: 20 }} />
          {[140, 110, 90].map((w, i) => (
            <div
              key={i}
              className="flex justify-between py-2.5"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div className="skeleton skeleton-text" style={{ width: w }} />
              <div className="skeleton skeleton-text" style={{ width: 60 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Net worth aggregator */
export function NetWorthFallback() {
  return (
    <div className="space-y-5">
      <SkeletonHeroCard />
      <SkeletonStatCards count={4} />
      <SkeletonTable rows={8} />
    </div>
  );
}

/** Stock alerts — many Yahoo Finance calls */
export function StockAlertsFallback() {
  return (
    <div className="space-y-5">
      <div className="card" style={{ padding: "20px 24px" }}>
        <div className="skeleton skeleton-text" style={{ width: 160, marginBottom: 12 }} />
        <div className="skeleton skeleton-title" style={{ width: 200 }} />
      </div>
      <SkeletonStatCards count={4} />
      <SkeletonTable rows={8} />
    </div>
  );
}

/** Goal tracker — bulk NAV fetch */
export function GoalTrackerFallback() {
  return (
    <div className="space-y-5">
      <SkeletonStatCards count={4} />
      <div
        className="card skeleton"
        style={{ height: 280, borderRadius: 12 }}
      />
      <SkeletonTable rows={5} />
    </div>
  );
}

/** Insurance overview / owner pages */
export function InsuranceFallback() {
  return (
    <div className="space-y-5">
      <SkeletonStatCards count={4} />
      <SkeletonTable rows={6} />
    </div>
  );
}

/** Fixed income */
export function FixedIncomeFallback() {
  return (
    <div className="space-y-5">
      <SkeletonStatCards count={3} />
      <SkeletonTable rows={6} />
    </div>
  );
}

/** History chart + snapshot tables */
export function HistoryDataFallback() {
  return (
    <div className="space-y-5">
      <div className="card skeleton" style={{ height: 320, borderRadius: 12 }} />
      <SkeletonTable rows={6} />
    </div>
  );
}
