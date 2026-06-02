import { ModuleManifest } from '@hrms/contracts';

export const REC_MANIFEST: ModuleManifest = {
  key: 'rec',
  nameKey: 'mod.rec',
  icon: 'person_search',
  dependsOn: ['pim', 'esm'],
  permissions: ['rec.read', 'rec.write', 'rec.hire'],
  nav: [
    { path: '/rec/jobs', labelKey: 'rec.nav.jobs', icon: 'work_outline', perm: 'rec.read' },
    { path: '/rec/pipeline', labelKey: 'rec.nav.pipeline', icon: 'view_kanban', perm: 'rec.read' },
    { path: '/rec/candidates', labelKey: 'rec.nav.candidates', icon: 'person_search', perm: 'rec.read' },
  ],
};
