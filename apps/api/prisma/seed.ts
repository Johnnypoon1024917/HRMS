/**
 * Demo seed: creates one SaaS tenant ("acme") with its own Postgres schema,
 * applies the tenant table set, and loads sample data so the flagship modules
 * are usable immediately.
 *
 * Tenant provisioning steps (also what the future onboarding automation does):
 *   1. registry: insert Tenant + TenantModule + TenantBranding rows
 *   2. CREATE SCHEMA tenant_<slug>
 *   3. apply tenant.prisma table set into that schema
 *   4. seed org units / posts / roles / users / code tables / staff
 */
import { execSync } from 'node:child_process';
import * as bcrypt from 'bcryptjs';
import { PrismaClient as RegistryClient } from '../node_modules/.prisma/registry';
import { PrismaClient as TenantClient } from '@prisma/client';

// Inlined from @hrms/contracts → DEFAULT_BRANDING. The contracts package
// ships only TypeScript sources (no compiled JS), so a plain `require()` of
// it from the post-build seed script fails at runtime. Keep this in sync
// with packages/contracts/src/theme.ts → TenantBrandingSchema defaults.
const DEFAULT_BRANDING = {
  appName: 'People HRMS',
  logoUrl: '/brand/default/logo.svg',
  faviconUrl: '/favicon.ico',
  colorTone: {
    primary: '#1a73e8',
    secondary: '#5f6368',
    mode: 'light',
    radius: 12,
    density: 'comfortable',
  },
  typography: { fontFamily: 'Roboto, system-ui, sans-serif' },
  icons: { set: 'material-symbols', overrides: {} },
  locales: ['en', 'zh-Hant'],
  defaultLocale: 'en',
};

const SLUG = 'acme';
const SCHEMA = `tenant_${SLUG}`;
const BASE = process.env.DATABASE_URL!;

