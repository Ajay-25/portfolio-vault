import { TopBar } from "@/components/layout/top-bar";
import { TaxTrackerView } from "@/components/dashboard/tax-tracker-view";
import { getTaxTrackerData } from "@/lib/tax";
import { prisma } from "@/lib/prisma";

export const revalidate = 0;

export default async function TaxPage() {
  const portfolios = await prisma.portfolio.findMany({
    where: { id: { in: ["portfolio-primary", "portfolio-mom"] } },
    select: { id: true, ltcgUsed: true },
  });

  const primaryUsed = portfolios.find((p) => p.id === "portfolio-primary")?.ltcgUsed ?? 0;
  const motherUsed = portfolios.find((p) => p.id === "portfolio-mom")?.ltcgUsed ?? 0;
  const data = getTaxTrackerData(primaryUsed, motherUsed);

  return (
    <div>
      <TopBar title="Planning · Tax Tracker" />
      <main className="p-6">
        <div
          className="font-mono text-[10px] tracking-[0.25em] uppercase mb-1.5"
          style={{ color: "var(--text-muted)" }}
        >
          {data.fyLabel}
        </div>
        <h1
          className="font-display text-3xl font-normal leading-tight mb-6 animate-slide-up"
          style={{ color: "var(--text)" }}
        >
          Tax <em style={{ color: "var(--gold)" }}>tracker</em>
        </h1>

        <TaxTrackerView initial={data} />
      </main>
    </div>
  );
}
