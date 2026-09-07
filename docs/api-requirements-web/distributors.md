# API Requirements — Distributors

> Extracted from the reference application. Defines backend API capabilities required to support the Distributors module.

## Meta

| Item | Value |
|------|-------|
| Old route | `/distributors` |
| Permission key | `distributors` (`can_view` only — no edit usage) |
| Tables / services touched | `distributors`, `drafts` (`entity_type = 'distributor'`), `profiles` (SE join) |
| Admin can create? | **No** |
| Admin can edit? | **No** — detail sheet is read-only |
| Admin can delete? | **No** |

**Primary sources:** `DistributorsPage.tsx`, `DistributorTable.tsx`, `DistributorDetailSheet.tsx`, `usePermissions.ts`

---

## Required APIs

| ID | Feature | Old implementation | Suggested endpoint | Method | Query/body summary | Permission | Priority | Implemented |
|----|---------|-------------------|-------------------|--------|-------------------|------------|----------|-------------|
| DIS-01 | Resolve current user permissions | `usePermissions` → `getModulePerm('distributors')` | `/api/auth/me/permissions` | GET | `{ distributors: { can_view } }` | Authenticated | Must | ☐ |
| DIS-02 | List SE names for filter | `profiles.select('name').eq('role','SE')` | `/api/profiles?role=SE&fields=name` | GET | Unique SE names | Authenticated | Must | ☐ |
| DIS-03 | List submitted distributors | `distributors.select('*, profiles:se_id(name)').order('created_at', desc)` | `/api/distributors` | GET | `status`, `band`, `seName`, `search`, `sort` | `distributors.can_view` | Must | ☐ |
| DIS-04 | List distributor drafts | `drafts.select('*, profiles:se_id(name)').eq('entity_type','distributor')` | `/api/distributors/drafts` or merged list | GET | Minimal draft mapping | `distributors.can_view` | Must | ☐ |
| DIS-05 | Merge drafts + submitted directory | Client merge; draft maps only `firmName`, `contactPerson`, `contactMobile`, `city`; forces `status=DRAFT`, `band=—`, `total_score=0` | `/api/distributors` (server merge) | GET | Sorted by `created_at` desc | `distributors.can_view` | Must | ☐ |
| DIS-06 | Get distributor / draft detail | Row from list → `DistributorDetailSheet` (no separate fetch) | `/api/distributors/:id` | GET | All JSON sections for tabs | `distributors.can_view` | Must | ☐ |
| DIS-07 | Export distributors CSV/PDF | Client-side from `filteredData` in page | `/api/distributors/export` | GET | `format=csv\|pdf`, filters | `distributors.can_view` | Nice | ☐ |

---

## Filters and Query Parameters

From `DistributorTable`:

| Param | Type | Notes |
|-------|------|-------|
| `search` | string | Firm name, owner, mobile, city, SE name |
| `status` | string[] | `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED` |
| `band` | string[] | Dynamic from data |
| `seName` | string[] | Onboarded-by filter |
| `sort` | string | firm_name, owner_name, mobile, city, SE, band/score, status |

No date range filter in distributor table (**Confirmed in code**).

---

## Request and Response Shapes

### List item (merged)

```json
{
  "id": "uuid",
  "se_id": "uuid",
  "firm_name": "ABC Distributors",
  "owner_name": "Owner Name",
  "contact_person": "Contact",
  "contact_mobile": "9876543210",
  "city": "Ahmedabad",
  "state": "Gujarat",
  "band": "Green Band",
  "total_score": 45,
  "status": "APPROVED",
  "created_at": "2025-01-10T08:00:00Z",
  "onboarded_by": "SE Name",
  "is_draft": false
}
```

### Detail (read-only tabs)

```json
{
  "id": "uuid",
  "firm_name": "ABC Distributors",
  "owner_name": "Owner",
  "contact_person": "Contact",
  "contact_mobile": "9876543210",
  "email": "firm@example.com",
  "firm_type": "Partnership",
  "est_year": "2005",
  "address": "Address line",
  "city": "Ahmedabad",
  "taluka": "Taluka",
  "state": "Gujarat",
  "pincode": "380001",
  "gst_number": "22AAAAA0000A1Z5",
  "pan_number": "ABCDE1234F",
  "band": "Green Band",
  "total_score": 45,
  "status": "APPROVED",
  "pdf_url": "https://...",
  "scoring": {},
  "business_scope": {},
  "commitments": {},
  "dealer_network": {},
  "bank_details": {},
  "documents": {},
  "annexures": {},
  "raw_data": {},
  "onboarded_by": "SE Name"
}
```

No create/update payload — admin is read-only.

---

## Business Rules

| Rule | Status |
|------|--------|
| Page gated by `distributors.can_view` | **Confirmed in code** |
| No edit/save in `DistributorDetailSheet` | **Confirmed in code** |
| Merge submitted + drafts with thin draft mapping | **Confirmed in code** |
| Status display: DRAFT (orange), SUBMITTED (blue), APPROVED (green), REJECTED (red) | **Confirmed in code** |
| `band` field (not `category` like dealers) | **Confirmed in code** |
| PDF dossier link when `pdf_url` present | **Confirmed in code** |
| Scoring/band calculation on mobile submit | **UNCONFIRMED (needs manual product decision)** |
| Admin approval/rejection of distributors | **UNCONFIRMED** — no workflow UI in admin |

---

## What the Old App Does Not Expose

- Admin **create**, **update**, or **delete** distributors
- Document upload in admin
- Scoring recalculation in admin
- `can_edit` permission is **not used** on distributor detail

---

## Dependencies

| API | Purpose |
|-----|---------|
| `GET /api/auth/me/permissions` | Access gate |
| `GET /api/profiles?role=SE` | Filter dropdown |

---

## Comparison with Dealers (for backend design)

| Capability | Dealers | Distributors |
|------------|---------|--------------|
| Admin edit | Yes | **No** |
| Scoring recalc on save | Yes (submitted) | **No** |
| Category/band field | `category` | `band` |
| Draft mapping | Rich | Minimal |
| Document upload | Yes (Cloudinary) | View only |
