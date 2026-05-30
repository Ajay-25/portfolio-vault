import { NetWorthView } from "@/components/dashboard/net-worth-view";
import { getNetWorthData } from "@/lib/net-worth";

/** Heavy: all portfolios + bulk NAVs + FX + fixed income + insurance */
export async function NetWorthContent() {
  const data = await getNetWorthData();
  return <NetWorthView initial={data} />;
}
