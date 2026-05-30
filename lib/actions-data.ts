import { prisma } from "@/lib/prisma";

export type ActionItemRow = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: string;
  completed: boolean;
};

export type ActionItemsData = {
  immediate: ActionItemRow[];
  pending: ActionItemRow[];
  longterm: ActionItemRow[];
  openCount: number;
};

function formatDueDate(date: Date | null): string | null {
  if (!date) return null;
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function mapItem(item: {
  id: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
  priority: string;
  completed: boolean;
}): ActionItemRow {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    dueDate: formatDueDate(item.dueDate),
    priority: item.priority,
    completed: item.completed,
  };
}

export async function getActionItemsData(): Promise<ActionItemsData> {
  const items = await prisma.actionItem.findMany({
    where: { ownerId: "primary", completed: false },
    orderBy: [{ bucket: "asc" }, { priority: "asc" }, { createdAt: "asc" }],
  });

  const immediate = items.filter((i) => i.bucket === "immediate").map(mapItem);
  const pending = items.filter((i) => i.bucket === "pending").map(mapItem);
  const longterm = items.filter((i) => i.bucket === "longterm").map(mapItem);

  return {
    immediate,
    pending,
    longterm,
    openCount: items.length,
  };
}

export const BUCKET_ICONS: Record<string, string> = {
  immediate: "⏰",
  pending: "📦",
  longterm: "🗓️",
};

export function priorityIcon(priority: string, completed: boolean): string {
  if (completed) return "✅";
  if (priority === "high") return "🔴";
  if (priority === "medium") return "📈";
  return "🗓️";
}
