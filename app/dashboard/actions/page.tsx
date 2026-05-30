import { TopBar } from "@/components/layout/top-bar";
import { ActionItemsView } from "@/components/dashboard/action-items-view";
import { getActionItemsData } from "@/lib/actions-data";

export const revalidate = 0;

export default async function ActionsPage() {
  const data = await getActionItemsData();

  return (
    <div>
      <TopBar title="Planning · Action Items" />
      <main className="p-6">
        <div
          className="font-mono text-[10px] tracking-[0.25em] uppercase mb-1.5"
          style={{ color: "var(--text-muted)" }}
        >
          To-Do
        </div>
        <h1
          className="font-display text-3xl font-normal leading-tight mb-6 animate-slide-up"
          style={{ color: "var(--text)" }}
        >
          Action <em style={{ color: "var(--gold)" }}>items tracker</em>
        </h1>

        <ActionItemsView data={data} />
      </main>
    </div>
  );
}
