import { ModuleManifest } from '@hrms/contracts';

export const PAY_MANIFEST: ModuleManifest = {
  key: 'pay',
  nameKey: 'mod.pay',
  icon: 'payments',
  dependsOn: ['pim'],
  permissions: [
    'pay.read',
    'pay.write',
    'pay.run',
    'pay.approve',
    'pay.export',
    'pay.read.restricted', // net pay / bank details / IR56 (UR-GEN-004 style)
  ],
  nav: [
    { path: '/pay/runs',         labelKey: 'pay.nav.runs',         icon: 'payments',         perm: 'pay.read' },
    { path: '/pay/calendar',     labelKey: 'pay.nav.calendar',     icon: 'event_note',       perm: 'pay.read' },
    { path: '/pay/holidays',     labelKey: 'pay.nav.holidays',     icon: 'celebration',      perm: 'pay.read' },
    { path: '/pay/timesheets',   labelKey: 'pay.nav.timesheets',   icon: 'schedule',         perm: 'pay.read' },
    { path: '/pay/components',   labelKey: 'pay.nav.components',   icon: 'tune',             perm: 'pay.write' },
    { path: '/pay/profiles',     labelKey: 'pay.nav.profiles',     icon: 'badge',            perm: 'pay.read' },
    { path: '/pay/loans',        labelKey: 'pay.nav.loans',        icon: 'request_quote',    perm: 'pay.read' },
    { path: '/pay/terminations', labelKey: 'pay.nav.terminations', icon: 'logout',           perm: 'pay.write' },
    { path: '/pay/ir56',         labelKey: 'pay.nav.ir56',         icon: 'description',      perm: 'pay.read' },
    { path: '/pay/constants',    labelKey: 'pay.nav.constants',    icon: 'rule_settings',    perm: 'pay.write' },
  ],
};
