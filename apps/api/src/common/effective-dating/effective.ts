/**
 * Effective-dating helpers (UR-GEN-001). HR records are temporal: every
 * versioned row carries effectiveFrom / effectiveTo (null = current).
 */

export function asOfDate(input?: string): Date {
  return input ? new Date(input) : new Date();
}

/** Prisma `where` fragment selecting the row(s) effective at `asOf`. */
export function currentWhere(asOf: Date = new Date()) {
  return {
    effectiveFrom: { lte: asOf },
    OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
  };
}

/**
 * Supersede a versioned record instead of hard-deleting: close the open row
 * the day before the new effective date and return the data for the new row.
 * Full history is preserved (supports audit + retention).
 */
export function supersede(newEffectiveFrom: Date) {
  const closeAt = new Date(newEffectiveFrom);
  closeAt.setDate(closeAt.getDate() - 1);
  return {
    closePrevious: { effectiveTo: closeAt },
    newFrom: newEffectiveFrom,
  };
}
