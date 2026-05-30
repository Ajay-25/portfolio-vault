export const WEALTH_OWNERS = {
  mine: {
    slug: "mine",
    portfolioId: "portfolio-primary",
    label: "My Wealth",
    ownerId: "primary",
    stocksMarkets: ["in", "us"] as const,
  },
  mother: {
    slug: "mother",
    portfolioId: "portfolio-mom",
    label: "Mother's Wealth",
    ownerId: "mother",
    stocksMarkets: ["in"] as const,
  },
} as const;

export type WealthOwnerSlug = keyof typeof WEALTH_OWNERS;
export type StockMarket = "in" | "us";

export const WEALTH_SEGMENTS = ["", "mf", "stocks", "fixed-income", "insurance"] as const;
export type WealthSegment = (typeof WEALTH_SEGMENTS)[number];

const OWNER_SLUGS = Object.keys(WEALTH_OWNERS) as WealthOwnerSlug[];

export function isWealthOwnerSlug(slug: string): slug is WealthOwnerSlug {
  return OWNER_SLUGS.includes(slug as WealthOwnerSlug);
}

export function resolveOwner(slug: string) {
  if (!isWealthOwnerSlug(slug)) return null;
  return WEALTH_OWNERS[slug];
}

export function wealthPath(
  owner: WealthOwnerSlug,
  segment: Exclude<WealthSegment, ""> | "" = "",
  query?: Record<string, string>,
): string {
  const base = `/dashboard/wealth/${owner}`;
  const path = segment ? `${base}/${segment}` : base;
  if (!query || Object.keys(query).length === 0) return path;
  return `${path}?${new URLSearchParams(query).toString()}`;
}

export function isActiveWealthNav(
  pathname: string,
  search: string,
  owner: WealthOwnerSlug,
  segment: WealthSegment,
): boolean {
  const base = `/dashboard/wealth/${owner}`;
  const target = segment ? `${base}/${segment}` : base;

  if (segment === "stocks") {
    if (pathname !== `${base}/stocks`) return false;
    if (owner === "mother") return true;
    const market = new URLSearchParams(search.replace(/^\?/, "")).get("market") ?? "in";
    return market === "in" || market === "us";
  }

  if (segment === "") {
    return pathname === base;
  }

  return pathname === target || pathname.startsWith(`${target}/`);
}

export function wealthTopBarTitle(
  owner: WealthOwnerSlug,
  segment: WealthSegment,
  market?: StockMarket,
): string {
  const { label } = WEALTH_OWNERS[owner];
  if (segment === "") return `${label} · Summary`;
  if (segment === "mf") return `${label} · MF`;
  if (segment === "fixed-income") return `${label} · Fixed income`;
  if (segment === "insurance") return `${label} · Insurance`;
  if (segment === "stocks") {
    const marketLabel = market === "us" ? "US" : "IN";
    return `${label} · Stocks (${marketLabel})`;
  }
  return label;
}

export function stockViewFromMarket(
  market: string | undefined,
  owner: WealthOwnerSlug,
): "in" | "us" {
  if (market === "us" && owner === "mine") return "us";
  return "in";
}
