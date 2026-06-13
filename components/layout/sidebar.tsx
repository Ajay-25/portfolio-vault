"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  NAV_SECTIONS,
  navItemIsActive,
  sectionHasActiveItem,
  type NavItem,
  type NavSection,
} from "@/lib/nav-config";
import { useSidebar } from "@/components/layout/sidebar-context";
import { RefreshNAVsButton } from "@/components/layout/refresh-navs-button";
import { ThemeSelector } from "@/components/layout/theme-selector";

const STORAGE_KEY = "vault-nav-sections-expanded";

function readStoredExpanded(): Set<string> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return null;
  }
}

function defaultExpandedSections(pathname: string, search: string): Set<string> {
  const expanded = new Set<string>();
  const first = NAV_SECTIONS[0]?.section;
  if (first) expanded.add(first);
  for (const group of NAV_SECTIONS) {
    if (sectionHasActiveItem(group, pathname, search)) {
      expanded.add(group.section);
    }
  }
  return expanded;
}

function NavLink({
  item,
  pathname,
  search,
  depth,
  onNavigate,
}: {
  item:       NavItem;
  pathname:   string;
  search:     string;
  depth:      number;
  onNavigate: () => void;
}) {
  const isActive = navItemIsActive(item, pathname, search);
  const paddingLeft = depth === 0 ? (isActive ? 16 : 18) : 18 + depth * 14;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className="flex items-center gap-2.5 py-2 transition-all duration-150"
      style={{
        paddingLeft,
        paddingRight: "18px",
        fontSize:     depth > 0 ? "12px" : "12.5px",
        color:        isActive ? "var(--gold-l)" : "var(--text-dim)",
        background:   isActive ? "var(--bg-2)" : "transparent",
        borderLeft:   isActive ? "2px solid var(--gold)" : "2px solid transparent",
      }}
      onMouseEnter={(e) => {
        if (isActive) return;
        e.currentTarget.style.background = "var(--bg-2)";
        e.currentTarget.style.color = "var(--text)";
      }}
      onMouseLeave={(e) => {
        if (isActive) return;
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "var(--text-dim)";
      }}
    >
      <span className="font-mono text-sm w-[18px] text-center flex-shrink-0">
        {item.icon}
      </span>
      <span className="font-sans">{item.label}</span>
    </Link>
  );
}

function NavItemTree({
  item,
  pathname,
  search,
  depth,
  onNavigate,
}: {
  item:       NavItem;
  pathname:   string;
  search:     string;
  depth:      number;
  onNavigate: () => void;
}) {
  return (
    <div>
      <NavLink
        item={item}
        pathname={pathname}
        search={search}
        depth={depth}
        onNavigate={onNavigate}
      />
      {item.children?.map((child) => (
        <NavLink
          key={child.href}
          item={child}
          pathname={pathname}
          search={search}
          depth={depth + 1}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}

function CollapsibleSection({
  group,
  expanded,
  onToggle,
  pathname,
  search,
  onNavigate,
}: {
  group:      NavSection;
  expanded:   boolean;
  onToggle:   () => void;
  pathname:   string;
  search:     string;
  onNavigate: () => void;
}) {
  const hasActive = sectionHasActiveItem(group, pathname, search);

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-1.5 px-3 pt-2 pb-1 text-left transition-colors"
        style={{ color: hasActive ? "var(--gold-l)" : "var(--text-muted)" }}
      >
        <span
          className="font-mono text-[8px] w-3 flex-shrink-0 transition-transform duration-200"
          style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
        >
          ▶
        </span>
        <span className="font-mono text-[9px] tracking-[0.15em] uppercase flex-1">
          {group.section}
        </span>
      </button>

      {expanded && (
        <div className="pb-1">
          {group.items.map((item) => (
            <NavItemTree
              key={item.href}
              item={item}
              pathname={pathname}
              search={search}
              depth={0}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const { isOpen, close } = useSidebar();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString()
    ? `?${searchParams.toString()}`
    : "";

  const [expandedSections, setExpandedSections] = useState<Set<string>>(() =>
    defaultExpandedSections(pathname, search),
  );

  useEffect(() => {
    const stored = readStoredExpanded();
    const active = defaultExpandedSections(pathname, search);
    if (stored) {
      setExpandedSections(new Set([...stored, ...active]));
      return;
    }
    setExpandedSections(active);
  }, []);

  useEffect(() => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      for (const group of NAV_SECTIONS) {
        if (sectionHasActiveItem(group, pathname, search)) {
          next.add(group.section);
        }
      }
      return next;
    });
  }, [pathname, search]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...expandedSections]));
  }, [expandedSections]);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedSections(new Set(NAV_SECTIONS.map((g) => g.section)));
  }, []);

  const collapseAll = useCallback(() => {
    const first = NAV_SECTIONS[0]?.section;
    setExpandedSections(first ? new Set([first]) : new Set());
  }, []);

  const allExpanded = useMemo(
    () => NAV_SECTIONS.every((g) => expandedSections.has(g.section)),
    [expandedSections],
  );

  return (
    <>
      {isOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          aria-label="Close menu"
          onClick={close}
        />
      ) : null}

      <aside
        className={`fixed left-0 top-0 bottom-0 z-50 flex w-[220px] flex-col overflow-y-auto transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          background: "var(--sidebar-bg, var(--bg-1))",
          borderRight: "1px solid var(--border)",
        }}
      >
        <div
          className="relative px-[18px] pt-5 pb-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <button
            type="button"
            className="absolute right-3 top-5 flex h-8 w-8 items-center justify-center rounded-md md:hidden"
            style={{
              color:      "var(--text-dim)",
              border:     "1px solid var(--border)",
              background: "var(--bg-2)",
            }}
            aria-label="Close menu"
            onClick={close}
          >
            <span className="font-mono text-sm leading-none">✕</span>
          </button>
          <div
            className="font-mono text-[11px] tracking-[0.2em] uppercase mb-0.5"
            style={{ color: "var(--gold)" }}
          >
            ⟁ Command Centre
          </div>
          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Vault · Portfolio v2
          </div>
        </div>

        <nav className="flex-1 py-1">
          {NAV_SECTIONS.map((group) => (
            <CollapsibleSection
              key={group.section}
              group={group}
              expanded={expandedSections.has(group.section)}
              onToggle={() => toggleSection(group.section)}
              pathname={pathname}
              search={search}
              onNavigate={close}
            />
          ))}
        </nav>

        <div
          className="px-3 py-2"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <button
            type="button"
            onClick={allExpanded ? collapseAll : expandAll}
            className="w-full py-1.5 rounded font-mono text-[10px] transition-colors"
            style={{
              color:      "var(--text-muted)",
              background: "var(--bg-2)",
              border:     "1px solid var(--border)",
            }}
          >
            {allExpanded ? "Collapse all sections" : "Expand all sections"}
          </button>
        </div>

        <div
          className="px-4 py-3.5 mt-auto"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <RefreshNAVsButton />
          <div
            className="font-mono text-[10px] text-center mt-1"
            style={{ color: "var(--text-muted)" }}
          >
            Auto: 7PM IST weekdays
          </div>

          <div
            className="px-3 pb-1 font-mono text-[9px] tracking-[0.15em] uppercase mt-3"
            style={{ color: "var(--text-muted)" }}
          >
            Theme
          </div>
          <ThemeSelector />
          <div style={{ height: "4px" }} />

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm transition-all duration-150"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(245,56,89,0.06)";
              e.currentTarget.style.color = "var(--red)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            <span className="font-mono text-base">⏻</span>
            <span className="font-sans text-[13px]">Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
