import { prisma } from "@/lib/prisma";
import { fetchNAV } from "@/lib/apis/amfi";
import { getCachedNAVs } from "@/lib/data/nav-server";
import { getUSDINR } from "@/lib/data/fx-server";
import { formatMFSchemeName } from "@/lib/utils/mf-scheme-name";

const PORTFOLIO_IDS = {
  mine:   "portfolio-primary",
  mother: "portfolio-mom",
} as const;

type ToolResult = string;

function portfolioId(input: Record<string, unknown>): string {
  return PORTFOLIO_IDS[input.portfolio as keyof typeof PORTFOLIO_IDS];
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  try {
    switch (name) {
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
        const usdInr = await getUSDINR();

        const summaries = portfolios.map((p) => {
          const mfVal = p.mfHoldings.reduce(
            (s, h) => s + h.units * (navs[h.schemeCode]?.nav ?? 0),
            0,
          );
          const stVal = p.stockHoldings.reduce(
            (s, s2) => s + s2.qty * s2.avgPrice * (s2.currency === "USD" ? usdInr : 1),
            0,
          );
          const sip = p.mfHoldings.reduce((s, h) => s + (h.sipAmount ?? 0), 0);
          return `${p.name}: MF ₹${(mfVal / 100000).toFixed(2)}L + Stocks ₹${(stVal / 100000).toFixed(2)}L = Total ₹${((mfVal + stVal) / 100000).toFixed(2)}L | SIP ₹${(sip / 1000).toFixed(0)}K/mo`;
        });
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

      case "update_mf_units": {
        const pid = portfolioId(input);
        const holding = await prisma.mFHolding.findFirst({
          where: { portfolioId: pid, schemeCode: input.scheme_code as string },
        });
        if (!holding) {
          return `Holding not found: scheme ${input.scheme_code} in ${input.portfolio} portfolio`;
        }
        const prev = holding.units;
        await prisma.mFHolding.update({
          where: { id: holding.id },
          data:  { units: input.new_units as number },
        });
        return `Updated ${formatMFSchemeName(holding.schemeName)}: ${prev} → ${input.new_units} units`;
      }

      case "add_mf_holding": {
        const pid = portfolioId(input);
        const schemeCode = input.scheme_code as string;
        const existing = await prisma.mFHolding.findFirst({
          where: { portfolioId: pid, schemeCode },
        });
        if (existing) {
          return `Holding already exists: ${existing.schemeName}. Use update_mf_units to change units.`;
        }
        const schemeName = formatMFSchemeName(input.scheme_name as string);
        await prisma.mFHolding.create({
          data: {
            portfolioId: pid,
            schemeCode,
            schemeName,
            units:     input.units as number,
            avgNAV:    (input.avg_nav as number | undefined) ?? null,
            sipAmount: (input.sip_amount as number | undefined) ?? null,
            sipDate:   (input.sip_date as number | undefined) ?? null,
            category:  (input.category as string | undefined) ?? null,
          },
        });
        return `Added ${schemeName} to ${input.portfolio} portfolio. Units: ${input.units}`;
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
