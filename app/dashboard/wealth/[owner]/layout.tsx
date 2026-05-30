import { notFound } from "next/navigation";
import { resolveOwner } from "@/lib/wealth-config";

export default async function WealthOwnerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ owner: string }>;
}) {
  const { owner: ownerSlug } = await params;
  if (!resolveOwner(ownerSlug)) notFound();

  return <div className="min-w-0 overflow-x-hidden">{children}</div>;
}
