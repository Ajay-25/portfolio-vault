import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Handles both JSON API calls and form submissions
  const contentType = req.headers.get("content-type") ?? "";
  let portfolioId: string, totalValue: number, totalInvested: number, dateStr: string;

  if (contentType.includes("application/json")) {
    const body    = await req.json();
    portfolioId   = body.portfolioId;
    totalValue    = parseFloat(body.totalValue);
    totalInvested = parseFloat(body.totalInvested);
    dateStr       = body.date;
  } else {
    // Form submission
    const form    = await req.formData();
    portfolioId   = form.get("portfolioId") as string;
    totalValue    = parseFloat(form.get("totalValue") as string);
    totalInvested = parseFloat(form.get("totalInvested") as string);
    dateStr       = form.get("date") as string;
  }

  if (!portfolioId || isNaN(totalValue) || isNaN(totalInvested)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const date = new Date(dateStr);

  const snapshot = await prisma.snapshot.upsert({
    where:  { portfolioId_date: { portfolioId, date } },
    update: { totalValue, totalInvested },
    create: { portfolioId, date, totalValue, totalInvested },
  });

  if (contentType.includes("application/json")) {
    return NextResponse.json(snapshot, { status: 201 });
  }

  // Form submission — redirect back to history
  redirect("/dashboard/history");
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const portfolioId = req.nextUrl.searchParams.get("portfolioId");
  const snapshots   = await prisma.snapshot.findMany({
    where:   portfolioId ? { portfolioId } : undefined,
    orderBy: { date: "desc" },
    take:    36,
  });

  return NextResponse.json(snapshots);
}
