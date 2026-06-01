import { prisma } from "@/lib/prisma";
import { fetchNAV } from "@/lib/apis/amfi";
import { getCachedNAVs } from "@/lib/data/nav-server";
import { getUSDINR } from "@/lib/data/fx-server";
import { formatMFSchemeName } from "@/lib/utils/mf-scheme-name";
import {
  fetchStockReturns,
  formatStockReturnsText,
} from "@/lib/agent/stock-returns";
import { fetchMfReturns, formatMfReturnLine, formatMfReturnsText } from "@/lib/agent/mf-returns";
import {
  fetchFixedIncomeReturns,
  fetchInsuranceInvestmentReturns,
  fetchAllInvestmentReturns,
  formatFixedIncomeReturnsText,
  formatInsuranceInvestmentReturnsText,
} from "@/lib/agent/other-returns";
import {
  lookupMfSchemes,
  formatMfSchemeLookupText,
  resolveBulkMfRow,
  type BulkMfRowInput,
} from "@/lib/apis/mf-scheme-lookup";
import { PORTFOLIO_IDS, portfolioIds } from "@/lib/agent/portfolio-scope";
import { resolveMfCategoryTool } from "@/lib/data/mf-categories-server";
import {
  buildPatchFromBulkRow,
  buildPatchFromInput,
  createMfHolding,
  findMfHoldings,
  formatFindMfHoldingsText,
  patchMfHolding,
} from "@/lib/agent/mf-holding-ops";
import type { PortfolioKey } from "@/lib/agent/portfolio-scope";

type ToolResult = string;

function portfolioId(input: Record<string, unknown>): string {
  return PORTFOLIO_IDS[input.portfolio as keyof typeof PORTFOLIO_IDS];
}

function portfolioKey(input: Record<string, unknown>): PortfolioKey {
  return (input.portfolio as PortfolioKey) ?? "mine";
}

async function resolveMfCodesForAdd(input: Record<string, unknown>): Promise<
  { schemeCode: string; schemeName: string } | { error: string }
