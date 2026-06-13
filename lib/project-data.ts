import { prisma } from "@/lib/prisma";
import { BUILDER_PAYMENT_STREAM_IDS } from "@/lib/nav-config";

export async function getHomeProject(id = "project-home") {
  return prisma.project.findUnique({
    where: { id },
    include: {
      workStreams: {
        orderBy: { sortOrder: "asc" },
        include: {
          lineItems:    { include: { transactions: true } },
          transactions: true,
        },
      },
      payers: {
        include: {
          transactions: true,
          advances:     { include: { transactions: true } },
        },
      },
      deductions: true,
      transactions: {
        include: { payer: true, workStream: true, lineItem: true },
        orderBy:  { date: "desc" },
      },
    },
  });
}

export type HomeProject = NonNullable<Awaited<ReturnType<typeof getHomeProject>>>;

function signedAmount(amount: number, direction: string): number {
  return direction === "refund" ? -amount : amount;
}

export function computeProjectStats(project: HomeProject) {
  const txns = project.transactions;

  const totalSpent = txns
    .filter((t) => t.direction === "outflow")
    .reduce((s, t) => s + t.amount, 0);

  const streamTotals = project.workStreams.map((ws) => {
    const wsTotal = ws.transactions
      .filter((t) => t.direction === "outflow")
      .reduce((s, t) => s + t.amount, 0);
    return {
      id:            ws.id,
      name:          ws.name,
      icon:          ws.icon,
      category:      ws.category,
      status:        ws.status,
      total:         wsTotal,
      txnCount:      ws.transactions.length,
      lineItemCount: ws.lineItems.length,
    };
  });

  const payerBalances = project.payers
    .filter((p) => !p.isSelf)
    .map((p) => {
      const repayable = p.transactions
        .filter((t) => t.settlementType === "repayable")
        .reduce((s, t) => s + signedAmount(t.amount, t.direction), 0);
      const gifted = p.transactions
        .filter((t) => t.settlementType === "gift" && t.direction === "outflow")
        .reduce((s, t) => s + t.amount, 0);
      const totalPaid = p.transactions
        .filter((t) => t.direction === "outflow")
        .reduce((s, t) => s + t.amount, 0);
      return {
        id:           p.id,
        name:         p.name,
        relationship: p.relationship,
        owedBack:     Math.max(0, repayable),
        gifted,
        totalPaid,
      };
    });

  const totalOwed = payerBalances.reduce((s, p) => s + p.owedBack, 0);

  const deductionEstimate = project.deductions.reduce(
    (s, d) =>
      s + (d.isConfirmed && d.confirmedAmount != null ? d.confirmedAmount : d.estimatedAmount),
    0,
  );
  const deductionConfirmed = project.deductions
    .filter((d) => d.isConfirmed)
    .reduce((s, d) => s + (d.confirmedAmount ?? d.estimatedAmount), 0);

  const ownSpend = txns
    .filter((t) => t.settlementType === "self" && t.direction === "outflow")
    .reduce((s, t) => s + t.amount, 0);

  return {
    totalSpent,
    ownSpend,
    streamTotals,
    payerBalances,
    totalOwed,
    deductionEstimate,
    deductionConfirmed,
    deductionPending: project.deductions.filter((d) => !d.isConfirmed).length,
  };
}

export function getBuilderPaymentStreams(project: HomeProject) {
  return project.workStreams.filter((ws) =>
    (BUILDER_PAYMENT_STREAM_IDS as readonly string[]).includes(ws.id),
  );
}

export function computeBuilderPaymentStats(project: HomeProject) {
  const streams = getBuilderPaymentStreams(project);
  const streamIds = new Set(streams.map((s) => s.id));

  const transactions = project.transactions.filter(
    (t) => t.workStreamId && streamIds.has(t.workStreamId),
  );

  const totalPaid = transactions
    .filter((t) => t.direction === "outflow")
    .reduce((s, t) => s + t.amount, 0);

  const byStream = streams.map((ws) => {
    const wsTxns = ws.transactions;
    const paid = wsTxns
      .filter((t) => t.direction === "outflow")
      .reduce((s, t) => s + t.amount, 0);
    return {
      id:       ws.id,
      name:     ws.name,
      category: ws.category,
      status:   ws.status,
      paid,
      txnCount: wsTxns.length,
      budgetEst: ws.budgetEst,
    };
  });

  return { totalPaid, byStream, transactions };
}

export async function listProjects() {
  return prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { transactions: true, workStreams: true } },
    },
  });
}
