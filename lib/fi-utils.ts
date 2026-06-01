import type { FIHolding } from "@/lib/fixed-income-data";
import { fiValue } from "@/lib/fixed-income-data";

export function daysUntil(date: Date | null | undefined): number | null {
  if (!date) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

export function formatFIDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function maturityColor(daysLeft: number | null): string {
  if (daysLeft == null) return "var(--text-muted)";
  if (daysLeft < 30) return "var(--red)";
  if (daysLeft < 90) return "var(--orange)";
  return "var(--teal)";
}

export function maturityBarColor(daysLeft: number | null): string {
  if (daysLeft == null) return "var(--border)";
  if (daysLeft < 30) return "#E24B4A";
  if (daysLeft < 90) return "#EF9F27";
  return "#1D9E75";
}

export function typeBadgeClass(type: string): string {
  switch (type) {
    case "ppf":
    case "bond":
    case "nsc":
      return "badge-blue";
    case "epf":
    case "scss":
      return "badge-purple";
    case "nps_tier1":
    case "nps_tier2":
      return "badge-gold";
    case "fd":
    case "rd":
      return "badge-teal";
    case "liquid":
    case "sweep_fd":
      return "badge-muted";
    default:
      return "badge-muted";
  }
}

export function ratingBadgeClass(rating: string | null | undefined): string {
  if (!rating) return "badge-muted";
  const r = rating.toLowerCase();
  if (r.includes("sovereign")) return "badge-teal";
  if (r.startsWith("aaa")) return "badge-teal";
  if (r.startsWith("aa+")) return "badge-teal";
  if (r.startsWith("aa")) return "badge-gold";
  if (r.startsWith("a")) return "badge-orange";
  return "badge-red";
}

export function maskAccount(value: string | null | undefined): string {
  if (!value) return "—";
  if (value.length <= 4) return value;
  return `${"•".repeat(Math.min(8, value.length - 4))}${value.slice(-4)}`;
}

export function ppfProgress(h: FIHolding) {
  if (!h.startDate) return { yearsCompleted: 0, totalYears: 15, pct: 0 };
  const yearsCompleted = Math.floor(
    (Date.now() - h.startDate.getTime()) / (365.25 * 86400000),
  );
  const totalYears = 15 + (h.extensionCount ?? 0) * 5;
  const pct = Math.min(100, Math.round((yearsCompleted / totalYears) * 100));
  return { yearsCompleted, totalYears, pct };
}

export function epfSplitPct(h: FIHolding): number {
  const emp = h.employeeMonthly ?? 0;
  const er = h.employerMonthly ?? 0;
  if (emp + er === 0) return 60;
  return Math.round((emp / (emp + er)) * 100);
}

export function fdTenureProgress(h: FIHolding): number {
  if (!h.startDate || !h.maturityDate) return 0;
  const total = h.maturityDate.getTime() - h.startDate.getTime();
  const elapsed = Date.now() - h.startDate.getTime();
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
}

export function quarterlyPayout(h: FIHolding): number {
  return Math.round((fiValue(h) * (h.rate ?? 0)) / 100 / 4);
}

export function typeLabel(type: string): string {
  return type.replace(/_/g, " ").toUpperCase();
}
