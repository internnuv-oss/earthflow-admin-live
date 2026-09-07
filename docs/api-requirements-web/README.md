# API Requirements — Reference App Extraction

These documents were extracted from **Field Commander Admin** (`earthflow-admin-live`), the reference implementation that talks directly to Supabase. They list every backend/data operation the old admin app performs for four modules:

| File | Module |
|------|--------|
| [dealers.md](./dealers.md) | Dealers Directory |
| [distributors.md](./distributors.md) | Distributors Directory |
| [fpos.md](./fpos.md) | FPOs Directory |
| [roles-and-access.md](./roles-and-access.md) | Roles & Access |
| [_master-checklist.md](./_master-checklist.md) | Combined checklist for gap audit |

## How to use

1. **Copy this folder** (`docs/api-requirements/`) into your new backend repository.
2. **Audit your REST API** against `_master-checklist.md` — mark each row `☐` → `☑` when implemented and behavior matches the reference app.
3. **Prioritize `Must` rows first** — these block the new frontend from working.
4. **Resolve `UNCONFIRMED` items** with product/team before building (mobile-side behavior not in this admin repo).

## Source of truth

- **Primary:** TypeScript pages, components, and hooks under `src/`
- **Secondary:** `docs/business-rules/*.md` and `docs/module-inventory.md`
- **Rule:** If docs conflict with code, **code wins**.

## Shared cross-module APIs

Several modules depend on the same underlying operations:

| Operation | Used by | Suggested endpoint |
|-----------|---------|-------------------|
| Current user session + profile | All | `GET /api/auth/me` |
| Current user module permissions | All guarded pages | `GET /api/auth/me/permissions` |
| SE name list for filters | Dealers, Distributors, FPOs | `GET /api/sales-executives/names` or query param on profiles |

## What this is NOT

- Not an OpenAPI spec (suggested paths are conventions for your new backend).
- Not a redesign — it mirrors what the reference app actually does.
- Not mobile app API coverage (mobile onboarding/submit flows are largely **UNCONFIRMED** in this repo).

## Audit workflow (backend repo)

Run an agent or manual review:

1. Open `_master-checklist.md`
2. For each ID, find matching route/controller in your backend
3. Mark: `☑` complete, `⚠️` partial, `❌` missing
4. Create `audit-report.md` with gaps (optional)

---

*Generated from reference app source analysis. Do not edit application code when updating these files.*
