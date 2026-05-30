"use client";

import { useRouter } from "next/navigation";
import { priorityIcon, type ActionItemRow, type ActionItemsData } from "@/lib/actions-data";

interface ActionItemsViewProps {
  data: ActionItemsData;
}

function ActionItemCard({
  icon,
  title,
  description,
  dueDate,
  completed,
  onToggle,
}: ActionItemRow & { icon: string; onToggle: () => void }) {
  return (
    <div className="action-item">
      <button
        type="button"
        onClick={onToggle}
        className="action-icon hover:opacity-70"
        title={completed ? "Mark incomplete" : "Mark complete"}
      >
        {icon}
      </button>
      <div className="action-content flex-1">
        <div
          className="text-[13px] font-semibold"
          style={{
            color: completed ? "var(--text-muted)" : "var(--text)",
            textDecoration: completed ? "line-through" : "none",
          }}
        >
          {title}
        </div>
        {description && (
          <div className="text-[11.5px] mt-0.5 leading-relaxed" style={{ color: "var(--text-dim)" }}>
            {description}
          </div>
        )}
        {dueDate && <div className="action-dl">{dueDate}</div>}
      </div>
    </div>
  );
}

function Section({
  title,
  badge,
  badgeClass,
  items,
  onToggle,
}: {
  title: string;
  badge: string;
  badgeClass: string;
  items: ActionItemRow[];
  onToggle: (id: string, completed: boolean) => void;
}) {
  return (
    <div className="card animate-slide-up">
      <div
        className="flex items-center justify-between px-[18px] py-[13px]"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
          {title}
        </div>
        <span className={`badge ${badgeClass}`}>{badge}</span>
      </div>
      <div className="px-[18px] py-2">
        {items.length === 0 ? (
          <div className="text-sm py-4 text-center" style={{ color: "var(--text-muted)" }}>
            Nothing here ✓
          </div>
        ) : (
          items.map((item) => (
            <ActionItemCard
              key={item.id}
              {...item}
              icon={priorityIcon(item.priority, item.completed)}
              onToggle={() => onToggle(item.id, !item.completed)}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function ActionItemsView({ data }: ActionItemsViewProps) {
  const router = useRouter();

  const toggleComplete = async (id: string, completed: boolean) => {
    await fetch(`/api/action-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });
    router.refresh();
  };

  return (
    <div className="space-y-5">
      <div
        className="grid gap-3.5"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}
      >
        <Section
          title="Immediate"
          badge="THIS WEEK"
          badgeClass="badge-red"
          items={data.immediate}
          onToggle={toggleComplete}
        />
        <Section
          title="Pending"
          badge="WATCH"
          badgeClass="badge-orange"
          items={data.pending}
          onToggle={toggleComplete}
        />
      </div>

      <Section
        title="Long-Term Calendar"
        badge={`${data.openCount} OPEN`}
        badgeClass="badge-muted"
        items={data.longterm}
        onToggle={toggleComplete}
      />
    </div>
  );
}
