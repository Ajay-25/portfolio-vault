import { Suspense } from "react";
import Link from "next/link";
import { getAllPortfolios, getTriggers, getActionItems } from "@/lib/data/portfolio";
import { getUSDINR } from "@/lib/data/fx-server";
import { getUrgentInsuranceRenewals } from "@/lib/insurance-data";
import { getUpcomingFixedIncomeMaturities, fiValue } from "@/lib/fixed-income-data";
import { formatINR, absoluteReturn } from "@/lib/utils/finance";
import { TopBar } from "@/components/layout/top-bar";
import { NiftyTrigger } from "@/components/dashboard/nifty-trigger";
import { SIPCalendar } from "@/components/dashboard/sip-calendar";
import { MFHoldingsPreview } from "@/components/dashboard/mf-holdings-preview";
import { SkeletonTable } from "@/components/ui/skeletons";

export const revalidate = 300; // ISR: revalidate every 5 minutes

async function getDashboardData() {
  const [portfolios, triggers, actions, usdInr, urgentRenewals, upcomingFI] = await Promise.all([
    getAllPortfolios(),
    getTriggers(),
    getActionItems(5),
    getUSDINR(),
    getUrgentInsuranceRenewals(30),
    getUpcomingFixedIncomeMaturities(30, 3),
  ]);

  // Calculate portfolio values (avgNAV for MF — live NAVs stream in via MFHoldingsPreview)
  const portfolioValues = portfolios.map((portfolio) => {
    const mfValue = portfolio.mfHoldings.reduce((sum, h) => {
      const nav = h.avgNAV ?? 0;
      return sum + h.units * nav;
    }, 0);

    const stockValue = portfolio.stockHoldings.reduce((sum, s) => {
      // Use cached price if available; fall back to avgPrice for now
      const multiplier = s.currency === "USD" ? usdInr : 1;
      return sum + s.qty * s.avgPrice * multiplier; // replace avgPrice with live price later
    }, 0);

    const mfInvested = portfolio.mfHoldings.reduce((sum, h) => {
      return sum + (h.avgNAV ? h.units * h.avgNAV : 0);
    }, 0);

    const sipMonthly7  = portfolio.mfHoldings.filter((h) => h.sipDate === 7).reduce((s, h) => s + (h.sipAmount ?? 0), 0);
    const sipMonthly28 = portfolio.mfHoldings.filter((h) => h.sipDate === 28).reduce((s, h) => s + (h.sipAmount ?? 0), 0);

    return {
      ...portfolio,
      mfValue,
      stockValue,
      totalValue:  mfValue + stockValue,
      mfInvested,
      sipMonthly7,
      sipMonthly28,
    };
  });

  const totalNetWorth   = portfolioValues.reduce((s, p) => s + p.totalValue, 0);
  const totalMFInvested = portfolioValues.reduce((s, p) => s + p.mfInvested, 0);
  const totalGain       = totalMFInvested > 0 ? absoluteReturn(totalMFInvested, totalNetWorth) : 0;

  return { portfolioValues, totalNetWorth, totalGain, triggers, actions, urgentRenewals, upcomingFI };
}

