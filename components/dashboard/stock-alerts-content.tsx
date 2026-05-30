import { StockAlertsView } from "@/components/dashboard/stock-alerts-view";
import { getAlertsPageData } from "@/lib/alerts";

/** Heavy: Yahoo Finance price fetch per holding + per alert */
export async function StockAlertsContent() {
  const data = await getAlertsPageData();
  return <StockAlertsView data={data} />;
}
