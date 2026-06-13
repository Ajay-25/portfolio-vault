import { prisma } from "@/lib/prisma";
import { computeProjectStats, getHomeProject } from "@/lib/project-data";

export const HOME_PROJECT_ID = "project-home";

function inr(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

function lakhs(n: number): string {
  return `₹${(n / 100000).toFixed(2)}L`;
}

function normalizeQuery(q: string): string {
  return q
    .toLowerCase()
    .replace(/father-in-law|father in law|fil/g, "father_in_law")
    .replace(/mother-in-law|mother in law|mil/g, "mother_in_law")
    .replace(/[^\w\s]/g, " ")
    .trim();
}

function fuzzyScore(text: string, query: string): number {
  const t = normalizeQuery(text);
  const q = normalizeQuery(query);
  if (!q) return 0;
  if (t === q) return 100;
  if (t.includes(q)) return 80;
  const words = q.split(/\s+/).filter(Boolean);
  const matched = words.filter((w) => t.includes(w)).length;
  return (matched / words.length) * 60;
}

function rankMatches<T>(items: T[], query: string, getText: (item: T) => string): T[] {
  return items
    .map((item) => ({ item, score: fuzzyScore(getText(item), query) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.item);
}

async function loadProject(projectId = HOME_PROJECT_ID) {
  const project = await getHomeProject(projectId);
  if (!project) return null;
  return { project, stats: computeProjectStats(project) };
}

export async function getHomeSummaryText(projectId = HOME_PROJECT_ID): Promise<string> {
  const data = await loadProject(projectId);
  if (!data) return "Home project not found.";

  const { project, stats } = data;
  const streams = stats.streamTotals
    .filter((s) => s.total > 0)
    .map((s) => `  • ${s.name}: ${lakhs(s.total)} (${s.txnCount} txns)`)
    .join("\n");

  const payers = stats.payerBalances
    .map((p) => {
      const parts = [`owed ${inr(p.owedBack)}`];
      if (p.gifted > 0) parts.push(`gifted ${inr(p.gifted)}`);
      return `  • ${p.name}: ${parts.join(", ")}`;
    })
    .join("\n");

  return (
    `HOME PROJECT — ${project.name}\n` +
    `Total spent: ${lakhs(stats.totalSpent)} (${inr(stats.totalSpent)})\n` +
    `Own money: ${lakhs(stats.ownSpend)}\n` +
    `Owed to family: ${lakhs(stats.totalOwed)} (${inr(stats.totalOwed)})\n` +
    `Builder deductions (est.): ${lakhs(stats.deductionEstimate)}\n\n` +
    `By work stream:\n${streams || "  (none yet)"}\n\n` +
    `Payer balances:\n${payers || "  (none)"}`
  );
}

export async function getPayerBalanceText(
  payerQuery: string,
  projectId = HOME_PROJECT_ID,
): Promise<string> {
  const data = await loadProject(projectId);
  if (!data) return "Home project not found.";

  const matches = rankMatches(
    data.project.payers.filter((p) => !p.isSelf),
    payerQuery,
    (p) => `${p.name} ${p.relationship ?? ""}`,
  );

  if (matches.length === 0) {
    const names = data.project.payers.filter((p) => !p.isSelf).map((p) => p.name).join(", ");
    return `No payer matching "${payerQuery}". Known payers: ${names}`;
  }
  if (matches.length > 1) {
    return (
      `Multiple payers match "${payerQuery}":\n` +
      matches.map((p) => `  • ${p.name} (${p.relationship ?? "family"})`).join("\n") +
      "\nPlease be more specific."
    );
  }

  const payer = matches[0];
  const balance = data.stats.payerBalances.find((b) => b.id === payer.id);
  return (
    `${payer.name}: you owe ${inr(balance?.owedBack ?? 0)} (repayable). ` +
    `They gifted ${inr(balance?.gifted ?? 0)}. ` +
    `Total they paid toward the project: ${inr(balance?.totalPaid ?? 0)}.`
  );
}

export async function logHomeExpense(input: Record<string, unknown>): Promise<string> {
  const projectId = (input.project_id as string | undefined) ?? HOME_PROJECT_ID;
  const data = await loadProject(projectId);
  if (!data) return "Home project not found.";

  const { project } = data;
  const description = (input.description as string | undefined)?.trim();
  const amount = Number(input.amount);
  const workStreamQuery = (input.work_stream as string | undefined)?.trim() ?? "";
  const lineItemQuery = (input.line_item as string | undefined)?.trim();
  const paidByQuery = (input.paid_by as string | undefined)?.trim() ?? "me";
  const settlementTypeRaw = (input.settlement_type as string | undefined)?.trim();
  const phase = (input.phase as string | undefined)?.trim() || "full";
  const paymentMode = (input.payment_mode as string | undefined)?.trim() || "upi";
  const dateRaw = input.date as string | undefined;

  if (!description) return "Description is required.";
  if (!amount || amount <= 0) return "A positive amount is required.";
  if (!workStreamQuery) return "work_stream is required (e.g. Sofa, Carpentry).";

  const streamMatches = rankMatches(project.workStreams, workStreamQuery, (s) => s.name);
  if (streamMatches.length === 0) {
    return (
      `No work stream matching "${workStreamQuery}". ` +
      `Existing: ${project.workStreams.map((s) => s.name).join(", ")}. ` +
      `Ask the user if they want to create one with create_work_stream.`
    );
  }
  if (streamMatches.length > 1) {
    return (
      `Multiple work streams match "${workStreamQuery}":\n` +
      streamMatches.map((s) => `  • ${s.name}`).join("\n")
    );
  }
  const workStream = streamMatches[0];

  let lineItemId: string | null = null;
  if (lineItemQuery) {
    const itemMatches = rankMatches(workStream.lineItems, lineItemQuery, (li) => li.name);
    if (itemMatches.length === 0) {
      return `No line item matching "${lineItemQuery}" under ${workStream.name}.`;
    }
    if (itemMatches.length > 1) {
      return (
        `Multiple line items match "${lineItemQuery}":\n` +
        itemMatches.map((li) => `  • ${li.name}`).join("\n")
      );
    }
    lineItemId = itemMatches[0].id;
  }

  const payerMatches = rankMatches(project.payers, paidByQuery, (p) => `${p.name} ${p.relationship ?? ""}`);
  if (payerMatches.length === 0) {
    return `No payer matching "${paidByQuery}". Known: ${project.payers.map((p) => p.name).join(", ")}.`;
  }
  if (payerMatches.length > 1) {
    return (
      `Multiple payers match "${paidByQuery}":\n` +
      payerMatches.map((p) => `  • ${p.name}`).join("\n")
    );
  }
  const payer = payerMatches[0];

  let settlementType = settlementTypeRaw ?? (payer.isSelf ? "self" : "repayable");
  if (payer.isSelf) settlementType = "self";
  if (!["self", "repayable", "gift"].includes(settlementType)) {
    return "settlement_type must be self, repayable, or gift.";
  }

  await prisma.transaction.create({
    data: {
      projectId,
      workStreamId:   workStream.id,
      lineItemId,
      description,
      amount,
      date:           dateRaw ? new Date(dateRaw) : new Date(),
      direction:      "outflow",
      paidByPayerId:  payer.id,
      settlementType,
      phase,
      paymentMode,
    },
  });

  const updated = await loadProject(projectId);
  if (!updated) return "Logged, but could not reload totals.";

  const streamTotal = updated.stats.streamTotals.find((s) => s.id === workStream.id)?.total ?? 0;

  return (
    `Logged ${inr(amount)} — "${description}" under ${workStream.name}` +
    (lineItemId ? ` (${workStream.lineItems.find((li) => li.id === lineItemId)?.name})` : "") +
    `, paid by ${payer.name} (${settlementType}).\n` +
    `${workStream.name} total now: ${lakhs(streamTotal)}.\n` +
    `Project total spent: ${lakhs(updated.stats.totalSpent)}. ` +
    `Owed to family: ${inr(updated.stats.totalOwed)}.`
  );
}

export async function recordRepaymentText(input: Record<string, unknown>): Promise<string> {
  const projectId = (input.project_id as string | undefined) ?? HOME_PROJECT_ID;
  const payerQuery = (input.paid_by as string | undefined)?.trim() ?? (input.payer as string | undefined)?.trim() ?? "";
  const amount = Number(input.amount);

  if (!payerQuery) return "paid_by (payer name) is required.";
  if (!amount || amount <= 0) return "A positive repayment amount is required.";

  const data = await loadProject(projectId);
  if (!data) return "Home project not found.";

  const payerMatches = rankMatches(
    data.project.payers.filter((p) => !p.isSelf),
    payerQuery,
    (p) => `${p.name} ${p.relationship ?? ""}`,
  );
  if (payerMatches.length !== 1) {
    return payerMatches.length === 0
      ? `No payer matching "${payerQuery}".`
      : `Multiple payers match "${payerQuery}" — please clarify.`;
  }
  const payer = payerMatches[0];

  await prisma.transaction.create({
    data: {
      projectId,
      description:    `Repayment to ${payer.name}`,
      amount,
      date:           input.date ? new Date(input.date as string) : new Date(),
      direction:      "refund",
      paidByPayerId:  payer.id,
      settlementType: "repayable",
      phase:          "full",
      paymentMode:    (input.payment_mode as string | undefined) ?? "upi",
    },
  });

  const updated = await loadProject(projectId);
  const balance = updated?.stats.payerBalances.find((b) => b.id === payer.id);

  return (
    `Recorded repayment of ${inr(amount)} to ${payer.name}. ` +
    `Remaining owe-back: ${inr(balance?.owedBack ?? 0)}.`
  );
}

export async function addBuilderDeductionText(input: Record<string, unknown>): Promise<string> {
  const projectId = (input.project_id as string | undefined) ?? HOME_PROJECT_ID;
  const item = (input.item as string | undefined)?.trim();
  const estimatedAmount = Number(input.estimated_amount ?? input.estimatedAmount);
  const reason = (input.reason as string | undefined)?.trim();
  const selfPaidAmount = input.self_paid_amount != null ? Number(input.self_paid_amount) : undefined;

  if (!item) return "item name is required.";
  if (!estimatedAmount || estimatedAmount <= 0) return "estimated_amount is required.";

  await prisma.builderDeduction.create({
    data: {
      projectId,
      item,
      reason:          reason ?? null,
      estimatedAmount,
      selfPaidAmount:  selfPaidAmount ?? null,
      status:          "pending",
    },
  });

  const updated = await loadProject(projectId);
  return (
    `Added builder deduction: ${item} — est. ${inr(estimatedAmount)}.` +
    (updated ? `\nTotal estimated deductions: ${lakhs(updated.stats.deductionEstimate)}.` : "")
  );
}

export async function listWorkStreamsText(projectId = HOME_PROJECT_ID): Promise<string> {
  const data = await loadProject(projectId);
  if (!data) return "Home project not found.";

  const lines = data.stats.streamTotals.map(
    (s) =>
      `  • ${s.name}: ${s.total > 0 ? lakhs(s.total) : "₹0"} · ${s.txnCount} txns · ${s.lineItemCount} items · ${s.status}`,
  );
  return `Work streams (${data.project.workStreams.length}):\n${lines.join("\n")}`;
}

export async function createWorkStreamText(input: Record<string, unknown>): Promise<string> {
  const projectId = (input.project_id as string | undefined) ?? HOME_PROJECT_ID;
  const name = (input.name as string | undefined)?.trim();
  const category = (input.category as string | undefined)?.trim() || "other";
  const createIfMissing = input.create_if_missing === true || input.confirm_create === true;

  if (!name) return "name is required.";

  const project = await prisma.project.findUnique({
    where:   { id: projectId },
    include: { workStreams: true },
  });
  if (!project) return "Home project not found.";

  const existing = project.workStreams.find(
    (s) => s.name.toLowerCase() === name.toLowerCase(),
  );
  if (existing) return `Work stream "${existing.name}" already exists.`;

  const similar = rankMatches(project.workStreams, name, (s) => s.name);
  if (similar.length > 0 && !createIfMissing) {
    return (
      `No exact match for "${name}". Did you mean: ${similar.map((s) => s.name).join(", ")}? ` +
      `Call again with confirm_create:true to create "${name}".`
    );
  }

  const stream = await prisma.workStream.create({
    data: {
      projectId,
      name,
      category,
      sortOrder: project.workStreams.length + 1,
    },
  });

  return `Created work stream "${stream.name}" (${stream.category}).`;
}

export async function updateTransactionSettlementText(input: Record<string, unknown>): Promise<string> {
  const descriptionQuery = (input.description as string | undefined)?.trim() ?? (input.keyword as string | undefined)?.trim() ?? "";
  const settlementType = (input.settlement_type as string | undefined)?.trim();

  if (!descriptionQuery) return "description or keyword is required to find the transaction.";
  if (!settlementType || !["repayable", "gift", "self"].includes(settlementType)) {
    return "settlement_type must be repayable, gift, or self.";
  }

  const project = await getHomeProject(HOME_PROJECT_ID);
  if (!project) return "Home project not found.";

  const matches = rankMatches(project.transactions, descriptionQuery, (t) => t.description);
  if (matches.length !== 1) {
    return matches.length === 0
      ? `No transaction matching "${descriptionQuery}".`
      : `Multiple transactions match — please be more specific:\n${matches.map((t) => `  • ${t.description} (${inr(t.amount)})`).join("\n")}`;
  }

  const txn = matches[0];
  await prisma.transaction.update({
    where: { id: txn.id },
    data:  { settlementType },
  });

  const updated = await loadProject(HOME_PROJECT_ID);
  const payerName = project.payers.find((p) => p.id === txn.paidByPayerId)?.name ?? "payer";

  return (
    `Updated "${txn.description}" (${inr(txn.amount)}, ${payerName}) to settlement: ${settlementType}.` +
    (updated ? `\nTotal owed to family: ${inr(updated.stats.totalOwed)}.` : "")
  );
}

export async function buildHomeProjectContextBlock(): Promise<string> {
  const data = await loadProject(HOME_PROJECT_ID);
  if (!data) return "HOME PROJECT: not seeded yet.";

  const streams = data.stats.streamTotals
    .map((s) => `${s.name} ${lakhs(s.total)}`)
    .join(" · ");

  const owed = data.stats.payerBalances
    .filter((p) => p.owedBack > 0)
    .map((p) => `${p.name} ${inr(p.owedBack)}`)
    .join(", ");

  return (
    `HOME PROJECT (${data.project.name})\n` +
    `Total spent ${lakhs(data.stats.totalSpent)} · Own ${lakhs(data.stats.ownSpend)} · ` +
    `Owed ${inr(data.stats.totalOwed)}${owed ? ` (${owed})` : ""} · ` +
    `Builder deduct est. ${lakhs(data.stats.deductionEstimate)}\n` +
    `Streams: ${streams}`
  );
}
