import { ModuleManifest } from '@hrms/contracts';

export const PEM_MANIFEST: ModuleManifest = {
  key: 'pem',
  nameKey: 'mod.pem',
  icon: 'star_rate',
  dependsOn: ['pim'],
  permissions: [
    'pem.read', // own appraisals
    'pem.appraise', // appraise team members
    'pem.admin', // manage cycles, generate, finalise, analytics
  ],
  nav: [
    { path: '/pem/me', labelKey: 'pem.nav.me', icon: 'star_rate', perm: 'pem.read' },
    { path: '/pem/appraise', labelKey: 'pem.nav.appraise', icon: 'rate_review', perm: 'pem.appraise' },
    { path: '/pem/cycles', labelKey: 'pem.nav.cycles', icon: 'event_repeat', perm: 'pem.admin' },
  ],
};
