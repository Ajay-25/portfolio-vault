import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCachedNAVs } from "@/lib/data/nav-server";
import { getUSDINR } from "@/lib/data/fx-server";
import { formatMFSchemeName } from "@/lib/utils/mf-scheme-name";
import { toPortfolioKey } from "@/lib/agent/portfolio-scope";

function lakhs(n: number): string {
  return `₹${(n / 100000).toFixed(2)}L`;
}

function thousands(n: number): string {
  return `₹${(n / 1000).toFixed(0)}K`;
}

async function buildAgentContextInner(): Promise<string> {
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    year:    "numeric",
    month:   "short",
    day:     "numeric",
  });

  const [portfolios, triggers, actions, usdInr, priceCache] = await Promise.all([
    prisma.portfolio.findMany({
      include: {
        mfHoldings:          true,
        stockHoldings:       true,
        insurancePolicies:   true,
        fixedIncomeHoldings: true,
      },
    }),
    prisma.trigger.findMany({ orderBy: { label: "asc" } }),
    prisma.actionItem.findMany({
      where:   { completed: false },
      orderBy: { priority: "asc" },
      take:    10,
    }),
    getUSDINR(),
    prisma.priceCache.findMany(),
  ]);

  const livePrices = new Map(
    priceCache.map((p) => [`${p.symbol}:${p.exchange}`, p]),
  );

  const mfCodes = [...new Set(portfolios.flatMap((p) => p.mfHoldings.map((h) => h.schemeCode)))];
  const navs = mfCodes.length > 0 ? await getCachedNAVs(mfCodes) : {};

  const portfolioBlocks = portfolios.map((p) => {
    const key = toPortfolioKey(p.id);
    const toolId = key === "mother" ? "mother" : "mine";

    let mfVal = 0;
    const mfIndex: string[] = [];
    for (const h of p.mfHoldings) {
      const nav = navs[h.schemeCode]?.nav ?? 0;
      mfVal += h.units * nav;
      const short = formatMFSchemeName(h.schemeName).split(" - ")[0] ?? h.schemeName;
      mfIndex.push(`${h.schemeCode} ${short} (${h.units}u${h.sipAmount ? ` SIP ₹${h.sipAmount}` : ""})`);
    }

    let stockVal = 0;
    const stockIndex: string[] = [];
    for (const s of p.stockHoldings) {
      const fx = s.currency === "USD" ? usdInr : 1;
      const live = livePrices.get(`${s.symbol}:${s.exchange}`);
      const px = live?.price ?? s.avgPrice;
      stockVal += s.qty * px * fx;
      stockIndex.push(`${s.symbol}:${s.exchange} ${s.displayName ?? s.symbol} (${s.qty}@${s.currency === "USD" ? "$" : "₹"}${s.avgPrice}${live ? ` CMP ${live.price.toFixed(0)}` : ""})`);
    }

    const fiVal = p.fixedIncomeHoldings
      .filter((h) => h.isActive)
      .reduce((s, h) => s + (h.currentValue ?? h.principal), 0);
    const fiIndex = p.fixedIncomeHoldings
      .filter((h) => h.isActive)
      .map((h) => `${h.type}:${h.label} ${lakhs(h.currentValue ?? h.principal)}`)
      .join("; ");

    const ulipPolicies = p.insurancePolicies.filter(
      (pol) => pol.isInvestmentLinked || pol.type === "endowment" || pol.type === "money_back",
    );
    const ulipVal = ulipPolicies.reduce((s, pol) => s + (pol.currentFundValue ?? 0), 0);
    const ulipIndex = ulipPolicies
      .map((pol) => `${pol.planName} ${pol.currentFundValue ? lakhs(pol.currentFundValue) : "value unset"}`)
      .join("; ");

    const sipMo = p.mfHoldings.reduce((s, h) => s + (h.sipAmount ?? 0), 0);

    return `[${toolId}] ${p.name} · MF ${lakhs(mfVal)} (${p.mfHoldings.length}) · Stocks ${lakhs(stockVal)} (${p.stockHoldings.length}) · Fixed ${lakhs(fiVal)} · ULIP ${lakhs(ulipVal)} · SIP ${thousands(sipMo)}/mo
  MF: ${mfIndex.join("; ") || "none"}
  Stocks: ${stockIndex.join("; ") || "none"}${fiIndex ? `\n  Fixed: ${fiIndex}` : ""}${ulipIndex ? `\n  ULIP/endowment: ${ulipIndex}` : ""}`;
  });

  const day = new Date().getDate();
  const next7 = day < 7 ? 7 - day : 7 + (30 - day);
  const next28 = day < 28 ? 28 - day : 28 + (30 - day);
  const sip7 = portfolios
    .flatMap((p) => p.mfHoldings)
    .filter((h) => h.sipDate === 7)
    .reduce((s, h) => s + (h.sipAmount ?? 0), 0);
  const sip28 = portfolios
    .flatMap((p) => p.mfHoldings)
    .filter((h) => h.sipDate === 28)
    .reduce((s, h) => s + (h.sipAmount ?? 0), 0);

  const triggersLine = triggers.length
    ? triggers
        .map((t) => `${t.label}: ₹${(t.deployAmount / 100000).toFixed(1)}L if Nifty ${t.condition} ${t.niftyLevel}`)
        .join(" | ")
    : "none";

  const actionsLine = actions.length
    ? actions.map((a) => `[${a.priority[0]?.toUpperCase()}] ${a.title}`).join(" | ")
    : "none";

  const fiHoldings = await prisma.fixedIncomeHolding.findMany({
    where:   { isActive: true },
    include: { portfolio: { select: { name: true } } },
    orderBy: { type: "asc" },
  });

  const fiContext = fiHoldings.length
    ? fiHoldings
        .map((h) => {
          const val = h.currentValue ?? h.principal;
          return (
            `  • [${h.id}] ${h.type.toUpperCase().replace(/_/g, " ")} — ${h.label}` +
            (h.institution ? ` (${h.institution})` : "") +
            ` · ₹${(val / 100000).toFixed(2)}L` +
            (h.rate ? ` @ ${h.rate}%` : "") +
            (h.maturityDate
              ? ` → matures ${h.maturityDate.toLocaleDateString("en-IN")}`
              : "") +
            ` [${h.portfolio.name}]`
          );
        })
        .join("\n")
    : "  No fixed income instruments recorded.";

  return `You are Vault — portfolio assistant for Vaulted. Today: ${today}. USD/INR: ${usdInr.toFixed(2)}.
Tool portfolio ids: mine = primary, mother = secondary.

SUMMARY (totals use cached NAV/CMP; call return tools for live P&L detail)
${portfolioBlocks.join("\n")}

SIP: ${thousands(sip7)} on 7th (${next7}d) · ${thousands(sip28)} on 28th (${next28}d)
Triggers: ${triggersLine}
Open actions (${actions.length}): ${actionsLine}

═══════════════════════════════════════
FIXED INCOME HOLDINGS (live)
═══════════════════════════════════════
${fiContext}

TOOLS — call for live returns/P&L: get_stock_returns, get_mf_returns, get_fixed_income_returns, get_insurance_investment_returns, get_investment_returns (all assets). Never say you cannot fetch live prices.
Bulk deletes: use delete_all_mf_holdings or delete_all_stocks when user wants to clear an entire asset class — do NOT call delete_mf_holding once per fund.
Excel/CSV MF import: use bulk_add_mf_holdings with ISIN + name + units per row — AMFI codes are resolved automatically via lookup_mf_scheme / AMFI master. Do NOT ask the user for scheme codes when ISIN is present.
Excel/CSV stock import: use bulk_add_stocks with symbol, exchange, qty, avg_price per row in ONE tool call — never loop add_or_update_stock row-by-row (hits rate limits and fails on Groq).
Wrong stock symbol / price not found: call lookup_stock_symbol with company name or bad symbol → find_stock_holdings → confirm with user → update_stock_holding with new_symbol. Never guess tickers without lookup.
MF category is optional — use resolve_mf_category or bulk_add_mf_holdings; categories are inferred from fund names and new labels are registered automatically. Never say a category is unavailable.
User may attach Excel/CSV in chat — parsed sheet data is included with their message.
User messages may be multiline with tabs, spaces, and aligned columns (pasted tables). Preserve that structure when reading; treat tabs as column separators.

MF WRITE SAFETY (critical):
- Default portfolio is mine unless the user explicitly says mother/mom/mother's.
- Before ANY MF write, call find_mf_holdings to confirm scheme_code and portfolio.
- update_mf_holding: pass ONLY fields being changed — units, sip_amount, sip_date, avg_nav are preserved otherwise.
- add_mf_holding is CREATE-only; never use it to update SIP or units on an existing fund.
- If find_mf_holdings returns multiple matches or the fund is in the other portfolio, STOP and ask the user to confirm scheme_code + portfolio before writing.
- Never create a duplicate fund because of a slightly different name — same AMFI scheme_code or same normalized name = one holding.
- After updates, always state old→new values in your reply.

STOCK WRITE SAFETY (critical):
- To change avg price, qty, or symbol: call find_stock_holdings ONCE (with symbol or keyword), then update_stock_holding — NEVER call find_stock_holdings twice in the same task.
- When find_stock_holdings returns exactly 1 row, call update_stock_holding immediately with symbol, exchange, portfolio from that result plus ONLY the field changing (e.g. avg_price). Do NOT call find again.
- Multiple matches → numbered list, ask user to pick before update_stock_holding.
- update_stock_holding defaults: exchange NSE, portfolio mine. You can also pass keyword "Siemens" instead of symbol.
- Symbol fixes: lookup_stock_symbol → find_stock_holdings → user confirms → update_stock_holding with new_symbol.
- NEVER use add_or_update_stock for updates — it is CREATE-only and will refuse duplicates.
- After updates, state old→new values. Never claim updated unless tool result says "Updated".

DELETE SAFETY (critical):
- delete_mf_holding, delete_stock, delete_fixed_income, delete_all_*: FIRST call with confirmed:false (or omit) to preview entry details.
- Show preview to user and ask them to confirm. ONLY then call again with confirmed:true.
- Never delete on assumption — user must explicitly approve.

FIXED INCOME (critical):
- There is NO update_portfolio_summary tool — never invent it. get_portfolio_summary is READ-ONLY.
- Prefer find_fi_holding before any FI write if the target isn't clear from context above.
- Simple balance updates: update_fi_balance (most common) — always show before/after values.
- Partial field updates: update_fi_holding — pass ONLY fields that change.
- NPS allocation: update_nps_allocation — E+C+G+A must total 100%; alt max 5%. Ask how to split if user only gives equity%.
- PPF extension: extend_ppf — always clarify with_deposits vs without (affects 80C).
- Matured/withdrawn instruments: close_fi_holding (keeps history). delete_fi_holding only for mistakes/duplicates.
- Legacy tools find_fixed_income_holdings / update_fixed_income / delete_fixed_income still work.
- Tool args must be flat JSON strings — never nest fields as objects except fields_to_update.
- Default portfolio is mine unless user says mother/mom.

RULES: Be concise. Use ₹ and L/Cr formatting.`;
}

/** Cached ~2 min — tools always fetch fresh data when called. */
export async function buildAgentContext(): Promise<string> {
  return unstable_cache(buildAgentContextInner, ["agent-context-v7"], {
    revalidate: 120,
    tags:       ["agent-context"],
  })();
}
