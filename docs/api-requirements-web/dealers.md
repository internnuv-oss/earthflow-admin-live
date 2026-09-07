# API Requirements — Dealers

> Extracted from the reference application. Defines backend API capabilities required to support the Dealers module.

## Meta

| Item | Value |
|------|-------|
| Old route | `/dealers` |
| Permission key | `dealers` (`can_view`, `can_edit`) |
| Tables / services touched | `dealers`, `drafts` (`entity_type = 'dealer'`), `profiles` (SE join), Cloudinary (document upload), external GitHub JSON (location cascade) |
| Admin can create? | **No** — no create UI in admin |
| Admin can edit? | **Yes** — when `dealers.can_edit` (draft + submitted) |
| Admin can delete? | **No** |

**Primary sources:** `DealersPage.tsx`, `DealerTable.tsx`, `DealerDetailSheet.tsx`, `usePermissions.ts`, `useAuth.ts`

---

## Required APIs

| ID | Feature | Old implementation | Suggested endpoint | Method | Query/body summary | Permission | Priority | Implemented |
|----|---------|-------------------|-------------------|--------|-------------------|------------|----------|-------------|
| D-01 | Resolve current user permissions | `usePermissions` → `profiles` + `role_permissions`; TH / Super Admin bypass | `/api/auth/me/permissions` | GET | Returns `{ dealers: { can_view, can_edit } }` | Authenticated | Must | ☐ |
| D-02 | List SE names for filter dropdown | `profiles.select('name').eq('role','SE')` | `/api/profiles?role=SE&fields=name` | GET | Unique SE names | Authenticated | Must | ☐ |
| D-03 | List submitted dealers | `dealers.select('*, profiles:se_id(name)').order('created_at', desc)` | `/api/dealers` | GET | `status`, `category`, `seName`, `search`, `sort`, `page` | `dealers.can_view` | Must | ☐ |
| D-04 | List dealer drafts | `drafts.select('*, profiles:se_id(name)').eq('entity_type','dealer')` | `/api/dealers/drafts` or `GET /api/dealers?includeDrafts=true` | GET | Same filters as D-03 | `dealers.can_view` | Must | ☐ |
| D-05 | Merge drafts + submitted directory | Client merges D-03 + D-04; maps `draft_data` → dealer shape; forces `status=DRAFT`, `category=—`, `total_score=0` | `/api/dealers` (server merge) | GET | Single merged list sorted by `created_at` desc | `dealers.can_view` | Must | ☐ |
| D-06 | Get dealer / draft detail | Row from list passed to sheet (no separate fetch) | `/api/dealers/:id` | GET | Include `profiles.se_name`, full JSON fields | `dealers.can_view` | Must | ☐ |
| D-07 | Update submitted dealer | `dealers.update({...}).eq('id', id)` | `/api/dealers/:id` | PATCH | Full profile payload; server recalculates `total_score`, `category` | `dealers.can_edit` | Must | ☐ |
| D-08 | Update dealer draft | `drafts.update({ draft_data, updated_at, update_history }).or('id.eq.X,entity_id.eq.X')` | `/api/dealers/drafts/:id` | PATCH | `draft_data` camelCase blob; append `update_history` | `dealers.can_edit` | Must | ☐ |
| D-09 | Upload dealer document | Direct `fetch` to Cloudinary; URL stored in `documents` JSON on save | `/api/dealers/:id/documents/upload` or `/api/files/upload` | POST | `multipart/form-data`; returns URL for PATCH | `dealers.can_edit` | Should | ☐ |
| D-10 | Export dealers CSV/PDF | Client builds CSV/HTML from `filteredData` in page | `/api/dealers/export` | GET | `format=csv\|pdf`, same filters as list | `dealers.can_view` | Nice | ☐ |
| D-11 | Location cascade (state → district → taluka) | `fetch` GitHub raw JSON by state name | `/api/locations/india/:state` or keep external CDN | GET | Returns districts/subDistricts | Authenticated | Should | ☐ |

---

## Filters and Query Parameters

From `DealerTable` + `DealersPage`:

| Param | Type | Notes |
|-------|------|-------|
| `search` | string | Matches shop name, contact person, mobile, address, SE name |
| `status` | string[] | Dynamic from data; includes `DRAFT` for drafts |
| `category` | string[] | Elite, A-Category, B-Category, C-Category (submitted only) |
| `seName` / `onboardedBy` | string[] | Filter by `profiles.name` |
| `sort` | string | Columns: shop name, contact, mobile, address, SE, category, status |
| `sortDir` | `asc` \| `desc` | |
| `page`, `limit` | number | Not in old app (loads all) — recommended for new backend |

**Note:** Old app filters client-side. Export uses `onFilteredDataChange` but `DealerTable` does **not** wire it to `DataTable` — export may ignore table filters (**Confirmed in code**).

---

## Request and Response Shapes

### List item (merged row)

```json
{
  "id": "uuid",
  "se_id": "uuid",
  "primary_shop_name": "Agri Shop",
  "contact_person": "Rajesh Kumar",
  "contact_mobile": "9876543210",
  "primary_address": "Main Road",
  "category": "A-Category",
  "status": "SUBMITTED",
  "total_score": 52,
  "created_at": "2025-01-15T10:00:00Z",
  "onboarded_by": "SE Name",
  "is_draft": false
}
```

### Detail (submitted)

