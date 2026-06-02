# 03 — Data Model

Two schema tiers (see [01-ARCHITECTURE.md](01-ARCHITECTURE.md)):

## `public` (global registry)

| Table | Purpose |
|---|---|
| `tenant` | id, slug, name, status, deploymentMode (`saas`/`onprem`/`dedicated`), dbSchema |
| `tenant_module` | tenantId, moduleKey, enabled, settings(jsonb) |
| `tenant_branding` | tenantId, branding(jsonb — see theming doc) |
| `platform_admin` | super-admin accounts (SaaS operator) |

## `tenant_<slug>` (per customer)

### Identity & access

| Table | Key columns |
|---|---|
| `app_user` | id, email, displayName, locale, idpSubject, status |
| `org_unit` | id, parentId, type(institution/section/unit), code, nameEn, nameZh |
| `post` | id, orgUnitId, rankCode, title, establishmentType, **effectiveFrom/To**, status(filled/vacant/frozen) |
| `post_assignment` | id, userId, postId, assignmentType(substantive/acting), **effectiveFrom/To** — drives "active post" & RBAC data scope |
| `role` | id, name, permissions(text[]) — values like `pim.write` |
| `role_grant` | userId, roleId, dataScopeOrgUnitId (nullable = all) |
| `audit_log` | id, at, userId, activePostId, action, entity, entityId, before(jsonb), after(jsonb), ip |
| `code_table` / `code_value` | tenant-editable dropdowns (rank, exit reason, …), bilingual labels |
| `bring_up` | id, dueAt, type, refEntity, refId, assigneeScope, status |

### PIM (flagship)

| Table | Key columns |
|---|---|
| `staff` | id, staffNo (unique), userId?, nameEn, nameZh, sex, dob, idType, idNoEnc, classification, status(active/delflag) |
| `staff_contact` | staffId, kind(phone/email/address/emergency), value, **effectiveFrom/To** |
| `staff_appointment` | staffId, postId, rankCode, **effectiveFrom/To**, basis |
| `staff_salary` | staffId, scaleCode, point, amount, **effectiveFrom/To** |
| `staff_qualification` | staffId, type, title, institution, awardedOn |
| `staff_document` | staffId, docType, fileKey, classification, uploadedBy |
| `staff_import_batch` | id, fileKey, status, totalRows, okRows, errorRows, exceptionFileKey |

### ESM / ORM (flagship)

| Table | Key columns |
|---|---|
| `post` (shared w/ identity) | establishment record |
| `post_request` | id, action(create/update/delete), payload(jsonb), **effectiveDate**, status(pending/applied/rejected), processedAt |
| `es_snapshot` | id, snapshotDate, orgUnitId, rankCode, establishment(int), strength(int), actingIn, deployIn, deployOut |

## Effective-dating

Any temporally-versioned table carries:

```
effectiveFrom DATE NOT NULL
effectiveTo   DATE NULL          -- null = open-ended / current
```

- **Current view**: `effectiveFrom <= :asOf AND (effectiveTo IS NULL OR effectiveTo >= :asOf)`
- **History view**: all rows ordered by `effectiveFrom desc`.
- Mutations don't hard-delete: they close the open row (`effectiveTo = newFrom - 1`)
  and insert a new one — full history, satisfies UR-GEN-001 & retention.
- Implemented by `common/effective-dating` (`EffectiveBase`, `currentWhere(asOf)`,
  `supersede()` helper).

## Audit

Write-path interceptor captures `before`/`after` snapshots for every
create/update/delete on auditable entities → `audit_log`. The log is
append-only (no update/delete grant); read gated by `audit.read`. Satisfies
REQ-SEC-001.

## Data classification

Sensitive columns tagged `classification` (`public|internal|restricted`).
RBAC + a serialization interceptor mask `restricted` fields unless the
caller's active post grants `pim.read.restricted`. Mirrors CSD "Restricted"
handling and UR-GEN-004.

## Retention

`retention.purge` job: business records inactive > 3y move to archive table /
cold storage; archived > 7y purged. Configurable per tenant
(REQ-SEC-007). Default values seeded from CSD circular.
