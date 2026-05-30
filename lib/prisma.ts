import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  return new PrismaClient({ log: ["error"] });
}

function getPrismaClient(): PrismaClient {
  const cached = globalForPrisma.prisma;

  // Dev hot-reload can cache a PrismaClient from before `prisma generate`
  if (
    cached &&
    (cached as unknown as Record<string, unknown>).netWorthConfig === undefined
  ) {
    void cached.$disconnect();
    delete globalForPrisma.prisma;
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }

  return globalForPrisma.prisma;
}

export const prisma = getPrismaClient();