```json
{
  "id": "uuid",
  "se_id": "uuid",
  "primary_shop_name": "Agri Shop",
  "contact_person": "Rajesh Kumar",
  "contact_mobile": "9876543210",
  "primary_address": "Full address",
  "gst_number": "22AAAAA0000A1Z5",
  "pan_number": "ABCDE1234F",
  "est_year": "2010",
  "firm_type": "Proprietorship",
  "primary_shop_location": {
    "state": "Gujarat",
    "city": "Ahmedabad",
    "taluka": "Daskroi",
    "village": "Village X",
    "landmark": "",
    "landlineNumber": ""
  },
  "owners_list": [{ "name": "Rajesh Kumar" }],
  "bank_details": {
    "bankAccounts": [{
      "bankName": "SBI",
      "accountName": "Rajesh",
      "accountNumber": "123456789",
      "bankIfsc": "SBIN0001234",
      "bankBranch": "Branch",
      "accountType": "Current"
    }]
  },
  "scoring": {
    "scoreFinancial": 7,
    "remFinancial": "notes",
    "scoreReputation": 6,
    "remReputation": "",
    "scoreOperations": 8,
    "scoreFarmerNetwork": 7,
    "scoreTeam": 6,
    "scorePortfolio": 7,
    "scoreExperience": 8,
    "scoreGrowth": 7,
    "redFlags": ""
  },
  "total_score": 56,
  "category": "A-Category",
  "commitments": {
    "proposedStatus": "Authorised Dealer",
    "willingDemoFarmers": "Yes",
    "hasAdditionalLocations": "No",
    "isLinkedToDistributor": "No",
    "glsCommitments": [],
    "complianceChecklist": []
  },
  "additional_locations": { "additionalShops": [], "godowns": [] },
  "distributor_links": [],
  "demo_farmers_data": [],
  "documents": { "pan_card": "https://..." },
  "annexures": {
    "seTerritories": [],
    "sePrincipalSuppliers": [],
    "seChemicalProducts": [],
    "seBioProducts": [],
    "seOtherProducts": [],
    "seHasCreditReferences": "No",
    "seCreditReferences": [],
    "seWillShareSales": false,
    "seGrowthVision": "",
    "seSecurityDeposit": "",
    "sePaymentProofText": ""
  },
  "update_history": [
    { "timestamp": "2025-02-01T12:00:00Z", "action": "Admin Edited Profile", "updated_status": "SUBMITTED" }
  ],
  "status": "SUBMITTED",
  "onboarded_by": "SE Name"
}
```

### Update submitted (PATCH body — key fields)

Server must recalculate `total_score` and `category` from eight scoring aspects.

```json
{
  "primary_shop_name": "Agri Shop",
  "contact_mobile": "9876543210",
  "scoring": { "scoreFinancial": 7, "scoreReputation": 6 },
  "documents": { "gst_cert": "https://..." }
}
```

### Update draft (PATCH body)

```json
{
  "draft_data": {
    "shopName": "Agri Shop",
    "contactMobile": "9876543210",
    "owners": [{ "name": "Rajesh" }],
    "bankAccounts": []
  }
}
```

**Draft save omits scoring fields** in reference app (**Confirmed in code**) — scoring not persisted on draft path.

---

## Business Rules

| Rule | Status |
|------|--------|
| Page gated by `dealers.can_view`; edit by `dealers.can_edit` | **Confirmed in code** |
| Merge `dealers` + `drafts` where `entity_type='dealer'` | **Confirmed in code** |
| Draft rows: `id = entity_id`, `category = —`, `total_score = 0`, `status = DRAFT` | **Confirmed in code** |
| Eight scoring aspects (1–10 each): Financial, Reputation, Operations, Farmer Network, Team, Portfolio, Experience, Growth | **Confirmed in code** |
| `total_score` = sum of eight aspect scores | **Confirmed in code** |
| Category: Elite if >60; A-Category if ≥46; B-Category if ≥26; else C-Category | **Confirmed in code** |
| Category recalc only on **submitted** save, not draft save | **Confirmed in code** |
| Append `update_history` entry on admin edit | **Confirmed in code** |
| GST: `/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/` | **Confirmed in code** |
| PAN: `/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/` | **Confirmed in code** |
| Mobile: exactly 10 digits | **Confirmed in code** |
| Bank account: all fields required; account 9–18 digits; IFSC `/^[A-Z]{4}0[A-Z0-9]{6}$/` | **Confirmed in code** |
| Security deposit >0 requires payment proof text or `se_payment_proof` document | **Confirmed in code** |
| Document upload via Cloudinary (placeholder preset in code) | **Confirmed in code** |
| Initial dealer onboarding / submit from mobile | **UNCONFIRMED (needs manual product decision)** |
| Approval workflow (APPROVED/REJECTED) for dealers in admin | **UNCONFIRMED** — admin has no approve/reject page |

---

## What the Old App Does Not Expose

- Admin **create** new dealer
- Admin **delete** dealer or draft
- Separate **approve/reject** workflow
- Server-side **export** (client-only CSV/PDF)
- **Settings** dealer template persistence (`SettingsTemplatePage` — not wired to these pages)

---

## Dependencies

| API | Purpose |
|-----|---------|
| `GET /api/auth/me` | Session user id |
| `GET /api/auth/me/permissions` | Module gate |
| `GET /api/profiles?role=SE` | SE filter options |
| File upload service | Cloudinary or equivalent for documents |
| Location catalog | GitHub JSON or Location Master (dealer uses external JSON, not `districts` table) |
