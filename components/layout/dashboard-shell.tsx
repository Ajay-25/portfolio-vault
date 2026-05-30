"use client";

import { Suspense } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { SidebarProvider } from "@/components/layout/sidebar-context";

function SidebarFallback() {
  return (
    <aside
      className="fixed left-0 top-0 bottom-0 z-50 w-[220px] -translate-x-full md:translate-x-0"
      style={{
        background: "var(--bg-1)",
        borderRight: "1px solid var(--border)",
      }}
    />
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen" style={{ background: "var(--bg)" }}>
        <Suspense fallback={<SidebarFallback />}>
          <Sidebar />
        </Suspense>

        <div className="min-w-0 overflow-x-hidden md:ml-[220px]">{children}</div>
      </div>
    </SidebarProvider>
  );
}
