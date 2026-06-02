import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { currentTenant } from '../tenancy/tenant-context';

/**
 * Returns a Prisma client bound to the *current* tenant's Postgres schema.
 *
 * Schema-per-tenant: the same model layout, isolated by schema. The schema is
 * appended to the connection string (`?schema=tenant_acme`) so unqualified
 * Prisma models resolve into that schema. A dedicated `dbUrl` (DB-per-tenant
 * / on-prem premium) is honoured if present — no code change required.
 *
 * Clients are cached per schema (simple bounded map) to avoid pool churn.
 */
@Injectable()
export class TenantPrismaService {
  private readonly clients = new Map<string, PrismaClient>();
  private readonly max = 50;

  forCurrentTenant(): PrismaClient {
    const { dbSchema, dbUrl } = currentTenant();
    const cacheKey = dbUrl ?? dbSchema;
    let client = this.clients.get(cacheKey);
    if (client) return client;

    const base = dbUrl ?? process.env.DATABASE_URL!;
    const url = new URL(base);
    if (!dbUrl) url.searchParams.set('schema', dbSchema);

    client = new PrismaClient({ datasources: { db: { url: url.toString() } } });

    if (this.clients.size >= this.max) {
      const oldest = this.clients.keys().next().value as string;
      void this.clients.get(oldest)?.$disconnect();
      this.clients.delete(oldest);
    }
    this.clients.set(cacheKey, client);
    return client;
  }
}
