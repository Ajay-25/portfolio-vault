import { isActiveWealthNav, wealthPath, type WealthOwnerSlug } from "@/lib/wealth-config";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** Nested items rendered indented under this entry */
  children?: NavItem[];
  /** Returns true when this nav item should appear active */
  isActive?: (pathname: string, search: string) => boolean;
}

export interface NavSection {
  section: string;
  items: NavItem[];
}

function wealthNavActive(
  pathname: string,
  search: string,
  owner: WealthOwnerSlug,
  segment: "" | "mf" | "stocks" | "fixed-income" | "insurance",
): boolean {
  return isActiveWealthNav(pathname, search, owner, segment);
}

export const NAV_SECTIONS: NavSection[] = [
  {
    section: "Overview",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: "⊞",
        isActive: (pathname) => pathname === "/dashboard",
      },
      {
        href: "/dashboard/net-worth",
        label: "Net Worth",
        icon: "◈",
      },
      {
        href: "/dashboard/insurance",
        label: "Insurance overview",
        icon: "⊕",
        isActive: (pathname) => pathname === "/dashboard/insurance",
      },
      {
        href: "/dashboard/goal",
        label: "Goal Tracker",
        icon: "◎",
      },
    ],
  },
  {
    section: "Expenses",
    items: [
      {
        href: "/dashboard/projects",
        label: "Project",
        icon: "◫",
        isActive: (pathname) => pathname === "/dashboard/projects",
        children: [
          {
            href: "/dashboard/projects/project-home",
            label: "Home",
            icon: "⌂",
            isActive: (pathname) =>
              pathname.startsWith("/dashboard/projects/project-home"),
          },
        ],
      },
    ],
  },
  {
    section: "My wealth",
    items: [
      {
        href: wealthPath("mine"),
        label: "Summary",
        icon: "◈",
        isActive: (pathname, search) => wealthNavActive(pathname, search, "mine", ""),
      },
      {
        href: wealthPath("mine", "mf"),
        label: "MF",
        icon: "◉",
        isActive: (pathname, search) => wealthNavActive(pathname, search, "mine", "mf"),
      },
      {
        href: `${wealthPath("mine", "stocks")}?market=in`,
        label: "Stocks",
        icon: "◐",
        isActive: (pathname, search) => wealthNavActive(pathname, search, "mine", "stocks"),
      },
      {
        href: wealthPath("mine", "fixed-income"),
        label: "Fixed income",
        icon: "◫",
        isActive: (pathname, search) =>
          wealthNavActive(pathname, search, "mine", "fixed-income"),
      },
      {
        href: wealthPath("mine", "insurance"),
        label: "Insurance",
        icon: "⊕",
        isActive: (pathname, search) =>
          wealthNavActive(pathname, search, "mine", "insurance"),
      },
    ],
  },
  {
    section: "Mother's wealth",
    items: [
      {
        href: wealthPath("mother"),
        label: "Summary",
        icon: "◇",
        isActive: (pathname, search) => wealthNavActive(pathname, search, "mother", ""),
      },
      {
        href: wealthPath("mother", "mf"),
        label: "MF",
        icon: "◉",
        isActive: (pathname, search) => wealthNavActive(pathname, search, "mother", "mf"),
      },
      {
        href: `${wealthPath("mother", "stocks")}?market=in`,
        label: "Stocks",
        icon: "◐",
        isActive: (pathname, search) =>
          wealthNavActive(pathname, search, "mother", "stocks"),
      },
      {
        href: wealthPath("mother", "fixed-income"),
        label: "Fixed income",
        icon: "◫",
        isActive: (pathname, search) =>
          wealthNavActive(pathname, search, "mother", "fixed-income"),
      },
      {
        href: wealthPath("mother", "insurance"),
        label: "Insurance",
        icon: "⊕",
        isActive: (pathname, search) =>
          wealthNavActive(pathname, search, "mother", "insurance"),
      },
    ],
  },
  {
    section: "Analytics",
    items: [
      {
        href: "/dashboard/calculators?tab=stepup",
        label: "SIP Step-Up Plan",
        icon: "↗",
        isActive: (pathname, search) => {
          if (pathname !== "/dashboard/calculators") return false;
          return new URLSearchParams(search).get("tab") === "stepup";
        },
      },
      {
        href: "/dashboard/calculators?tab=xirr",
        label: "XIRR Calculator",
        icon: "%",
        isActive: (pathname, search) => {
          if (pathname !== "/dashboard/calculators") return false;
          const tab = new URLSearchParams(search).get("tab");
          return tab === "xirr" || tab === null;
        },
      },
      {
        href: "/dashboard/history",
        label: "Portfolio History",
        icon: "~",
      },
      {
        href: "/dashboard/alerts",
        label: "Stock Alerts",
        icon: "◌",
      },
    ],
  },
  {
    section: "Planning",
    items: [
      {
        href: "/dashboard/actions",
        label: "Action Items",
        icon: "✓",
      },
      {
        href: "/dashboard/tax",
        label: "Tax Tracker",
        icon: "⊙",
      },
      {
        href: "/dashboard/settings",
        label: "Settings",
        icon: "⚙",
      },
    ],
  },
];

/** Work stream IDs used for flat purchase / builder payment tracking */
export const BUILDER_PAYMENT_STREAM_IDS = ["ws-flat", "ws-loan", "ws-fees"] as const;

export function navItemIsActive(
  item: NavItem,
  pathname: string,
  search: string,
): boolean {
  if (item.isActive?.(pathname, search)) return true;
  if (item.children?.some((child) => navItemIsActive(child, pathname, search))) {
    return true;
  }
  const [hrefPath, hrefQuery] = item.href.split("?");
  if (pathname !== hrefPath) return false;
  if (!hrefQuery) return search === "" || search === "?";
  const expected = new URLSearchParams(hrefQuery);
  const actual = new URLSearchParams(search.replace(/^\?/, ""));
  for (const [key, value] of expected.entries()) {
    if (actual.get(key) !== value) return false;
  }
  return true;
}

export function sectionHasActiveItem(
  section: NavSection,
  pathname: string,
  search: string,
): boolean {
  return section.items.some((item) => navItemIsActive(item, pathname, search));
}

export function flattenNavItems(items: NavItem[]): NavItem[] {
  return items.flatMap((item) => [item, ...(item.children ? flattenNavItems(item.children) : [])]);
}
