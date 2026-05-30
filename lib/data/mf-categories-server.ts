import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_MF_CATEGORIES,
  inferMfCategory,
  mapCategoryHint,
  titleCaseCategory,
  toMfCategorySlug,
} from "@/lib/utils/mf-category";

export async function ensureMfCategoriesSeeded(): Promise<void> {
  const count = await prisma.mfCategory.count();
  if (count > 0) return;

  await prisma.mfCategory.createMany({
    data: DEFAULT_MF_CATEGORIES.map((label) => ({
      label,
      slug:      toMfCategorySlug(label),
      isDefault: true,
    })),
    skipDuplicates: true,
  });
}

export async function listMfCategoryLabels(): Promise<string[]> {
  await ensureMfCategoriesSeeded();
  const rows = await prisma.mfCategory.findMany({
    orderBy: [{ isDefault: "desc" }, { label: "asc" }],
  });
  return rows.map((r) => r.label);
}

export async function ensureMfCategory(
  label: string,
): Promise<{ label: string; slug: string; created: boolean }> {
  await ensureMfCategoriesSeeded();

  const canonical = titleCaseCategory(label);
  if (!canonical) throw new Error("Category label cannot be empty");

  const slug = toMfCategorySlug(canonical);
  const existing = await prisma.mfCategory.findFirst({
    where: { OR: [{ label: canonical }, { slug }] },
  });

  if (existing) {
    return { label: existing.label, slug: existing.slug, created: false };
  }

  const row = await prisma.mfCategory.create({
    data: { label: canonical, slug, isDefault: false },
  });

  revalidateTag("mf-categories");
  return { label: row.label, slug: row.slug, created: true };
}

export type ResolvedMfCategory = {
  label:   string | null;
  slug:    string | null;
  source:  "hint" | "inferred" | "hint-new" | "none";
  created: boolean;
};

export async function resolveMfCategoryForHolding(options: {
  categoryHint?: string | null;
  schemeName:    string;
}): Promise<ResolvedMfCategory> {
  const mappedHint = mapCategoryHint(options.categoryHint);
  const inferred = inferMfCategory(options.schemeName);

  let candidate: string | null = null;
  let source: ResolvedMfCategory["source"] = "none";

  if (mappedHint) {
    candidate = mappedHint;
    source = options.categoryHint?.trim() &&
      !DEFAULT_MF_CATEGORIES.some((c) => c.toLowerCase() === mappedHint.toLowerCase())
      ? "hint-new"
      : "hint";
  } else if (inferred) {
    candidate = inferred;
    source = "inferred";
  }

  if (!candidate) {
    return { label: null, slug: null, source: "none", created: false };
  }

  const ensured = await ensureMfCategory(candidate);
  return {
    label:   ensured.label,
    slug:    ensured.slug,
    source:  ensured.created && source !== "inferred" ? "hint-new" : source,
    created: ensured.created,
  };
}

export async function resolveMfCategoryTool(input: {
  scheme_name:    string;
  category_hint?: string;
}): Promise<string> {
  const schemeName = input.scheme_name?.trim();
  if (!schemeName) return "scheme_name is required.";

  const resolved = await resolveMfCategoryForHolding({
    schemeName,
    categoryHint: input.category_hint,
  });

  if (!resolved.label) {
    return `Could not infer a category for "${schemeName}". Provide category_hint (e.g. Debt, Liquid) or a new label to register.`;
  }

  const all = await listMfCategoryLabels();
  const action = resolved.created ? "registered new category" : "matched existing category";
  const via =
    resolved.source === "inferred"
      ? "inferred from fund name"
      : resolved.source === "hint-new"
        ? "from hint (new label)"
        : resolved.source === "hint"
          ? "from hint"
          : "resolved";

  return [
    `Category for "${schemeName}": ${resolved.label} (${via}; ${action}).`,
    `Registry (${all.length}): ${all.join(", ")}`,
  ].join("\n");
}
