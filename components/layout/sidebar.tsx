"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { NAV_SECTIONS, navItemIsActive } from "@/lib/nav-config";
import { useSidebar } from "@/components/layout/sidebar-context";
import { RefreshNAVsButton } from "@/components/layout/refresh-navs-button";
import { ThemeSelector } from "@/components/layout/theme-selector";

export function Sidebar() {
  const { isOpen, close } = useSidebar();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString()
    ? `?${searchParams.toString()}`
    : "";

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
      {/* Logo */}
      <div
        className="relative px-[18px] pt-5 pb-4"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <button
          type="button"
          className="absolute right-3 top-5 flex h-8 w-8 items-center justify-center rounded-md md:hidden"
          style={{
            color: "var(--text-dim)",
            border: "1px solid var(--border)",
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

      {/* Nav */}
      <nav className="flex-1 py-1">
        {NAV_SECTIONS.map((group) => (
          <div key={group.section}>
            <div
              className="px-3 pt-2 pb-1 font-mono text-[9px] tracking-[0.15em] uppercase"
              style={{ color: "var(--text-muted)" }}
            >
              {group.section}
            </div>
            {group.items.map((item) => {
              const isActive = navItemIsActive(item, pathname, search);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={close}
                  className="flex items-center gap-2.5 py-2 transition-all duration-150"
                  style={{
                    paddingLeft: isActive ? "16px" : "18px",
                    paddingRight: "18px",
                    fontSize: "12.5px",
                    color: isActive ? "var(--gold-l)" : "var(--text-dim)",
                    background: isActive ? "var(--bg-2)" : "transparent",
                    borderLeft: isActive
                      ? "2px solid var(--gold)"
                      : "2px solid transparent",
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
                  <span
                    className="font-mono text-sm w-[18px] text-center flex-shrink-0"
                  >
                    {item.icon}
                  </span>
                  <span className="font-sans">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
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
