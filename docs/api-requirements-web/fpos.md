# API Requirements — FPOs

> Extracted from the reference application. Defines backend API capabilities required to support the FPOs module.

## Meta

| Item | Value |
|------|-------|
| Old route | `/fpos` |
| Permission key | `fpos` (`can_view`, `can_edit`) |
| Tables / services touched | `fpos`, `drafts` (`entity_type = 'fpo'`), `profiles` (SE join) |
| Admin can create? | **No** |
| Admin can edit? | **Yes** — basic profile fields only when `fpos.can_edit` |
| Admin can delete? | **No** |

**Primary sources:** `FposPage.tsx`, `FpoTable.tsx`, `FpoDetailSheet.tsx`, `usePermissions.ts`

---

## Required APIs

| ID | Feature | Old implementation | Suggested endpoint | Method | Query/body summary | Permission | Priority | Implemented |
|----|---------|-------------------|-------------------|--------|-------------------|------------|----------|-------------|
| F-01 | Resolve current user permissions | `getModulePerm('fpos')` | `/api/auth/me/permissions` | GET | `{ fpos: { can_view, can_edit } }` | Authenticated | Must | ☐ |
| F-02 | List SE names for filter | `profiles.select('name').eq('role','SE')` | `/api/profiles?role=SE&fields=name` | GET | Unique SE names | Authenticated | Must | ☐ |
| F-03 | List submitted FPOs | `fpos.select('*, profiles:se_id(name)').order('created_at', desc)` | `/api/fpos` | GET | Filters below | `fpos.can_view` | Must | ☐ |
| F-04 | List FPO drafts | `drafts.select('*, profiles:se_id(name)').eq('entity_type','fpo')` | `/api/fpos/drafts` or merged list | GET | Rich draft mapping | `fpos.can_view` | Must | ☐ |
| F-05 | Merge drafts + submitted directory | Client merge + sort by `created_at` | `/api/fpos` (server merge) | GET | Include draft JSON blocks | `fpos.can_view` | Must | ☐ |
| F-06 | Get FPO / draft detail | Row from list → detail sheet | `/api/fpos/:id` | GET | Basic + evaluation JSON (read-only eval) | `fpos.can_view` | Must | ☐ |
| F-07 | Update submitted FPO (basic fields) | `fpos.update(payload).eq('id', id)` | `/api/fpos/:id` | PATCH | Basic profile only; append `update_history` | `fpos.can_edit` | Must | ☐ |
| F-08 | Update FPO draft | `drafts.update({ draft_data, updated_at, update_history })` | `/api/fpos/drafts/:id` | PATCH | camelCase `draft_data` | `fpos.can_edit` | Must | ☐ |
| F-09 | Export FPOs CSV/PDF | Client export from `filteredData` via `onFilteredDataChange` | `/api/fpos/export` | GET | Respects table + date filters | `fpos.can_view` | Nice | ☐ |

---

## Filters and Query Parameters

From `FpoTable`:

| Param | Type | Notes |
|-------|------|-------|
| `search` | string | FPO name, mobile, city, state, SE name |
| `status` | string[] | Includes `DRAFT` |
| `state` | string[] | |
| `city` | string[] | Labelled "District" in UI |
| `seName` | string[] | Onboarded by |
| `startDate`, `endDate` | date | Filter on `created_at` (client-side before DataTable) |
| `sort` | string | fpo_name, mobile, location, SE, date, status |

FPO table **wires** `onFilteredDataChange` to export (**Confirmed in code**) — unlike Dealers/Distributors.

---

## Request and Response Shapes

### List item

```json
{
  "id": "uuid",
  "se_id": "uuid",
  "fpo_name": "Village FPO",
  "registration_number": "REG-123",
  "contact_mobile": "9876543210",
  "city": "District Name",
  "state": "Gujarat",
  "ceo_name": "CEO Name",
  "status": "SUBMITTED",
  "created_at": "2025-01-20T09:00:00Z",
  "onboarded_by": "SE Name",
  "is_draft": false
}
```

### Detail

```json
{
  "id": "uuid",
  "fpo_name": "Village FPO",
  "registration_number": "REG-123",
  "incorporation_year": "2018",
  "ceo_name": "CEO",
  "bod_president_name": "President",
  "contact_mobile": "9876543210",
  "email": "fpo@example.com",
  "address": "Full address",
  "state": "Gujarat",
  "city": "District",
  "taluka": "Taluka",
  "pincode": "380001",
  "promoting_agency": "NGO Name",
  "command_area": "500 acres",
  "gst_number": "22AAAAA0000A1Z5",
  "pan_number": "ABCDE1234F",
  "status": "SUBMITTED",
  "member_base": {},
  "business_scope": {},
  "storage_locations": {},
  "commitments": {},
  "scoring": {},
  "total_score": 40,
  "bank_details": { "bankAccounts": [] },
  "documents": {},
  "update_history": [],
  "onboarded_by": "SE Name"
}
```

### Update submitted (PATCH — editable fields only)

```json
{
  "fpo_name": "Village FPO",
  "contact_mobile": "9876543210",
  "email": "fpo@example.com",
  "registration_number": "REG-123",
  "incorporation_year": "2018",
  "ceo_name": "CEO",
  "bod_president_name": "President",
  "gst_number": "22AAAAA0000A1Z5",
  "pan_number": "ABCDE1234F",
  "address": "Address",
  "state": "Gujarat",
  "city": "District",
  "taluka": "Taluka",
  "pincode": "380001",
  "promoting_agency": "Agency",
  "command_area": "500 acres"
}
```

**Not editable in admin:** `member_base`, `business_scope`, `scoring`, `total_score` (Evaluations tab read-only).

### Update draft (PATCH)

```json
{
  "draft_data": {
    "fpoName": "Village FPO",
    "contactMobile": "9876543210",
    "registrationNumber": "REG-123",
    "bankAccounts": [],
    "documents": {}
  }
}
```

---

## Business Rules

| Rule | Status |
|------|--------|
| Page gated by `fpos.can_view`; edit by `fpos.can_edit` | **Confirmed in code** |
| Merge `fpos` + drafts (`entity_type='fpo'`) | **Confirmed in code** |
| Draft mapping: camelCase `draft_data` → snake_case list fields + JSON blocks | **Confirmed in code** |
| FPO name min 2 chars; mobile exactly 10 digits on save | **Confirmed in code** |
| Append `update_history` on admin edit | **Confirmed in code** |
| Evaluations tab read-only (member_base, business_scope, scoring) | **Confirmed in code** |
| No scoring recalculation in admin | **Confirmed in code** |
| `pdf_url` on type but no View PDF button in detail sheet | **Confirmed in code** |
| Mobile FPO onboarding/submit/scoring | **UNCONFIRMED (needs manual product decision)** |

---

## What the Old App Does Not Expose

- Admin **create** FPO
- Admin **delete** FPO or draft
- Edit evaluations / scoring in admin
- Document upload UI in admin
- Approval/reject workflow page

---

## Dependencies

| API | Purpose |
|-----|---------|
| `GET /api/auth/me/permissions` | Access gate |
| `GET /api/profiles?role=SE` | Filter dropdown |