async function main() {
  const registry = new RegistryClient();

  const tenant = await registry.tenant.upsert({
    where: { slug: SLUG },
    update: {},
    create: { slug: SLUG, name: 'Acme Corporation', dbSchema: SCHEMA },
  });

  await registry.tenantBranding.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      branding: { ...DEFAULT_BRANDING, appName: 'Acme People' },
    },
  });

  // Demo billing plans (operator-managed). Stripe Price IDs are filled in
  // when the operator wires Stripe; left blank in dev so checkout falls back
  // to the dry-run adapter.
  await registry.plan.upsert({
    where: { code: 'starter' },
    update: {},
    create: {
      code: 'starter', name: 'Starter',
      monthlyPrice: 0, currency: 'USD',
      includedModules: ['pim', 'esm', 'ess', 'lve'],
      maxSeats: 25, active: true,
    },
  });
  await registry.plan.upsert({
    where: { code: 'pro' },
    update: {},
    create: {
      code: 'pro', name: 'Professional',
      monthlyPrice: 4900, currency: 'USD',
      includedModules: ['pim', 'esm', 'ess', 'lve', 'pay', 'pom', 'pem', 'trm', 'ham', 'hbm'],
      maxSeats: 200, perSeatOverage: 200, active: true,
    },
  });
  await registry.plan.upsert({
    where: { code: 'enterprise' },
    update: {},
    create: {
      code: 'enterprise', name: 'Enterprise',
      monthlyPrice: 19900, currency: 'USD',
      includedModules: ['pim', 'esm', 'ess', 'lve', 'pay', 'pom', 'pem', 'trm', 'ham', 'hbm', 'cdm', 'exm', 'rec'],
      maxSeats: 0, active: true,
    },
  });
  // Acme starts on the Enterprise plan, trialing.
  await registry.subscription.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      planCode: 'enterprise',
      status: 'trialing',
      trialEndsAt: new Date(Date.now() + 14 * 86_400_000),
    },
  });

  for (const moduleKey of ['pim', 'esm', 'pay', 'lve', 'ess', 'pom', 'pem', 'trm', 'ham', 'cdm', 'exm', 'hbm', 'rec']) {
    await registry.tenantModule.upsert({
      where: { tenantId_moduleKey: { tenantId: tenant.id, moduleKey } },
      update: { enabled: true },
      create: { tenantId: tenant.id, moduleKey, enabled: true },
    });
  }

  // 2. + 3. create the tenant schema and push the tenant table set into it.
  await registry.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${SCHEMA}"`);
  execSync(
    `npx prisma db push --schema prisma/tenant.prisma --skip-generate --accept-data-loss`,
    { env: { ...process.env, DATABASE_URL: `${BASE}?schema=${SCHEMA}` }, stdio: 'inherit' },
  );

  // 4. seed tenant data inside the new schema.
  const db = new TenantClient({
    datasources: { db: { url: `${BASE}?schema=${SCHEMA}` } },
  });

  // Idempotent: skip the base data load if the tenant was already seeded,
  // but still ensure the 100-row demo staff set exists (its own guard makes
  // it safe to re-run — see seedDemoStaff). This lets the bulk demo data be
  // back-filled into a tenant that was seeded before this block existed.
  const existing = await db.orgUnit.findUnique({ where: { code: 'HQ' } });
  if (existing) {
    // eslint-disable-next-line no-console
    console.log(`Tenant "${SLUG}" base already seeded — ensuring demo staff.`);
    await seedDemoStaff(db);
    await registry.$disconnect();
    await db.$disconnect();
    return;
  }

  const hq = await db.orgUnit.create({
    data: { type: 'institution', code: 'HQ', nameEn: 'Headquarters', nameZh: '總部' },
  });
  const hr = await db.orgUnit.create({
    data: { type: 'section', code: 'HR', nameEn: 'Human Resources', nameZh: '人力資源科', parentId: hq.id },
  });

  await db.codeTable.create({
    data: {
      key: 'rank',
      nameEn: 'Rank',
      nameZh: '職級',
      values: {
        create: [
          { code: 'MGR', labelEn: 'Manager', labelZh: '經理', sort: 1 },
          { code: 'OFF', labelEn: 'Officer', labelZh: '主任', sort: 2 },
          { code: 'CLK', labelEn: 'Clerk', labelZh: '文員', sort: 3 },
        ],
      },
    },
  });

  const post = await db.post.create({
    data: {
      orgUnitId: hr.id,
      rankCode: 'MGR',
      title: 'HR Manager',
      status: 'filled',
      effectiveFrom: new Date('2020-01-01'),
    },
  });

  const adminRole = await db.role.create({
    data: {
      name: 'HR Administrator',
      permissions: [
        'pim.read', 'pim.write', 'pim.read.restricted', 'pim.import', 'pim.export',
        'esm.read', 'esm.write', 'esm.export',
        'pay.read', 'pay.write', 'pay.run', 'pay.approve', 'pay.export', 'pay.read.restricted',
        'lve.read', 'lve.request', 'lve.approve', 'lve.admin',
        'ess.self', 'ess.team',
        'pom.read', 'pom.write',
        'pem.read', 'pem.appraise', 'pem.admin',
        'trm.read', 'trm.admin',
        'ham.read', 'ham.write',
        'cdm.read', 'cdm.write', 'cdm.read.restricted',
        'exm.read', 'exm.write',
        'hbm.read', 'hbm.write', 'hbm.bill',
        'rec.read', 'rec.write', 'rec.hire',
        'bil.read', 'bil.manage', 'bil.operate',
        'config.read', 'config.write', 'audit.read',
      ],
    },
  });

  const admin = await db.appUser.create({
    data: {
      email: 'admin@acme.test',
      displayName: 'Acme Admin',
      passwordHash: await bcrypt.hash('Passw0rd!', 10),
    },
  });
  await db.postAssignment.create({
    data: { userId: admin.id, postId: post.id, effectiveFrom: new Date('2020-01-01') },
  });
  await db.roleGrant.create({ data: { userId: admin.id, roleId: adminRole.id } });

  // A default monthly pay group. Required: PayRun.groupCode is a FK to
  // PayGroup.code (default "MONTHLY-HK"), so the payroll demo can't create a
  // run without this row existing first.
  await db.payGroup.upsert({
    where: { code: 'MONTHLY-HK' },
    update: {},
    create: {
      code: 'MONTHLY-HK',
      name: 'Monthly Payroll (HK)',
      frequency: 'monthly',
      currency: 'HKD',
      localeCode: 'HK',
    },
  });

  // Configurable pay components (formula-driven, tenant data not code).
  await db.payComponent.createMany({
    data: [
      { code: 'BASIC', nameEn: 'Basic Salary', kind: 'earning', taxable: true, formula: 'base', sequence: 10 },
      { code: 'HRA', nameEn: 'Housing Allowance', kind: 'earning', taxable: true, formula: "line('BASIC') * 0.10", sequence: 20 },
      { code: 'MPF_EE', nameEn: 'MPF (Employee)', kind: 'deduction', taxable: false, formula: "line('BASIC') * 0.05", sequence: 50 },
      { code: 'MPF_ER', nameEn: 'MPF (Employer)', kind: 'employer', taxable: false, formula: "line('BASIC') * 0.05", sequence: 60 },
    ],
  });
  // Sample HK statutory pack (reference; bracketed salaries tax).
  await db.taxRuleSet.create({
    data: {
      localeCode: 'HK',
      version: 1,
      effectiveFrom: new Date('2024-04-01'),
      rules: { type: 'progressive', brackets: [[50000, 0.02], [50000, 0.06], [50000, 0.1], [null, 0.17]] },
    },
  });

  const staff = await db.staff.create({
    data: {
      staffNo: 'E0001',
      nameEn: 'Jordan Lee',
      nameZh: '李祖頓',
      sex: 'M',
      dob: new Date('1990-05-20'),
      idType: 'HKID',
      idNoEnc: 'seed.seed.seed', // placeholder ciphertext
      classification: 'internal',
      userId: admin.id, // link so self-service (leave) works for the demo login
      appointments: {
        create: { postId: post.id, rankCode: 'MGR', effectiveFrom: new Date('2021-01-01') },
      },
    },
  });

  await db.leaveType.createMany({
    data: [
      { code: 'AL', nameEn: 'Annual Leave', nameZh: '年假', annualQuota: 14, paid: true },
      { code: 'SL', nameEn: 'Sick Leave', nameZh: '病假', annualQuota: 12, paid: true, requiresReason: true },
      { code: 'NPL', nameEn: 'No-Pay Leave', nameZh: '無薪假', annualQuota: 0, paid: false },
    ],
  });
  await db.staffSalary.create({
    data: {
      staffId: staff.id,
      scaleCode: 'MPS',
      point: 34,
      amount: 60000,
      effectiveFrom: new Date('2021-01-01'),
    },
  });

  // Training catalog + an upcoming session.
  await db.course.create({
    data: {
      code: 'INT-101',
      title: 'Integrity Workshop (Appointment)',
      description: 'Integrity Ambassador appointment workshop',
      durationDays: 2,
      certificateType: 'INTEGRITY',
      certificateValidMonths: 24,
    },
  });
  await db.courseSession.create({
    data: {
      courseCode: 'INT-101',
      startDate: new Date('2026-06-10'),
      endDate: new Date('2026-06-11'),
      location: 'Staff Training Institution',
      capacity: 30,
    },
  });

  // Benefit catalog + one chargeable enrolment so invoice generation works.
  await db.benefitType.createMany({
    data: [
      { code: 'QTR', nameEn: 'Departmental Quarters', category: 'housing', chargeable: true, monthlyAmount: 4500 },
      { code: 'MED', nameEn: 'Medical Allowance', category: 'medical', chargeable: false, monthlyAmount: 800 },
      { code: 'FURN', nameEn: 'Furniture Allowance', category: 'allowance', chargeable: false, monthlyAmount: 250 },
    ],
  });
  await db.benefitEnrolment.create({
    data: {
      staffId: staff.id,
      benefitTypeCode: 'QTR',
      effectiveFrom: new Date('2024-01-01'),
      params: { quarterCode: 'HQ-A-12' },
    },
  });

  // A vacant post + an open job opening to demo the recruitment pipeline.
  const recPost = await db.post.create({
    data: {
      orgUnitId: hr.id,
      rankCode: 'OFF',
      title: 'HR Officer',
      status: 'vacant',
      effectiveFrom: new Date('2026-01-01'),
    },
  });
  await db.jobOpening.create({
    data: {
      code: 'HR-OFF-01',
      title: 'HR Officer',
      orgUnitId: hr.id,
      rankCode: 'OFF',
      openings: 1,
      description: 'Generalist HR officer role in the HR section.',
      status: 'open',
    },
  });
  void recPost; // referenced for clarity / future seed enrolments

  // Award types incl. one LSI threshold.
  await db.awardType.createMany({
    data: [
      { code: 'GMSM', nameEn: 'Good Service Medal', kind: 'medal' },
      { code: 'TRV', nameEn: 'Travel Award', kind: 'travel' },
      { code: 'LSI10', nameEn: 'Long Service Increment (10y)', kind: 'lsi', lsiYears: 10 },
    ],
  });

  // Bulk demo data: 100 dummy staff so the directory, org chart and module
  // list pages look populated in a demo. Idempotent (see below).
  await seedDemoStaff(db);

  // eslint-disable-next-line no-console
  console.log(`Seeded tenant "${SLUG}". Login: admin@acme.test / Passw0rd!`);
  await registry.$disconnect();
  await db.$disconnect();
}

