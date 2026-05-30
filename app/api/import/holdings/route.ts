import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  VALID_PORTFOLIO_IDS,
  type ValidPortfolioId,
  type ParsedMFHolding,
  extractMFHoldingsFromCasparserJson,
  extractMFHoldingsFromCsv,
  importMFHoldings,
} from "@/lib/cas-import";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

type ImportFormat = "json" | "csv";

function invalidPortfolioResponse(portfolioIdRaw: string | null) {
  if (!VALID_PORTFOLIO_IDS.includes(portfolioIdRaw as ValidPortfolioId)) {
    return NextResponse.json({ error: "Invalid portfolioId" }, { status: 400 });
  }
  return null;
}

async function loadExistingHoldings(portfolioId: ValidPortfolioId) {
  return prisma.mFHolding.findMany({
    where: { portfolioId },
    select: { schemeCode: true, schemeName: true },
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") ?? "";

  let format: ImportFormat;
  let portfolioIdRaw: string | null;
  let jsonData: unknown;
  let csvText: string | null = null;

  if (contentType.includes("application/json")) {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    portfolioIdRaw = (body.portfolioId as string | null) ?? "portfolio-primary";

    const portfolioError = invalidPortfolioResponse(portfolioIdRaw);
    if (portfolioError) return portfolioError;

    if (Array.isArray(body.holdings)) {
      const portfolioId = portfolioIdRaw as ValidPortfolioId;
      const holdings = (body.holdings as ParsedMFHolding[]).filter(
        (h) => h && typeof h === "object" && h.schemeCode?.trim() && h.units > 0,
      );

      if (holdings.length === 0) {
        return NextResponse.json(
          { error: "At least one holding with schemeCode and units > 0 is required." },
          { status: 400 },
        );
      }

      const summary = await importMFHoldings(portfolioId, holdings);
      return NextResponse.json(summary);
    }

    format = body.format === "csv" ? "csv" : "json";

    if (format === "csv") {
      if (typeof body.csv !== "string" || !body.csv.trim()) {
        return NextResponse.json({ error: "csv field is required for CSV import" }, { status: 400 });
      }
      csvText = body.csv;
    } else if (body.data != null) {
      jsonData = body.data;
    } else {
      return NextResponse.json({ error: "data field is required for JSON import" }, { status: 400 });
    }
  } else {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }

    format = formData.get("format") === "csv" ? "csv" : "json";
    portfolioIdRaw = (formData.get("portfolioId") as string | null) ?? "portfolio-primary";

    const portfolioError = invalidPortfolioResponse(portfolioIdRaw);
    if (portfolioError) return portfolioError;

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File must be 5 MB or smaller" }, { status: 400 });
    }

    const text = await file.text();
    if (format === "csv") {
      csvText = text;
    } else {
      try {
        jsonData = JSON.parse(text) as unknown;
      } catch {
        return NextResponse.json({ error: "File must contain valid JSON" }, { status: 400 });
      }
    }
  }

  const portfolioId = portfolioIdRaw as ValidPortfolioId;
  const existingHoldings = await loadExistingHoldings(portfolioId);

  const parsed =
    format === "csv"
      ? extractMFHoldingsFromCsv(csvText ?? "")
      : extractMFHoldingsFromCasparserJson(jsonData, existingHoldings);

  if (parsed.errors.length > 0 && parsed.holdings.length === 0) {
    return NextResponse.json(
      {
        updated: 0,
        created: 0,
        skipped: 0,
        holdings: [],
        warnings: parsed.warnings,
        errors: parsed.errors,
      },
      { status: 422 },
    );
  }

  if (parsed.holdings.length === 0) {
    return NextResponse.json(
      {
        updated: 0,
        created: 0,
        skipped: 0,
        holdings: [],
        warnings: parsed.warnings,
        errors: parsed.errors.length
          ? parsed.errors
          : ["No importable mutual fund holdings found in this file."],
      },
      { status: 422 },
    );
  }

  const summary = await importMFHoldings(portfolioId, parsed.holdings, {
    warnings: parsed.warnings,
    errors: parsed.errors,
  });

  return NextResponse.json(summary);
}
