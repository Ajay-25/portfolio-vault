import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/top-bar";
import { CasImport } from "@/components/dashboard/cas-import";
import { SettingsTriggersForm } from "@/components/dashboard/settings-triggers-form";

export const revalidate = 0;

export default async function SettingsPage() {
  const triggers = await prisma.trigger.findMany({ orderBy: { label: "asc" } });

  return (
    <div>
      <TopBar title="Settings" />
      <main className="p-6 space-y-5 max-w-2xl">

        {/* MF Holdings Import */}
        <div className="card" style={{ padding: "24px" }}>
          <div className="stat-label mb-1">Import MF Holdings</div>
          <div className="text-sm mb-6" style={{ color: "var(--text-dim)" }}>
            Upload casparser JSON (free, recommended) or CSV to update mutual fund units.
          </div>
          <CasImport />
        </div>

        {/* Nifty Triggers */}
        <div className="card" style={{ padding: "24px" }}>
          <div className="stat-label mb-1">Nifty Triggers</div>
          <div className="text-sm mb-6" style={{ color: "var(--text-dim)" }}>
            Levels at which you deploy lump-sum capital
          </div>
          <SettingsTriggersForm
            triggers={triggers.map((t) => ({
              id: t.id,
              label: t.label,
              niftyLevel: t.niftyLevel,
              deployAmount: t.deployAmount,
            }))}
          />
        </div>

        {/* Data Info */}
        <div className="card" style={{ padding: "24px" }}>
          <div className="stat-label mb-4">Data Sources</div>
          <div className="space-y-3">
            {[
              { label: "NAV Data",      source: "mfapi.in (server-side, cached 15min)",   status: "ok" },
              { label: "Nifty 50",      source: "Yahoo Finance via yahoo-finance2",        status: "ok" },
              { label: "US Stocks",     source: "Yahoo Finance via yahoo-finance2",        status: "ok" },
              { label: "Indian Stocks", source: "Yahoo Finance (.NS) via yahoo-finance2",  status: "ok" },
              { label: "USD/INR FX",   source: "frankfurter.app (free, cached 10min)",    status: "ok" },
            ].map(({ label, source, status }) => (
              <div key={label} className="flex items-center gap-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: status === "ok" ? "var(--teal)" : "var(--red)" }}
                />
                <div className="flex-1">
                  <div className="text-sm font-medium" style={{ color: "var(--text)" }}>{label}</div>
                  <div className="font-mono text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{source}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Env Checklist */}
        <div className="card" style={{ padding: "24px" }}>
          <div className="stat-label mb-4">Environment Setup Checklist</div>
          <div className="space-y-2">
            {[
              "AUTH_GOOGLE_ID — Google OAuth Client ID",
              "AUTH_GOOGLE_SECRET — Google OAuth Secret",
              "AUTH_SECRET — Random secret (npx auth secret)",
              "ALLOWED_EMAIL — Your Gmail address",
              "DATABASE_URL — Neon pooled connection string",
              "DIRECT_URL — Neon direct connection string",
              "CRON_SECRET — Any random string for cron auth",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 font-mono text-xs py-1.5">
                <span style={{ color: "var(--gold)" }}>✓</span>
                <span style={{ color: "var(--text-dim)" }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}