/**
 * Loads 100 demo staff (E0002..E0101) with org units, filled posts,
 * appointments, a contact and a salary row each. Deterministic — the same
 * inputs produce the same records — and idempotent: each staffNo is created
 * only if missing, so re-running (every `init` on `docker compose up`) never
 * duplicates and resumes a partial load. Persisted in the `hrms_db` volume,
 * so the data survives code changes and redeploys; this seed also re-creates
 * it from scratch after a `docker compose down -v` wipe.
 */
async function seedDemoStaff(db: TenantClient) {
  const TARGET = 100; // E0002..E0101

  // Skip fast if the demo set is already fully loaded.
  const have = await db.staff.count();
  if (have >= TARGET + 1) {
    // eslint-disable-next-line no-console
    console.log(`Demo staff already present (${have} rows) — skipping.`);
    return;
  }

  const hq = await db.orgUnit.findUnique({ where: { code: 'HQ' } });
  if (!hq) throw new Error('HQ org unit missing — base seed did not run.');

  // A handful of departments so staff spread across the org chart.
  const deptDefs = [
    { code: 'HR', nameEn: 'Human Resources', nameZh: '人力資源科' },
    { code: 'FIN', nameEn: 'Finance', nameZh: '財務科' },
    { code: 'IT', nameEn: 'Information Technology', nameZh: '資訊科技科' },
    { code: 'OPS', nameEn: 'Operations', nameZh: '營運科' },
    { code: 'SAL', nameEn: 'Sales & Marketing', nameZh: '銷售及市場科' },
    { code: 'ADM', nameEn: 'Administration', nameZh: '行政科' },
  ];
  const depts = [] as { id: string; code: string }[];
  for (const d of deptDefs) {
    const ou = await db.orgUnit.upsert({
      where: { code: d.code },
      update: {},
      create: { type: 'section', code: d.code, nameEn: d.nameEn, nameZh: d.nameZh, parentId: hq.id },
    });
    depts.push({ id: ou.id, code: ou.code });
  }

  // Deterministic name pools — picked by index so the data is reproducible.
  const firstM = ['Liam', 'Noah', 'Ethan', 'Lucas', 'Mason', 'Logan', 'James', 'Aiden', 'Jackson', 'David', 'Daniel', 'Matthew', 'Henry', 'Owen', 'Carter'];
  const firstF = ['Olivia', 'Emma', 'Ava', 'Sophia', 'Isabella', 'Mia', 'Charlotte', 'Amelia', 'Harper', 'Evelyn', 'Emily', 'Grace', 'Chloe', 'Zoe', 'Lily'];
  const lastEn = ['Chan', 'Wong', 'Lee', 'Cheung', 'Lam', 'Ng', 'Ho', 'Yeung', 'Tsang', 'Kwok', 'Leung', 'Lau', 'Tang', 'Lai', 'Wan', 'Cheng', 'Au', 'Choi', 'Fung', 'Mak'];
  const surnameZh = ['陳', '王', '李', '張', '林', '吳', '何', '楊', '曾', '郭', '梁', '劉', '鄧', '黎', '尹', '鄭', '歐', '蔡', '馮', '麥'];
  const givenMZh = ['偉強', '志明', '家俊', '子軒', '浩然', '建華', '文傑', '俊傑', '嘉豪', '明輝'];
  const givenFZh = ['美玲', '嘉欣', '詩雅', '曉彤', '穎彤', '慧珊', '麗華', '寶兒', '靜怡', '雅琳'];

  const rankSalary: Record<string, { title: string; base: number; scale: number }> = {
    MGR: { title: 'Manager', base: 60000, scale: 30000 },
    OFF: { title: 'Officer', base: 35000, scale: 20000 },
    CLK: { title: 'Clerk', base: 20000, scale: 10000 },
  };

  let created = 0;
  for (let i = 2; i <= TARGET + 1; i++) {
    const staffNo = `E${String(i).padStart(4, '0')}`;
    if (await db.staff.findUnique({ where: { staffNo } })) continue;

    const isMale = i % 2 === 0;
    const nameEn = isMale
      ? `${firstM[i % firstM.length]} ${lastEn[i % lastEn.length]}`
      : `${firstF[i % firstF.length]} ${lastEn[i % lastEn.length]}`;
    const nameZh = isMale
      ? `${surnameZh[i % surnameZh.length]}${givenMZh[i % givenMZh.length]}`
      : `${surnameZh[i % surnameZh.length]}${givenFZh[i % givenFZh.length]}`;

    const rankCode = i % 11 === 0 ? 'MGR' : i % 3 === 0 ? 'OFF' : 'CLK';
    const rs = rankSalary[rankCode];
    const dept = depts[i % depts.length];

    // Spread DOB (age ~25..59) and hire date (2010..2023) deterministically.
    const dob = new Date(Date.UTC(1966 + (i % 34), i % 12, (i % 27) + 1));
    const hireFrom = new Date(Date.UTC(2010 + (i % 14), (i + 3) % 12, ((i + 5) % 27) + 1));
    const amount = rs.base + (i % 10) * (rs.scale / 10);

    // Light variety in contract type for the payroll/exit demos.
    const contractType = i % 13 === 0 ? 'fixed_term' : i % 7 === 0 ? 'part_time' : 'permanent';
    const fteFactor = contractType === 'part_time' ? 0.5 : 1;
    const contractEndDate = contractType === 'fixed_term'
      ? new Date(Date.UTC(2027, (i + 2) % 12, ((i + 4) % 27) + 1))
      : null;

    const post = await db.post.create({
      data: {
        orgUnitId: dept.id,
        rankCode,
        title: `${dept.code} ${rs.title}`,
        status: 'filled',
        effectiveFrom: hireFrom,
      },
    });

    const staff = await db.staff.create({
      data: {
        staffNo,
        nameEn,
        nameZh,
        sex: isMale ? 'M' : 'F',
        dob,
        idType: 'HKID',
        idNoEnc: `seed.${staffNo}.seed`, // placeholder ciphertext (demo only)
        classification: 'internal',
        appointments: {
          create: {
            postId: post.id,
            rankCode,
            contractType,
            fteFactor,
            contractEndDate,
            effectiveFrom: hireFrom,
          },
        },
        contacts: {
          create: [
            { kind: 'email', value: `${staffNo.toLowerCase()}@acme.test`, effectiveFrom: hireFrom },
            { kind: 'phone', value: `+8525${String(1000000 + i * 7919).slice(-7)}`, effectiveFrom: hireFrom },
          ],
        },
      },
    });

    await db.staffSalary.create({
      data: {
        staffId: staff.id,
        scaleCode: 'MPS',
        point: 10 + (i % 40),
        amount,
        effectiveFrom: hireFrom,
      },
    });
    created++;
  }

  // eslint-disable-next-line no-console
  console.log(`Demo staff: created ${created} new (target ${TARGET}, total now ${have + created}).`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
