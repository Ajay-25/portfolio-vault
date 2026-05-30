import { redirect } from "next/navigation";

const PORTFOLIO_REDIRECTS: Record<string, Record<string, string>> = {
  "portfolio-primary": {
    mf: "/dashboard/wealth/mine/mf",
    us: "/dashboard/wealth/mine/stocks?market=us",
    in: "/dashboard/wealth/mine/stocks?market=in",
    default: "/dashboard/wealth/mine",
  },
  "portfolio-mom": {
    default: "/dashboard/wealth/mother",
    mf: "/dashboard/wealth/mother/mf",
  },
};

export default async function PortfolioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { id } = await params;
  const { view } = await searchParams;

  const routes = PORTFOLIO_REDIRECTS[id];
  if (!routes) {
    redirect("/dashboard");
  }

  const target =
    (view && routes[view]) || routes.default;
  redirect(target);
}
