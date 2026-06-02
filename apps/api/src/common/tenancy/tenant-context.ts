import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantContext {
  tenantId: string;
  slug: string;
  dbSchema: string;
  dbUrl?: string | null;
}

/**
 * Request-scoped tenant carried via AsyncLocalStorage so services need no
 * explicit tenant argument. Set by TenantMiddleware.
 */
export const tenantStore = new AsyncLocalStorage<TenantContext>();

export function currentTenant(): TenantContext {
  const ctx = tenantStore.getStore();
  if (!ctx) throw new Error('No tenant in context');
  return ctx;
}
