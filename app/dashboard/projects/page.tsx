import Link from "next/link";
import { listProjects } from "@/lib/project-data";
import { TopBar } from "@/components/layout/top-bar";

export const revalidate = 0;

export default async function ProjectsListPage() {
  const projects = await listProjects();

  return (
    <div>
      <TopBar title="Projects" />
      <main className="min-w-0 space-y-4 p-4 md:p-6">
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/dashboard/projects/${p.id}`}
            className="card block p-5 hover:border-gold-500 transition-colors"
            style={{ textDecoration: "none" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium" style={{ color: "var(--text)" }}>{p.name}</div>
                {p.description && (
                  <div className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>{p.description}</div>
                )}
                {p.address && (
                  <div className="font-mono text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                    {p.address}
                  </div>
                )}
              </div>
              <span className={`badge ${p.status === "ongoing" ? "badge-blue" : "badge-teal"}`}>
                {p.status}
              </span>
            </div>
            <div className="font-mono text-[10px] mt-3" style={{ color: "var(--text-muted)" }}>
              {p._count.workStreams} work streams · {p._count.transactions} transactions
            </div>
          </Link>
        ))}
        {projects.length === 0 && (
          <div className="card p-8 text-center text-sm" style={{ color: "var(--text-dim)" }}>
            No projects yet.
          </div>
        )}
      </main>
    </div>
  );
}
