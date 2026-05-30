import { prisma } from "@/lib/prisma";
import { getCachedNAVs } from "@/lib/data/nav-server";
import { getUSDINR } from "@/lib/data/fx-server";
import { formatMFSchemeName } from "@/lib/utils/mf-scheme-name";

export async function buildAgentContext(): Promise<string> {
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const [portfolios, triggers, actions, usdInr] = await Promise.all([
    prisma.portfolio.findMany({
      include: { mfHoldings: true, stockHoldings: true, insurancePolicies: true },
    }),
    prisma.trigger.findMany({ orderBy: { label: "asc" } }),
    prisma.actionItem.findMany({ where: { completed: false }, orderBy: { priority: "asc" } }),
    getUSDINR(),
  ]);

  const allCodes = [
    ...new Set(portfolios.flatMap((p) => p.mfHoldings.map((h) => h.schemeCode))),
  ];
  const navsObj = await getCachedNAVs(allCodes);

  const portfolioSections = portfolios
    .map((p) => {
      const mfValue = p.mfHoldings.reduce((sum, h) => {
        const nav = navsObj[h.schemeCode]?.nav ?? 0;
        return sum + h.units * nav;
      }, 0);
      const stockValue = p.stockHoldings.reduce((sum, s) => {
        const fx = s.currency === "USD" ? usdInr : 1;
        return sum + s.qty * s.avgPrice * fx;
      }, 0);
      const sipMonthly = p.mfHoldings.reduce((sum, h) => sum + (h.sipAmount ?? 0), 0);
      const sip7 = p.mfHoldings
        .filter((h) => h.sipDate === 7)
        .reduce((s, h) => s + (h.sipAmount ?? 0), 0);
      const sip28 = p.mfHoldings
        .filter((h) => h.sipDate === 28)
        .reduce((s, h) => s + (h.sipAmount ?? 0), 0);

      const mfList = p.mfHoldings
        .map((h) => {
          const nav = navsObj[h.schemeCode]?.nav;
          const value = nav ? h.units * nav : null;
          const name = formatMFSchemeName(h.schemeName);
          return `  • ${name} [${h.schemeCode}]: ${h.units} units${
            nav
              ? ` @ ₹${nav.toFixed(2)} = ₹${((value ?? 0) / 100000).toFixed(2)}L`
              : ""
          } | SIP: ₹${h.sipAmount ?? 0}/mo on ${h.sipDate ?? "-"}th`;
        })
        .join("\n");

      const stockList = p.stockHoldings
        .map((s) => {
          return `  • ${s.displayName ?? s.symbol} [${s.symbol}:${s.exchange}]: ${s.qty} shares @ ${s.currency === "USD" ? "$" : "₹"}${s.avgPrice}`;
        })
        .join("\n");

      const ulipList = p.insurancePolicies
        .filter((pol) => pol.isInvestmentLinked && pol.currentFundValue)
        .map(
          (pol) =>
            `  • ${pol.planName} (${pol.insurer}): ₹${(pol.currentFundValue! / 100000).toFixed(2)}L`,
        )
        .join("\n");

      return `
### ${p.name} (${p.type}, taxSlab: ${p.taxSlab * 100}%)
MF Value: ₹${(mfValue / 100000).toFixed(2)}L | Stock Value: ₹${(stockValue / 100000).toFixed(2)}L | Total: ₹${((mfValue + stockValue) / 100000).toFixed(2)}L
Monthly SIP: ₹${(sipMonthly / 1000).toFixed(0)}K (₹${(sip7 / 1000).toFixed(0)}K on 7th + ₹${(sip28 / 1000).toFixed(0)}K on 28th)

MF Holdings:
${mfList || "  (none)"}

Stock Holdings:
${stockList || "  (none)"}
${ulipList ? `\nInvestment-linked insurance:\n${ulipList}` : ""}`;
    })
    .join("\n\n");

  const now = new Date();
  const day = now.getDate();
  const next7 = day < 7 ? 7 - day : 7 + (30 - day);
  const next28 = day < 28 ? 28 - day : 28 + (30 - day);
  const totalSIP7 = portfolios
    .flatMap((p) => p.mfHoldings)
    .filter((h) => h.sipDate === 7)
    .reduce((s, h) => s + (h.sipAmount ?? 0), 0);
  const totalSIP28 = portfolios
    .flatMap((p) => p.mfHoldings)
    .filter((h) => h.sipDate === 28)
    .reduce((s, h) => s + (h.sipAmount ?? 0), 0);

  const sipContext = `
### SIP Schedule
- 7th of month: ₹${(totalSIP7 / 1000).toFixed(0)}K total (${next7 === 0 ? "TODAY" : `${next7} days away`})
- 28th of month: ₹${(totalSIP28 / 1000).toFixed(0)}K total (${next28 === 0 ? "TODAY" : `${next28} days away`})`;

  const triggerContext = triggers
    .map(
      (t) =>
        `- ${t.label}: Deploy ₹${(t.deployAmount / 100000).toFixed(1)}L when Nifty ${t.condition} ${t.niftyLevel.toLocaleString("en-IN")}`,
    )
    .join("\n");

  const actionContext = actions.length
    ? actions
        .map(
          (a) =>
            `- [${a.priority.toUpperCase()}] ${a.title}${a.description ? `: ${a.description}` : ""}`,
        )
        .join("\n")
    : "No open action items.";

  return `
You are Vault, an intelligent financial assistant embedded inside Vaulted — a personal wealth management app.
You have full knowledge of the user's investment portfolio and can take actions through tool calls.

Today: ${today}
USD/INR: ₹${usdInr.toFixed(2)}

Portfolio IDs for tools: "mine" = primary portfolio, "mother" = secondary portfolio.

═══════════════════════════════════════
PORTFOLIO DATA (live, as of now)
═══════════════════════════════════════
${portfolioSections}

═══════════════════════════════════════
SIP CALENDAR
═══════════════════════════════════════
${sipContext}

═══════════════════════════════════════
NIFTY DEPLOYMENT TRIGGERS
═══════════════════════════════════════
${triggerContext || "No triggers configured."}

═══════════════════════════════════════
OPEN ACTION ITEMS
═══════════════════════════════════════
${actionContext}

═══════════════════════════════════════
YOUR RULES
═══════════════════════════════════════
1. For DELETE operations: always describe what you're about to delete and explicitly ask "Shall I go ahead?" BEFORE calling the delete tool.
2. For unit updates: mention previous units and new units in your response.
3. Keep responses concise — this is a side panel, not a full document.
4. After any write action, briefly confirm: what changed and the new value.
5. When SIP is due soon, proactively mention it if relevant.
6. Use ₹ and Indian number formatting (L for lakh, Cr for crore).
7. If you're unsure about a scheme code or stock symbol, ask before acting.
8. You can run calculations yourself (XIRR, step-up) — you have the math tools.
`.trim();
}