export default async function DashboardPage() {
  const { portfolioValues, totalNetWorth, totalGain, triggers, actions, urgentRenewals, upcomingFI } =
    await getDashboardData();

  const myPortfolio  = portfolioValues.find((p) => p.type === "primary");
  const momPortfolio = portfolioValues.find((p) => p.type === "secondary");

  const totalSIP7  = portfolioValues.reduce((s, p) => s + p.sipMonthly7,  0);
  const totalSIP28 = portfolioValues.reduce((s, p) => s + p.sipMonthly28, 0);

  return (
    <div className="relative min-w-0 overflow-x-hidden">
      <TopBar title="Dashboard · Overview" />

      <main className="min-w-0 space-y-5 p-4 md:p-6">

        {/* ── Hero: Net Worth ─────────────────────────────────────── */}
        <div className="card card-gold animate-slide-up p-5 md:p-7 md:px-8">
          <div className="mb-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="stat-label mb-3">Total Net Worth</div>
              <div
                className="font-display text-gold-gradient leading-none"
                style={{ fontSize: "clamp(40px, 6vw, 64px)", fontWeight: 600 }}
              >
                {formatINR(totalNetWorth, true)}
              </div>
            </div>
            <div className="text-left sm:text-right sm:mt-1">
              <div className="stat-label mb-2">Overall Gain</div>
              <div
                className="font-mono text-2xl font-medium"
                style={{ color: totalGain >= 0 ? "var(--teal)" : "var(--red)" }}
              >
                {totalGain >= 0 ? "+" : ""}{(totalGain * 100).toFixed(2)}%
              </div>
              <div className="font-mono text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                all-time
              </div>
            </div>
          </div>

          {/* Portfolio segment bar */}
          {totalNetWorth > 0 && (
            <div className="mt-5">
              <div className="flex rounded-lg overflow-hidden h-2.5 gap-0.5">
                {myPortfolio && (
                  <div
                    className="transition-all duration-1000"
                    style={{
                      width:      `${(myPortfolio.mfValue / totalNetWorth) * 100}%`,
                      background: "linear-gradient(90deg, var(--gold), var(--gold-l))",
                      borderRadius: "3px 0 0 3px",
                    }}
                  />
                )}
                {myPortfolio && myPortfolio.stockValue > 0 && (
                  <div
                    style={{
                      width:      `${(myPortfolio.stockValue / totalNetWorth) * 100}%`,
                      background: "var(--blue)",
                    }}
                  />
                )}
                {momPortfolio && (
                  <div
                    style={{
                      width:        `${(momPortfolio.totalValue / totalNetWorth) * 100}%`,
                      background:   "var(--purple)",
                      borderRadius: "0 3px 3px 0",
                    }}
                  />
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                {[
                  { label: "My MF",      val: myPortfolio?.mfValue ?? 0,     color: "var(--gold)"   },
                  { label: "My Stocks",  val: myPortfolio?.stockValue ?? 0,  color: "var(--blue)"   },
                  { label: "Mother",     val: momPortfolio?.totalValue ?? 0, color: "var(--purple)" },
                ].map((seg) => (
                  <div key={seg.label} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-sm flex-shrink-0"
                         style={{ background: seg.color }} />
                    <div>
                      <div className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>{seg.label}</div>
                      <div className="font-mono text-xs" style={{ color: "var(--text-dim)" }}>
                        {formatINR(seg.val, true)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Portfolio Cards + Nifty Trigger ──────────────────────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[1fr_1fr_320px]">

          {/* My Portfolio */}
          {myPortfolio && (
            <Link href="/dashboard/wealth/mine" className="card animate-slide-up stagger-1 block min-w-0 hover:border-gold-500 transition-colors" style={{ padding: "20px 24px", textDecoration: "none" }}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="stat-label mb-1">My Wealth</div>
                  <div className="font-display text-2xl" style={{ color: "var(--text)", fontWeight: 600 }}>
                    {formatINR(myPortfolio.totalValue, true)}
                  </div>
                </div>
                <div
                  className="badge"
                  style={{ background: "rgba(201,168,76,0.1)", color: "var(--gold-l)", border: "1px solid rgba(201,168,76,0.2)" }}
                >
                  PRIMARY
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="stat-label mb-1">Mutual Funds</div>
                  <div className="font-mono text-sm" style={{ color: "var(--text)" }}>
                    {formatINR(myPortfolio.mfValue, true)}
                  </div>
                </div>
                <div>
                  <div className="stat-label mb-1">Stocks (IN+US)</div>
                  <div className="font-mono text-sm" style={{ color: "var(--text)" }}>
                    {formatINR(myPortfolio.stockValue, true)}
                  </div>
                </div>
                <div>
                  <div className="stat-label mb-1">MF Holdings</div>
                  <div className="font-mono text-sm" style={{ color: "var(--text-dim)" }}>
                    {myPortfolio.mfHoldings.length} funds
                  </div>
                </div>
                <div>
                  <div className="stat-label mb-1">Stocks</div>
                  <div className="font-mono text-sm" style={{ color: "var(--text-dim)" }}>
                    {myPortfolio.stockHoldings.length} holdings
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* Mother's Portfolio */}
          {momPortfolio && (
            <Link href="/dashboard/wealth/mother" className="card animate-slide-up stagger-2 block min-w-0 transition-colors" style={{ padding: "20px 24px", textDecoration: "none" }}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="stat-label mb-1">Mother&apos;s Wealth</div>
                  <div className="font-display text-2xl" style={{ color: "var(--text)", fontWeight: 600 }}>
                    {formatINR(momPortfolio.totalValue, true)}
                  </div>
                </div>
                <div className="badge badge-purple">SECONDARY</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="stat-label mb-1">Mutual Funds</div>
                  <div className="font-mono text-sm" style={{ color: "var(--text)" }}>
                    {formatINR(momPortfolio.mfValue, true)}
                  </div>
                </div>
                <div>
                  <div className="stat-label mb-1">Stocks (NSE)</div>
                  <div className="font-mono text-sm" style={{ color: "var(--text)" }}>
                    {formatINR(momPortfolio.stockValue, true)}
                  </div>
                </div>
                <div>
                  <div className="stat-label mb-1">MF Holdings</div>
                  <div className="font-mono text-sm" style={{ color: "var(--text-dim)" }}>
                    {momPortfolio.mfHoldings.length} funds
                  </div>
                </div>
                <div>
                  <div className="stat-label mb-1">Monthly SIP</div>
                  <div className="font-mono text-sm" style={{ color: "var(--gold-l)" }}>
                    {formatINR(momPortfolio.sipMonthly7 + momPortfolio.sipMonthly28, true)}/mo
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* Nifty Trigger */}
          <div className="min-w-0 lg:col-span-2 xl:col-span-1">
            <NiftyTrigger triggers={triggers} />
          </div>
        </div>

        {upcomingFI.length > 0 && (
          <div
            className="card animate-slide-up"
            style={{ padding: "16px 20px", borderColor: "rgba(29,158,117,0.3)" }}
          >
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-lg" style={{ color: "var(--teal)" }}>
                ◈
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm" style={{ color: "var(--text)" }}>
                  {upcomingFI.length} fixed income maturit{upcomingFI.length > 1 ? "ies" : "y"} in 30 days
                </div>
                <div className="font-mono text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {upcomingFI
                    .map((h) => {
                      const days = h.maturityDate
                        ? Math.ceil((h.maturityDate.getTime() - Date.now()) / 86400000)
                        : 0;
                      const val = h.maturityAmount ?? fiValue(h);
                      return `${h.label} in ${days}d · ${formatINR(val, true)} ready`;
                    })
                    .join(" · ")}
                </div>
              </div>
              <Link
                href="/dashboard/wealth/mine/fixed-income"
                className="ml-auto font-mono text-xs"
                style={{ color: "var(--teal)" }}
              >
                VIEW →
              </Link>
            </div>
          </div>
        )}

        {urgentRenewals.length > 0 && (
          <div
            className="card animate-slide-up"
            style={{ padding: "16px 20px", borderColor: "rgba(255,140,66,0.3)" }}
          >
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-lg" style={{ color: "var(--orange)" }}>
                ⚠
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm" style={{ color: "var(--text)" }}>
                  {urgentRenewals.length} insurance renewal
                  {urgentRenewals.length > 1 ? "s" : ""} due within 30 days
                </div>
                <div className="font-mono text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {urgentRenewals
                    .map((p) => {
                      const days = p.nextPremiumDate
                        ? Math.ceil(
                            (p.nextPremiumDate.getTime() - Date.now()) / 86400000,
                          )
                        : 0;
                      return `${p.planName} (${days}d)`;
                    })
                    .join(" · ")}
                </div>
              </div>
              <Link
                href="/dashboard/wealth/mine/insurance"
                className="ml-auto font-mono text-xs"
                style={{ color: "var(--orange)" }}
              >
                VIEW →
              </Link>
            </div>
          </div>
        )}

        {/* ── Bottom Row: SIP Calendar + Action Items ───────────────── */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SIPCalendar sip7={totalSIP7} sip28={totalSIP28} />

          {/* Action Items */}
          <div className="card animate-slide-up stagger-5" style={{ padding: "20px 24px" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="stat-label mb-0.5">Action Items</div>
                <div className="text-sm font-medium" style={{ color: "var(--text)" }}>Pending tasks</div>
              </div>
              <span className="badge badge-orange">{actions.length} open</span>
            </div>
            <div className="space-y-1">
              {actions.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 py-2.5"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                    style={{ background: item.priority === "high" ? "var(--red)" : item.priority === "medium" ? "var(--gold)" : "var(--text-muted)" }}
                  />
                  <div>
                    <div className="text-sm font-medium" style={{ color: "var(--text)" }}>{item.title}</div>
                    {item.description && (
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>{item.description}</div>
                    )}
                  </div>
                </div>
              ))}
              {actions.length === 0 && (
                <div className="text-sm py-4 text-center" style={{ color: "var(--text-muted)" }}>
                  No pending action items ✓
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Top MF Holdings Preview (live NAVs stream in) ───────────── */}
        {myPortfolio && myPortfolio.mfHoldings.length > 0 && (
          <Suspense
            fallback={
              <div className="card">
                <div
                  className="px-6 py-4"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <div className="skeleton skeleton-text" style={{ width: 160 }} />
                </div>
                <SkeletonTable rows={6} />
              </div>
            }
          >
            <MFHoldingsPreview portfolioId="portfolio-primary" />
          </Suspense>
        )}

      </main>
    </div>
  );
}
