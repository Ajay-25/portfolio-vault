import { TopBar } from "@/components/layout/top-bar";

interface ComingSoonPageProps {
  tag: string;
  title: string;
  titleAccent?: string;
  description: string;
}

export function ComingSoonPage({
  tag,
  title,
  titleAccent,
  description,
}: ComingSoonPageProps) {
  return (
    <div>
      <TopBar title={`${tag} · ${title}`} />
      <main className="p-6">
        <div
          className="font-mono text-[10px] tracking-[0.25em] uppercase mb-1.5"
          style={{ color: "var(--text-muted)" }}
        >
          {tag}
        </div>
        <h1
          className="font-display text-3xl font-normal leading-tight mb-6"
          style={{ color: "var(--text)" }}
        >
          {title}
          {titleAccent && (
            <>
              {" "}
              <em style={{ color: "var(--gold)" }}>{titleAccent}</em>
            </>
          )}
        </h1>

        <div className="card max-w-xl" style={{ padding: "24px" }}>
          <div className="stat-label mb-2">Coming soon</div>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-dim)" }}>
            {description}
          </p>
        </div>
      </main>
    </div>
  );
}
