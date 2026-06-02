import { ModuleManifest } from '@hrms/contracts';

export const ESS_MANIFEST: ModuleManifest = {
  key: 'ess',
  nameKey: 'mod.ess',
  icon: 'person',
  dependsOn: ['pim'],
  permissions: [
    'ess.self', // every employee — view own profile/payslip/leave
    'ess.team', // managers — view their team
  ],
  nav: [
    { path: '/ess/me', labelKey: 'ess.nav.me', icon: 'person', perm: 'ess.self' },
    { path: '/ess/team', labelKey: 'ess.nav.team', icon: 'groups', perm: 'ess.team' },
  ],
};
