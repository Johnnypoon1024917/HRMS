import { PrismaClient } from '@prisma/client';
import { currentWhere } from '../effective-dating/effective';

/** Posts a user effectively holds today (substantive + acting). */
export async function effectivePostsFor(
  db: PrismaClient,
  userId: string,
): Promise<string[]> {
  const a = await db.postAssignment.findMany({
    where: { userId, ...currentWhere() },
    select: { postId: true },
  });
  return a.map((x) => x.postId);
}

/**
 * Resolve the permission set + data scope for a user (UR-GEN-004 /
 * REQ-SEC-002). Permissions are functional (`module.action`); data scope
 * limits which org-unit subtree the user can see/edit.
 */
export async function resolveAccess(db: PrismaClient, userId: string) {
  const grants = await db.roleGrant.findMany({
    where: { userId },
    include: { role: true },
  });
  const permissions = new Set<string>();
  const scopeUnits = new Set<string>();
  let unrestricted = false;
  for (const g of grants) {
    g.role.permissions.forEach((p) => permissions.add(p));
    if (g.dataScopeOrgUnitId) scopeUnits.add(g.dataScopeOrgUnitId);
    else unrestricted = true;
  }
  return {
    permissions,
    /** null => all units; otherwise restrict to these subtrees. */
    scopeUnits: unrestricted ? null : [...scopeUnits],
  };
}
