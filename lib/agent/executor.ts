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
import {
  buildStockPatchFromInput,
  createStockHolding,
  findStockHoldings,
  formatFindStockHoldingsText,
  formatStockHoldingLine,
  patchStockHolding,
} from "@/lib/agent/stock-holding-ops";
import {
  formatStockSymbolLookupText,
  lookupStockSymbols,
} from "@/lib/apis/stock-symbol-lookup";
import {
  calculateFiProjection,
  closeFiHolding,
  createFiHolding,
  deleteFiHolding,
  extendPpf,
  findFiHolding,
  legacyDeleteFixedIncome,
  legacyUpdateFixedIncome,
  listFiHoldings,
  renewFd,
  updateFiBalance,
  updateFiHolding,
  updateNpsAllocation,
} from "@/lib/agent/fi-agent-ops";
import {
  addBuilderDeductionText,
  createWorkStreamText,
  getHomeSummaryText,
  getPayerBalanceText,
  listWorkStreamsText,
  logHomeExpense,
  recordRepaymentText,
  updateTransactionSettlementText,
} from "@/lib/agent/project-agent-ops";
import { coerceToolInput, parseOptionalNumber } from "@/lib/agent/coerce-tool-input";
import { confirmationRequired, isDeleteConfirmed } from "@/lib/agent/delete-confirmation";
import {
  normalizeExchange,
  normalizePortfolioKey,
  normalizePortfolioScope,
  optionalExchange,
} from "@/lib/agent/normalize-input";
import type { PortfolioKey } from "@/lib/agent/portfolio-scope";

type ToolResult = string;

function portfolioId(input: Record<string, unknown>): string {
  return PORTFOLIO_IDS[portfolioKey(input)];
}

