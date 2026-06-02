import { ModuleManifest } from '@hrms/contracts';

/**
 * Billing is a *core* module (always on). It serves two audiences:
 *  - **Tenant admins** see their own subscription & billing portal.
 *  - **Platform admins** (SaaS operator) manage plans + issue on-prem
 *    license keys. Operator-only pages live under /platform/.
 */
export const BIL_MANIFEST: ModuleManifest = {
  key: 'bil',
  nameKey: 'mod.bil',
  icon: 'credit_card',
  core: true,
  permissions: [
    'bil.read', // tenant-admin view own subscription
    'bil.manage', // tenant-admin: launch checkout / portal
    'bil.operate', // platform-operator: plans, licenses, all subs
  ],
  nav: [
    { path: '/admin/subscription', labelKey: 'bil.nav.subscription', icon: 'credit_card', perm: 'bil.read' },
    { path: '/platform/plans', labelKey: 'bil.nav.plans', icon: 'sell', perm: 'bil.operate' },
    { path: '/platform/licenses', labelKey: 'bil.nav.licenses', icon: 'key', perm: 'bil.operate' },
  ],
};
