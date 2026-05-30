import { Suspense } from "react";
import { getPortfoliosLight } from "@/lib/data/portfolio";
import { TopBar } from "@/components/layout/top-bar";
import { HistoryDataContent } from "@/components/dashboard/history-data-content";
import { HistoryDataFallback } from "@/components/dashboard/suspense-fallbacks";

export const revalidate = 0;

export default async function HistoryPage() {
  const portfolios = await getPortfoliosLight();

  return (
    <div>
      <TopBar title="Analytics · Portfolio History" />
      <main className="p-6 space-y-5">

        {/* Log new snapshot — renders instantly with lightweight portfolio list */}
        <div className="card" style={{ padding: "24px" }}>
          <div className="stat-label mb-4">Log Monthly Snapshot</div>
          <form action="/api/snapshot" method="POST" className="grid grid-cols-4 gap-4">
            <div>
              <div className="stat-label mb-1.5">Date</div>
              <input
                type="date"
                name="date"
                defaultValue={new Date().toISOString().split("T")[0]}
                className="input-field"
              />
            </div>
            <div>
              <div className="stat-label mb-1.5">Portfolio</div>
              <select name="portfolioId" className="input-field" style={{ fontFamily: "Outfit" }}>
                {portfolios.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="stat-label mb-1.5">Total Value (₹)</div>
              <input type="number" name="totalValue" placeholder="e.g. 5200000" className="input-field font-mono" />
            </div>
            <div>
              <div className="stat-label mb-1.5">Total Invested (₹)</div>
              <input type="number" name="totalInvested" placeholder="e.g. 4080000" className="input-field font-mono" />
            </div>
            <div className="col-span-4 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2 rounded-lg text-sm font-medium"
                style={{ background: "var(--gold)", color: "#111", fontFamily: "IBM Plex Mono" }}
              >
                Save Snapshot
              </button>
            </div>
          </form>
        </div>

        <Suspense fallback={<HistoryDataFallback />}>
          <HistoryDataContent />
        </Suspense>
      </main>
    </div>
  );
}
