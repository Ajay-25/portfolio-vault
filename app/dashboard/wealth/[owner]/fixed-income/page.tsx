import { notFound } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { FixedIncomeView } from "@/components/dashboard/fixed-income-view";
import { WealthSubNav } from "@/components/dashboard/wealth-sub-nav";
import { getFixedIncomePageData } from "@/lib/fixed-income-data";
import {
  resolveOwner,
  wealthTopBarTitle,
  type WealthOwnerSlug,
} from "@/lib/wealth-config";

export const revalidate = 300;

export default async function WealthFixedIncomePage({
  params,
}: {
  params: Promise<{ owner: string }>;
}) {
  const { owner: ownerSlug } = await params;
  const owner = resolveOwner(ownerSlug);
  if (!owner) notFound();

  const data = await getFixedIncomePageData(ownerSlug);
  if (!data) notFound();

  const slug = owner.slug as WealthOwnerSlug;

  return (
    <div className="min-w-0 overflow-x-hidden">
      <TopBar title={wealthTopBarTitle(slug, "fixed-income")} />
      <main className="min-w-0 p-4 md:p-6">
        <WealthSubNav owner={slug} />
        <FixedIncomeView data={data} />
      </main>
    </div>
  );
}
