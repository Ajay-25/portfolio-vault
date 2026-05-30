import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listGeminiModels } from "@/lib/agent/models";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 503 });
  }

  const models = await listGeminiModels(apiKey);
  return NextResponse.json({ models });
}
