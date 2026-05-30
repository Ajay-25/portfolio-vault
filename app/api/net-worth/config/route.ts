import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { NetWorthConfigInput } from "@/lib/net-worth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await prisma.netWorthConfig.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });

  return NextResponse.json(config);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as Partial<NetWorthConfigInput>;

  const config = await prisma.netWorthConfig.upsert({
    where: { id: "default" },
    update: {
      ...(body.indianStocks !== undefined && { indianStocks: body.indianStocks }),
    },
    create: {
      id: "default",
      indianStocks: body.indianStocks ?? 0,
    },
  });

  return NextResponse.json(config);
}
