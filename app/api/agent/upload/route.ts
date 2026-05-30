import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { parseSpreadsheetBuffer, isAllowedSpreadsheet } from "@/lib/agent/parse-spreadsheet";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/** POST /api/agent/upload — multipart form field "file" */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 400 });
  }

  if (!isAllowedSpreadsheet(file.name, file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type. Use .xlsx, .xls, or .csv" },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseSpreadsheetBuffer(buffer, file.name, file.type || "application/octet-stream");

    return NextResponse.json({
      fileName:   parsed.fileName,
      mimeType:   parsed.mimeType,
      sheets:     parsed.sheets,
      rowCount:   parsed.rowCount,
      parsedText: parsed.parsedText,
      truncated:  parsed.truncated,
      preview:    parsed.parsedText.slice(0, 400),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to parse file";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
