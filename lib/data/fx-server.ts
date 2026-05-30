import { cache } from "react";
import { fetchUSDINR } from "@/lib/apis/prices";

/**
 * React.cache() ensures USD/INR is fetched at most once per request,
 * even if dashboard, wealth summary, and stocks page all need it.
 */
export const getUSDINR = cache(fetchUSDINR);