> {
  const schemeCodeRaw = input.scheme_code as string | undefined;
  const isin = input.isin as string | undefined;
  const schemeName = input.scheme_name as string;

  if (schemeCodeRaw?.trim()) {
    const resolved = await resolveBulkMfRow({
      scheme_name: schemeName,
      units:       0,
      scheme_code: schemeCodeRaw,
    });
    if ("error" in resolved) return { error: resolved.error };
    return resolved;
  }

  if (isin?.trim() || schemeName?.trim()) {
    const resolved = await resolveBulkMfRow({
      scheme_name: schemeName,
      units:       0,
      isin,
    });
    if ("error" in resolved) return { error: resolved.error };
    return resolved;
  }

  return { error: "Provide scheme_code or isin (with scheme_name) to add an MF holding." };
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  try {
    switch (name) {
      case "get_mf_returns": {
        const portfolio = (input.portfolio as "mine" | "mother" | "both" | undefined) ?? "both";
        const filter = (input.filter as "all" | "negative" | "positive" | undefined) ?? "all";
        const rows = await fetchMfReturns({ portfolio, filter });
        return formatMfReturnsText(rows, filter);
      }

      case "get_fixed_income_returns": {
        const portfolio = (input.portfolio as "mine" | "mother" | "both" | undefined) ?? "both";
        const filter = (input.filter as "all" | "negative" | "positive" | undefined) ?? "all";
        const type = input.type as string | undefined;
        const rows = await fetchFixedIncomeReturns({ portfolio, filter, type });
        return formatFixedIncomeReturnsText(rows, filter);
      }

      case "get_insurance_investment_returns": {
        const portfolio = (input.portfolio as "mine" | "mother" | "both" | undefined) ?? "both";
        const filter = (input.filter as "all" | "negative" | "positive" | undefined) ?? "all";
        const rows = await fetchInsuranceInvestmentReturns({ portfolio, filter });
        return formatInsuranceInvestmentReturnsText(rows, filter);
      }

      case "get_investment_returns": {
        const portfolio = (input.portfolio as "mine" | "mother" | "both" | undefined) ?? "both";
        const filter = (input.filter as "all" | "negative" | "positive" | undefined) ?? "all";
        const asset_class = (input.asset_class as "all" | "stocks" | "mf" | "fixed_income" | "insurance" | undefined) ?? "all";
        return fetchAllInvestmentReturns({ portfolio, filter, asset_class });
      }

      case "get_stock_returns": {
        const portfolio = (input.portfolio as "mine" | "mother" | "both" | undefined) ?? "both";
        const filter = (input.filter as "all" | "negative" | "positive" | undefined) ?? "all";
        const rows = await fetchStockReturns({ portfolio, filter });
        return formatStockReturnsText(rows, filter);
      }

      case "get_portfolio_summary": {
        const ids =
          input.portfolio === "both"
            ? Object.values(PORTFOLIO_IDS)
            : [portfolioId(input)];
        const portfolios = await prisma.portfolio.findMany({
          where:   { id: { in: ids } },
          include: { mfHoldings: true, stockHoldings: true },
        });
        const codes = [
          ...new Set(portfolios.flatMap((p) => p.mfHoldings.map((h) => h.schemeCode))),
        ];
        const navs = await getCachedNAVs(codes);
        const stockReturns = await fetchStockReturns({
          portfolio: input.portfolio === "both" ? "both" : (input.portfolio as "mine" | "mother"),
        });
        const mfReturns = await fetchMfReturns({
          portfolio: input.portfolio === "both" ? "both" : (input.portfolio as "mine" | "mother"),
        });
        const fiReturns = await fetchFixedIncomeReturns({
          portfolio: input.portfolio === "both" ? "both" : (input.portfolio as "mine" | "mother"),
        });
        const insReturns = await fetchInsuranceInvestmentReturns({
          portfolio: input.portfolio === "both" ? "both" : (input.portfolio as "mine" | "mother"),
        });

        const summaries = portfolios.map((p) => {
          const mfVal = p.mfHoldings.reduce(
            (s, h) => s + h.units * (navs[h.schemeCode]?.nav ?? 0),
            0,
          );
          const pKey = p.id === PORTFOLIO_IDS.mother ? "mother" : "mine";
          const stVal = stockReturns
            .filter((r) => r.portfolioKey === pKey)
            .reduce((s, r) => s + r.currentValueInr, 0);
          const fiVal = fiReturns
            .filter((r) => r.portfolioKey === pKey)
            .reduce((s, r) => s + (r.estimatedValue ?? r.principal), 0);
          const insVal = insReturns
            .filter((r) => r.portfolioKey === pKey)
            .reduce((s, r) => s + (r.fundValue ?? r.guaranteedValue ?? 0), 0);
          const sip = p.mfHoldings.reduce((s, h) => s + (h.sipAmount ?? 0), 0);
          const total = mfVal + stVal + fiVal + insVal;
          return `${p.name}: MF ₹${(mfVal / 100000).toFixed(2)}L + Stocks ₹${(stVal / 100000).toFixed(2)}L + Fixed ₹${(fiVal / 100000).toFixed(2)}L + Insurance ₹${(insVal / 100000).toFixed(2)}L = ₹${(total / 100000).toFixed(2)}L | SIP ₹${(sip / 1000).toFixed(0)}K/mo`;
        });
        if (input.portfolio === "both" && summaries.length > 1) {
          const combined =
            mfReturns.reduce((s, r) => s + r.currentValueInr, 0) +
            stockReturns.reduce((s, r) => s + r.currentValueInr, 0) +
            fiReturns.reduce((s, r) => s + (r.estimatedValue ?? r.principal), 0) +
            insReturns.reduce((s, r) => s + (r.fundValue ?? r.guaranteedValue ?? 0), 0);
          return `${summaries.join("\n")}\nCombined portfolio value: ₹${(combined / 100000).toFixed(2)}L`;
        }
        return summaries.join("\n");
      }

      case "get_upcoming_sips": {
        const holdings = await prisma.mFHolding.findMany({
          include: { portfolio: { select: { name: true } } },
        });
        const sip7 = holdings.filter((h) => h.sipDate === 7);
        const sip28 = holdings.filter((h) => h.sipDate === 28);
        const now = new Date();
        const day = now.getDate();
        const next7 = day < 7 ? 7 - day : 7 + (30 - day);
        const next28 = day < 28 ? 28 - day : 28 + (30 - day);

        const fmt7 = sip7
          .map(
            (h) =>
              `  • ${formatMFSchemeName(h.schemeName)} (${h.portfolio.name}): ₹${h.sipAmount?.toLocaleString("en-IN")}`,
          )
          .join("\n");
        const fmt28 = sip28
          .map(
            (h) =>
              `  • ${formatMFSchemeName(h.schemeName)} (${h.portfolio.name}): ₹${h.sipAmount?.toLocaleString("en-IN")}`,
          )
          .join("\n");

        return `7th SIPs (${next7} days): ₹${(sip7.reduce((s, h) => s + (h.sipAmount ?? 0), 0) / 1000).toFixed(0)}K\n${fmt7}\n\n28th SIPs (${next28} days): ₹${(sip28.reduce((s, h) => s + (h.sipAmount ?? 0), 0) / 1000).toFixed(0)}K\n${fmt28}`;
      }

      case "get_action_items": {
        const items = await prisma.actionItem.findMany({
          where:   { completed: input.include_completed ? undefined : false },
          orderBy: { priority: "asc" },
        });
        if (!items.length) return "No open action items.";
        return items
          .map(
            (i) =>
              `[${i.priority.toUpperCase()}] ${i.title}${i.description ? " — " + i.description : ""}`,
          )
          .join("\n");
      }

      case "get_nav": {
        const result = await fetchNAV(input.scheme_code as string);
        if (!result) return `NAV not found for scheme ${input.scheme_code}`;
        return `${formatMFSchemeName(result.schemeName)}: ₹${result.nav.toFixed(4)} (as of ${result.date})`;
      }

      case "find_mf_holdings": {
        const portfolio = (input.portfolio as "mine" | "mother" | "both" | undefined) ?? "both";
        const scheme_code = input.scheme_code as string | undefined;
        const keyword = input.keyword as string | undefined;
        const isin = input.isin as string | undefined;
        if (!scheme_code?.trim() && !keyword?.trim() && !isin?.trim()) {
          return "Provide scheme_code, keyword, or isin to search holdings.";
        }
        const rows = await findMfHoldings({ portfolio, scheme_code, keyword, isin });
        return formatFindMfHoldingsText(rows, { portfolio, scheme_code, keyword, isin });
      }

      case "update_mf_holding": {
        return patchMfHolding({
          portfolio:   portfolioKey(input),
          scheme_code: input.scheme_code as string,
          patch:       buildPatchFromInput(input),
        });
      }

      case "update_mf_units": {
        return patchMfHolding({
          portfolio:   portfolioKey(input),
          scheme_code: input.scheme_code as string,
          patch:       { units: input.new_units as number },
        });
      }

      case "resolve_mf_category": {
        return resolveMfCategoryTool({
          scheme_name:   input.scheme_name as string,
          category_hint: input.category_hint as string | undefined,
        });
      }

      case "lookup_mf_scheme": {
        const isin = input.isin as string | undefined;
        const name = input.name as string | undefined;
        const schemeCode = input.scheme_code as string | undefined;
        if (!isin?.trim() && !name?.trim() && !schemeCode?.trim()) {
          return "Provide isin, name, or scheme_code to look up.";
        }
        const matches = await lookupMfSchemes({ isin, name, schemeCode });
        return formatMfSchemeLookupText(matches, { isin, name, schemeCode });
      }

      case "bulk_add_mf_holdings": {
        const portfolio = portfolioKey(input);
        const pid = portfolioId(input);
        const rows = input.holdings as BulkMfRowInput[] | undefined;
        if (!Array.isArray(rows) || rows.length === 0) {
          return "No holdings provided.";
        }

        const results: string[] = [];
        let added = 0;
        let updated = 0;
        let failed = 0;

        for (const row of rows) {
          if (!row?.scheme_name?.trim()) {
            failed++;
            results.push("✗ skipped row — scheme_name required");
            continue;
          }

          const resolved = await resolveBulkMfRow(row);
          if ("error" in resolved) {
            failed++;
            results.push(`✗ ${row.scheme_name}: ${resolved.error}`);
            continue;
          }

          const existing = await prisma.mFHolding.findFirst({
            where: { portfolioId: pid, schemeCode: resolved.schemeCode },
          });

          if (existing) {
            const patch = buildPatchFromBulkRow(row);
            if (Object.keys(patch).length === 0) {
              failed++;
              results.push(`✗ ${row.scheme_name}: no fields to update`);
              continue;
            }
            const msg = await patchMfHolding({
              portfolio,
              scheme_code: resolved.schemeCode,
              patch,
            });
            if (msg.startsWith("Refused") || msg.startsWith("No ") || msg.startsWith("Not ")) {
              failed++;
              results.push(`✗ ${msg}`);
            } else {
              updated++;
              results.push(`✓ ${msg}`);
            }
            continue;
          }

          if (typeof row.units !== "number") {
            failed++;
            results.push(`✗ ${row.scheme_name}: units required for new holdings`);
            continue;
          }

          const msg = await createMfHolding({
            portfolio,
            schemeCode: resolved.schemeCode,
            schemeName: resolved.schemeName,
            units:      row.units,
            avgNAV:     row.avg_nav,
            sipAmount:  row.sip_amount,
            sipDate:    row.sip_date,
            category:   row.category,
          });

          if (msg.startsWith("Refused")) {
            failed++;
            results.push(`✗ ${msg}`);
          } else {
            added++;
            results.push(`✓ ${msg}`);
          }
        }

        return `Import to ${portfolio}: ${added} added, ${updated} updated, ${failed} failed.\n${results.join("\n")}`;
      }

      case "add_mf_holding": {
        const resolved = await resolveMfCodesForAdd(input);
        if ("error" in resolved) return resolved.error;

        return createMfHolding({
          portfolio:  portfolioKey(input),
          schemeCode: resolved.schemeCode,
          schemeName: resolved.schemeName,
          units:      input.units as number,
          avgNAV:     input.avg_nav as number | undefined,
          sipAmount:  input.sip_amount as number | undefined,
          sipDate:    input.sip_date as number | undefined,
          category:   input.category as string | undefined,
        });
      }

      case "delete_mf_holding": {
        const pid = portfolioId(input);
        const holding = await prisma.mFHolding.findFirst({
          where: { portfolioId: pid, schemeCode: input.scheme_code as string },
        });
        if (!holding) return `Holding not found: ${input.scheme_code}`;
        await prisma.mFHolding.delete({ where: { id: holding.id } });
        return `Deleted ${formatMFSchemeName(holding.schemeName)} from ${input.portfolio} portfolio.`;
      }

      case "delete_all_mf_holdings": {
        const scope = (input.portfolio as "mine" | "mother" | "both") ?? "mine";
        const ids = portfolioIds(scope);
        const holdings = await prisma.mFHolding.findMany({
          where:   { portfolioId: { in: ids } },
          include: { portfolio: { select: { name: true } } },
        });
        if (!holdings.length) {
          return `No MF holdings found in ${scope === "both" ? "either portfolio" : scope + " portfolio"}.`;
        }
        const { count } = await prisma.mFHolding.deleteMany({
          where: { portfolioId: { in: ids } },
        });
        const preview = holdings
          .slice(0, 8)
          .map((h) => `${formatMFSchemeName(h.schemeName)} (${h.portfolio.name})`)
          .join("; ");
        const extra = count > 8 ? ` …and ${count - 8} more` : "";
        return `Deleted ${count} MF holding(s) from ${scope}: ${preview}${extra}.`;
      }

      case "add_or_update_stock": {
        const pid = portfolioId(input);
        const symbol = (input.symbol as string).toUpperCase();
        const exchange = input.exchange as string;
        const data = {
          portfolioId: pid,
          symbol,
          displayName: (input.display_name as string | undefined) ?? null,
          exchange,
          currency:    exchange === "NSE" ? "INR" : "USD",
          qty:         input.qty as number,
          avgPrice:    input.avg_price as number,
          action:      (input.action as string | undefined) ?? null,
        };
        await prisma.stockHolding.upsert({
          where: {
            portfolioId_symbol_exchange: { portfolioId: pid, symbol, exchange },
          },
          update: { qty: data.qty, avgPrice: data.avgPrice, action: data.action },
          create: data,
        });
        return `${data.displayName ?? data.symbol} (${data.exchange}): ${data.qty} shares @ ${data.currency === "USD" ? "$" : "₹"}${data.avgPrice} saved to ${input.portfolio} portfolio.`;
      }

      case "delete_stock": {
        const pid = portfolioId(input);
        const symbol = (input.symbol as string).toUpperCase();
        const exchange = input.exchange as string;
        const stock = await prisma.stockHolding.findFirst({
          where: { portfolioId: pid, symbol, exchange },
        });
        if (!stock) return `Stock not found: ${symbol} on ${exchange}`;
        await prisma.stockHolding.delete({ where: { id: stock.id } });
        return `Deleted ${stock.displayName ?? stock.symbol} from ${input.portfolio} portfolio.`;
      }

      case "delete_all_stocks": {
        const scope = (input.portfolio as "mine" | "mother" | "both") ?? "mine";
        const ids = portfolioIds(scope);
        const stocks = await prisma.stockHolding.findMany({
          where:   { portfolioId: { in: ids } },
          include: { portfolio: { select: { name: true } } },
        });
        if (!stocks.length) {
          return `No stock holdings found in ${scope === "both" ? "either portfolio" : scope + " portfolio"}.`;
        }
        const { count } = await prisma.stockHolding.deleteMany({
          where: { portfolioId: { in: ids } },
        });
        const preview = stocks
          .slice(0, 8)
          .map((s) => `${s.displayName ?? s.symbol} (${s.portfolio.name})`)
          .join("; ");
        const extra = count > 8 ? ` …and ${count - 8} more` : "";
        return `Deleted ${count} stock holding(s) from ${scope}: ${preview}${extra}.`;
      }

      case "add_action_item": {
        const item = await prisma.actionItem.create({
          data: {
            ownerId:     "primary",
            title:       input.title as string,
            description: (input.description as string | undefined) ?? null,
            priority:    (input.priority as string | undefined) ?? "medium",
          },
        });
        return `Action item added: "${item.title}" [${item.priority}]`;
      }

      case "complete_action_item": {
        const keyword = (input.title_keyword as string).toLowerCase();
        const items = await prisma.actionItem.findMany({ where: { completed: false } });
        const match = items.find((i) => i.title.toLowerCase().includes(keyword));
        if (!match) return `No open action item matching "${input.title_keyword}"`;
        await prisma.actionItem.update({
          where: { id: match.id },
          data:  { completed: true },
        });
        return `Completed: "${match.title}"`;
      }

      case "log_snapshot": {
        const pid = portfolioId(input);
        const portfolio = await prisma.portfolio.findUnique({
          where:   { id: pid },
          include: { mfHoldings: true, stockHoldings: true },
        });
        if (!portfolio) return "Portfolio not found";
        const codes = portfolio.mfHoldings.map((h) => h.schemeCode);
        const navs = await getCachedNAVs(codes);
        const usdInr = await getUSDINR();
        const mfVal = portfolio.mfHoldings.reduce(
          (s, h) => s + h.units * (navs[h.schemeCode]?.nav ?? 0),
          0,
        );
        const stVal = portfolio.stockHoldings.reduce(
          (s, st) => s + st.qty * st.avgPrice * (st.currency === "USD" ? usdInr : 1),
          0,
        );
        const total = mfVal + stVal;
        const inv = portfolio.mfHoldings.reduce(
          (s, h) => s + (h.avgNAV ? h.units * h.avgNAV : 0),
          0,
        );

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        await prisma.snapshot.upsert({
          where:  { portfolioId_date: { portfolioId: pid, date: today } },
          update: { totalValue: total, totalInvested: inv },
          create: { portfolioId: pid, date: today, totalValue: total, totalInvested: inv },
        });
        return `Snapshot logged for ${portfolio.name}: Total ₹${(total / 100000).toFixed(2)}L (MF ₹${(mfVal / 100000).toFixed(2)}L + Stocks ₹${(stVal / 100000).toFixed(2)}L)`;
      }

      case "update_investment_fund_value": {
        const pid = portfolioId(input);
        const keyword = (input.policy_keyword as string).toLowerCase();
        const policies = await prisma.insurancePolicy.findMany({
          where: { portfolioId: pid, isInvestmentLinked: true },
        });
        const match = policies.find(
          (p) =>
            p.planName.toLowerCase().includes(keyword) ||
            (p.insurer ?? "").toLowerCase().includes(keyword),
        );
        if (!match) return `No investment-linked policy found matching "${input.policy_keyword}"`;
        await prisma.insurancePolicy.update({
          where: { id: match.id },
          data:  {
            currentFundValue: input.new_value as number,
            fundValueAsOf:    new Date(),
          },
        });
        return `Updated ${match.planName} fund value: ₹${((input.new_value as number) / 100000).toFixed(2)}L (as of today)`;
      }

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err) {
    console.error(`Tool error [${name}]:`, err);
    return `Error executing ${name}: ${err instanceof Error ? err.message : "Unknown error"}`;
  }
}
