import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const triggers: { id: string; niftyLevel: number; deployAmount: number }[] =
    body.triggers ?? [];

  if (!Array.isArray(triggers) || triggers.length === 0) {
    return NextResponse.json({ error: "triggers array required" }, { status: 400 });
  }

  const updated = await Promise.all(
    triggers.map((t) =>
      prisma.trigger.update({
        where: { id: t.id },
        data: {
          niftyLevel: t.niftyLevel,
          deployAmount: t.deployAmount,
        },
      }),
    ),
  );

  return NextResponse.json(updated);
}