function portfolioKey(input: Record<string, unknown>): PortfolioKey {
  return normalizePortfolioKey(input.portfolio);
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
  input = coerceToolInput(input);
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

      case "find_fixed_income_holdings": {
        const keyword =
          (input.keyword as string | undefined)?.trim() ||
          (input.label as string | undefined)?.trim() ||
          (input.type as string | undefined)?.trim() ||
          "";
        if (!keyword) {
          return listFiHoldings({ portfolio: input.portfolio ?? "both" });
        }
        return findFiHolding({
          keyword,
          type: input.type as string | undefined,
          portfolio: input.portfolio ?? "both",
        });
      }

      case "update_fixed_income":
        return legacyUpdateFixedIncome(input);

      case "delete_fixed_income":
        return legacyDeleteFixedIncome(input);

      case "list_fi_holdings":
        return listFiHoldings(input);

      case "find_fi_holding":
        return findFiHolding(input);

      case "create_fi_holding":
        return createFiHolding(input);

      case "update_fi_balance":
        return updateFiBalance(input);

      case "update_fi_holding":
        return updateFiHolding(input);

      case "update_nps_allocation":
        return updateNpsAllocation(input);

      case "extend_ppf":
        return extendPpf(input);

      case "renew_fd":
        return renewFd(input);

      case "close_fi_holding":
        return closeFiHolding(input);

      case "delete_fi_holding":
        return deleteFiHolding(input);

      case "calculate_fi_projection":
        return calculateFiProjection(input);

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
        const portfolio = portfolioKey(input);
        const schemeCode = input.scheme_code as string;
        const holding = await prisma.mFHolding.findFirst({
          where: { portfolioId: pid, schemeCode },
        });
        if (!holding) return `Holding not found: ${schemeCode}`;

        const label = `${formatMFSchemeName(holding.schemeName)} [${holding.schemeCode}] — ${holding.units} units · avg ₹${holding.avgNAV ?? "—"} · ${portfolio} portfolio`;
        if (!isDeleteConfirmed(input)) {
          return confirmationRequired("Delete this MF holding?", [label]);
        }

        await prisma.mFHolding.delete({ where: { id: holding.id } });
        return `Deleted ${formatMFSchemeName(holding.schemeName)} [${holding.schemeCode}] from ${portfolio} portfolio.`;
      }

      case "delete_all_mf_holdings": {
        const scope = normalizePortfolioScope(input.portfolio, "mine");
        const ids = portfolioIds(scope);
        const holdings = await prisma.mFHolding.findMany({
          where:   { portfolioId: { in: ids } },
          include: { portfolio: { select: { name: true } } },
        });
        if (!holdings.length) {
          return `No MF holdings found in ${scope === "both" ? "either portfolio" : scope + " portfolio"}.`;
        }

        const preview = holdings
          .slice(0, 10)
          .map((h) => `  • [${h.schemeCode}] ${formatMFSchemeName(h.schemeName)} (${h.portfolio.name}) — ${h.units} units`);

        if (!isDeleteConfirmed(input)) {
          return confirmationRequired(
            `Delete ALL ${holdings.length} MF holding(s) from ${scope}?`,
            preview,
          );
        }

        const { count } = await prisma.mFHolding.deleteMany({
          where: { portfolioId: { in: ids } },
        });
        const extra = count > 10 ? ` …and ${count - 10} more` : "";
        return `Deleted ${count} MF holding(s) from ${scope}.${extra ? `\n${preview.join("\n")}${extra}` : ""}`;
      }

      case "lookup_stock_symbol": {
        const query = input.query as string | undefined;
        const name = input.name as string | undefined;
        if (!query?.trim() && !name?.trim()) {
          return "Provide query (symbol/abbreviation) or name (company name) to look up.";
        }
        const exchange = normalizeExchange(input.exchange);
        const limit = typeof input.limit === "number" ? input.limit : 5;
        const matches = await lookupStockSymbols({ query, name, exchange, limit });
        return formatStockSymbolLookupText(matches, { query, name, exchange });
      }

      case "find_stock_holdings": {
        const portfolio = normalizePortfolioScope(input.portfolio);
        const symbol = input.symbol as string | undefined;
        const keyword = input.keyword as string | undefined;
        const exchange = optionalExchange(input.exchange);
        if (!symbol?.trim() && !keyword?.trim()) {
          return "Skipped — symbol or keyword required. If find_stock_holdings already returned a match, call update_stock_holding with that symbol instead.";
        }
        const rows = await findStockHoldings({ portfolio, symbol, keyword, exchange });
        return formatFindStockHoldingsText(rows, { portfolio, symbol, keyword, exchange });
      }

      case "update_stock_holding": {
        return patchStockHolding({
          portfolio: portfolioKey(input),
          symbol:    input.symbol as string | undefined,
          keyword:   input.keyword as string | undefined,
          exchange:  normalizeExchange(input.exchange),
          patch:     buildStockPatchFromInput(input),
        });
      }

      case "bulk_add_stocks": {
        const portfolio = portfolioKey(input);
        const pid = portfolioId(input);
        const rows = input.holdings as Array<{
          symbol?:       string;
          display_name?: string;
          exchange?:     string;
          qty?:          number;
          avg_price?:    number;
          action?:       string;
        }> | undefined;

        if (!Array.isArray(rows) || rows.length === 0) {
          return "No stock holdings provided.";
        }

        const results: string[] = [];
        let saved = 0;
        let failed = 0;

        for (const row of rows) {
          if (!row?.symbol?.trim()) {
            failed++;
            results.push("✗ skipped row — symbol required");
            continue;
          }
          if (typeof row.qty !== "number" || typeof row.avg_price !== "number") {
            failed++;
            results.push(`✗ ${row.symbol}: qty and avg_price required`);
            continue;
          }

          const symbol = row.symbol.trim().toUpperCase();
          const exchange = normalizeExchange(row.exchange);
          const data = {
            portfolioId: pid,
            symbol,
            displayName: row.display_name?.trim() || null,
            exchange,
            currency:    exchange === "NSE" ? "INR" : "USD",
            qty:         row.qty,
            avgPrice:    row.avg_price,
            action:      row.action?.trim() || null,
          };

          try {
            await prisma.stockHolding.upsert({
              where: {
                portfolioId_symbol_exchange: { portfolioId: pid, symbol, exchange },
              },
              update: { qty: data.qty, avgPrice: data.avgPrice, action: data.action, displayName: data.displayName ?? undefined },
              create: data,
            });
            saved++;
            results.push(
              `✓ ${data.displayName ?? symbol} (${exchange}): ${data.qty} @ ${data.currency === "USD" ? "$" : "₹"}${data.avgPrice}`,
            );
          } catch (err) {
            failed++;
            results.push(`✗ ${symbol}: ${err instanceof Error ? err.message : "save failed"}`);
          }
        }

        return `Stock import to ${portfolio}: ${saved} saved, ${failed} failed.\n${results.join("\n")}`;
      }

      case "add_or_update_stock": {
        const qty = parseOptionalNumber(input.qty);
        const avg = parseOptionalNumber(input.avg_price);
        if (qty === undefined || avg === undefined) {
          return "qty and avg_price are required numbers for new stock holdings.";
        }
        return createStockHolding({
          portfolio:    portfolioKey(input),
          symbol:       input.symbol as string,
          exchange:     normalizeExchange(input.exchange),
          qty,
          avg_price:    avg,
          display_name: input.display_name as string | undefined,
          action:       input.action as string | undefined,
        });
      }

      case "delete_stock": {
        const pid = portfolioId(input);
        const portfolio = portfolioKey(input);
        const symbol = (input.symbol as string).toUpperCase();
        const exchange = normalizeExchange(input.exchange);
        const stock = await prisma.stockHolding.findFirst({
          where: {
            portfolioId: pid,
            exchange,
            symbol:      { equals: symbol, mode: "insensitive" },
          },
          include: { portfolio: { select: { id: true, name: true } } },
        });
        if (!stock) return `Stock not found: ${symbol} on ${exchange}`;

        const match = formatStockHoldingLine({
          id:            stock.id,
          symbol:        stock.symbol,
          displayName:   stock.displayName,
          exchange:      stock.exchange,
          currency:      stock.currency,
          portfolio:     portfolio,
          portfolioName: stock.portfolio.name,
          qty:           stock.qty,
          avgPrice:      stock.avgPrice,
          action:        stock.action,
        }).trim();

        if (!isDeleteConfirmed(input)) {
          return confirmationRequired("Delete this stock holding?", [match]);
        }

        await prisma.stockHolding.delete({ where: { id: stock.id } });
        return `Deleted ${stock.displayName ?? stock.symbol} [${stock.symbol}] from ${portfolio} portfolio.`;
      }

      case "delete_all_stocks": {
        const scope = normalizePortfolioScope(input.portfolio, "mine");
        const ids = portfolioIds(scope);
        const stocks = await prisma.stockHolding.findMany({
          where:   { portfolioId: { in: ids } },
          include: { portfolio: { select: { name: true } } },
        });
        if (!stocks.length) {
          return `No stock holdings found in ${scope === "both" ? "either portfolio" : scope + " portfolio"}.`;
        }

        const preview = stocks.slice(0, 10).map((s) =>
          `  • [${s.symbol}] ${s.displayName ?? s.symbol} (${s.portfolio.name}) — ${s.qty} @ ₹${s.avgPrice}`,
        );

        if (!isDeleteConfirmed(input)) {
          return confirmationRequired(
            `Delete ALL ${stocks.length} stock holding(s) from ${scope}?`,
            preview,
          );
        }

        const { count } = await prisma.stockHolding.deleteMany({
          where: { portfolioId: { in: ids } },
        });
        return `Deleted ${count} stock holding(s) from ${scope}.`;
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

      case "log_home_expense":
        return logHomeExpense(input);

      case "get_home_summary":
        return getHomeSummaryText();

      case "get_payer_balance":
        return getPayerBalanceText((input.paid_by as string) ?? "");

      case "record_repayment":
        return recordRepaymentText(input);

      case "add_builder_deduction":
        return addBuilderDeductionText(input);

      case "list_work_streams":
        return listWorkStreamsText();

      case "create_work_stream":
        return createWorkStreamText(input);

      case "update_home_transaction_settlement":
        return updateTransactionSettlementText(input);

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err) {
    console.error(`Tool error [${name}]:`, err);
    return `Error executing ${name}: ${err instanceof Error ? err.message : "Unknown error"}`;
  }
}
