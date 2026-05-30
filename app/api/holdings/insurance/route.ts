import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const DATE_FIELDS = [
  "startDate",
  "premiumEndDate",
  "policyEndDate",
  "nextPremiumDate",
  "fundValueAsOf",
] as const;

function parseDates<T extends Record<string, unknown>>(raw: T): T {
  const data = { ...raw };
  for (const key of DATE_FIELDS) {
    if (key in data && data[key] !== undefined) {
      const val = data[key];
      (data as Record<string, unknown>)[key] =
        val === null || val === "" ? null : new Date(val as string);
    }
  }
  return data;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const portfolioId = req.nextUrl.searchParams.get("portfolioId");
  const policies = await prisma.insurancePolicy.findMany({
    where: portfolioId ? { portfolioId } : undefined,
    orderBy: { type: "asc" },
  });
  return NextResponse.json(policies);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = parseDates(await req.json());
  const policy = await prisma.insurancePolicy.create({ data: body });
  return NextResponse.json(policy, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ...raw } = await req.json();
  const data = parseDates(raw);
  const policy = await prisma.insurancePolicy.update({ where: { id }, data });
  return NextResponse.json(policy);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  await prisma.insurancePolicy.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
