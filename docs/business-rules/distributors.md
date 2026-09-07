# Business Rules — Distributors

**Source system:** Field Commander Admin (`earthflow-admin-live`)  
**Module:** Distributors  
**Related routes / keys:** `/distributors`, permission `distributors`; Settings `/settings/distributor`; mobile key `mobile_distributor`  
**Primary sources:** `src/pages/DistributorsPage.tsx`, `src/components/DistributorTable.tsx`, `src/components/DistributorDetailSheet.tsx`, `src/pages/SettingsTemplatePage.tsx`, migration `distributors`, Dashboard/SE consumers

This document describes **business behavior** for Distributors as implemented in the reference project. It is not a redesign.

Legend:

- **Confirmed** — directly supported by implementation  
- **Implementation Detail** — how the old app encodes the rule  
- **Unconfirmed** — not proven here  
- **`UNCONFIRMED — likely implemented outside this admin repository`** — mobile / remote DB  

---

## 1. Module Purpose

### Confirmed

Admin **read-only directory** for distributors onboarded by field SEs:

1. List submitted `distributors` merged with `drafts` (`entity_type = 'distributor'`)  
2. Filter/search; export CSV / print PDF  
3. Open detail sheet to **view** firm, scoring, network, documents, annexures, PDF dossier  

Unlike Dealers, admin has **no edit/save**, no scoring recalculation, no document upload, and no validation in this module.

UI copy: “Distributor Directory” — “total records onboarded by field SEs.”

---

## 2. How Distributors Differ from Dealers (Confirmed)

| Capability | Dealers | Distributors |
|---|---|---|
| Admin edit | Yes (`DealerDetailSheet`) | **No** |
| Score recalculation on save | Yes (8 aspects → category) | **None in admin** |
| Category/band field name | `category` (Elite/A/B/C) | `band` (stored string) |
| Draft mapping richness | Full JSON reshape | **Minimal** list fields only |
| Document upload | Attempted (Cloudinary) | View only |
| Detail tabs | Editable Basic/Scoring/Business/Docs/Annexures | Read-only Basic/Profiling/Network/Annexures |
| `can_edit` usage | Gates Edit button | Not used on detail sheet |
| Status UI | DRAFT + generic / APPROVED | DRAFT, SUBMITTED, APPROVED, REJECTED styled |

---

## 3. Distributor Entity and Important Fields

### Confirmed — `distributors` table (migration)

| Field | Role |
|---|---|
| `id` | PK |
| `se_id` | Owning SE (`profiles.id`); ON DELETE SET NULL |
| `firm_name` | Firm display name |
| `owner_name` | Owner |
| `contact_person`, `contact_mobile`, `email` | Contacts |
| `address`, `city`, `state`, `taluka`, `pincode` | Location (flat columns, not Location Master FKs) |
| `gst_number`, `pan_number` | Statutory |
| `est_year`, `firm_type` | Firm meta |
| `bank_details` | JSON |
| `scoring` | JSON (opaque to admin logic) |
| `business_scope` | JSON |
| `dealer_network` | JSON (channel network description) |
| `commitments` | JSON |
| `documents` | JSON |
| `annexures` | JSON |
| `raw_data` | JSON leftover submission payload |
| `total_score` | Numeric |
| `band` | Text band/category label |
| `status` | Default `'DRAFT'` in migration |
| `pdf_url` | Dossier link |
| `created_at` | Timestamp |

No `update_history` column in local migration; Dist detail sheet does not write history.

---

## 4. Onboarding Lifecycle

### Confirmed in admin

```
External create draft and/or distributors row
        ↓
Admin lists drafts + submitted together
        ↓
Admin views detail (read-only)
        ↓
(No admin promote / approve / edit path)
```

### Confirmed lifecycle states **displayed**

| Status | UI |
|---|---|
| `DRAFT` | “Saved Draft” (from drafts merge or stored status) |
| `SUBMITTED` | Blue-tinted badge |
| `APPROVED` | Green-tinted badge |
| `REJECTED` | Red-tinted badge |
| other / empty | Gray / “Pending” |

### Confirmed

Admin does **not** transition these statuses. Presence of APPROVED/REJECTED badges implies external review, but **no approval actions** exist in this repository.

**`UNCONFIRMED — likely implemented outside this admin repository`:** draft creation, submit, approve/reject, scoring at submit.

---

## 5. Draft vs Submitted Behavior

### Confirmed load merge (`DistributorsPage`)

1. Fetch all `distributors` with `profiles:se_id(name)`  
2. Fetch `drafts` where `entity_type = 'distributor'`  
3. Map drafts to thin rows:

| Draft field | Mapped |
|---|---|
| `entity_id` | `id` |
| `se_id` | `se_id` |
| `draft_data.firmName` | `firm_name` |
| `draft_data.contactPerson` | `contact_person` |
| `draft_data.contactMobile` | `contact_mobile` |
| `draft_data.city` | `city` |
| — | `status: 'DRAFT'`, `total_score: 0`, `band: '—'` |
| `updated_at` | `created_at` |
| `profiles` | onboarded-by |

4. Concatenate; sort by `created_at` desc  

### Confirmed draft detail limitation

Opening a draft row only has those mapped fields. Scoring, bank, annexures, etc. are **not** hydrated from `draft_data` into the list row → detail sheet shows mostly empty profiling for drafts unless somehow present on the thin object (they are not).

### Confirmed — no draft update path

Unlike Dealers/Farmers, no admin mutation of `drafts` or `distributors`.

---

## 6. Creation / Required Fields / Validation

### Confirmed

- No create UI  
- No admin validation rules  

**`UNCONFIRMED — likely implemented outside this admin repository`:** required fields at mobile onboarding.

Settings seed commitments (GST verified, warehouse inspection, distribution agreement, exclusivity optional, payment terms) are **not** enforced here and **not persisted**.

---

## 7. Sales Executive Assignment

### Confirmed

- Ownership: `se_id`  
- Display: “Onboarded By” = `profiles.name`  
- Filter/search by SE name  
- SE detail counts submitted distributors only (not drafts)  
- Dashboard: total = distributors + distributor drafts; pending = drafts  

Admin cannot reassign SE.

---

## 8. Dealer / Network Relationships

### Confirmed

| Link | Behavior |
|---|---|
| `dealer_network` JSON | Shown read-only under “Dealer Network” |
| Dealers → `distributor_links` | Dealers module stores soft links **to** distributors; not queried from Distributors page |
| FK dealers→distributors | **None** in schema for reverse navigation |

No admin logic tying distributor rows to dealer rows by id.

---

## 9. Location / Address

### Confirmed

Flat fields on `distributors`: address, city, state, taluka, pincode.  
Not linked to Location Master or Routes.  
Drafts expose only `city` in directory mapping.

---

## 10. Scoring and Band Behavior

### Confirmed what admin does with scores

- **Displays** `scoring` JSON via KeyValueGrid  
- **Displays** `band` and `total_score` badges  
- **Does not** compute, edit, or validate them  

### Confirmed — no formula in this module

No sum of dimensions, no band thresholds in DistributorDetailSheet / DistributorsPage.

### Confirmed Settings template (non-runtime)

Single scoring category key `turnover` (“Annual Turnover”), maxScore 10, tiers at scores 2/4/6/8/10 with INR bands. Commitments listed in §6. Persist TODO — not read by Distributors UI.

### Unconfirmed

| Question | Status |
|---|---|
| Exact score dimensions beyond Settings seed | Unknown — live `scoring` JSON shape not defined in admin |
| How `total_score` is calculated | **UNCONFIRMED — likely outside this admin repository** |
| How `band` is derived / thresholds | **UNCONFIRMED — likely outside this admin repository** |
| Whether band uses green/red/A/C naming | UI `bandVariant` styles strings containing “green”/“red” or exact `a`/`c` — suggests possible band labels, not proven as stored values |

Do **not** invent thresholds. Unlike Dealers’ Elite/A/B/C rules, none are confirmed for distributors in this repo.

---

## 11. Commitments / Annexures / Documents

### Confirmed

- Viewed as opaque JSON grids  
- `pdf_url` → “View PDF Dossier” button when present  
- No upload/replace in admin  
- Draft list mapping does not include documents/annexures  

---

## 12. Edit / Update / History / Delete

### Confirmed

| Action | Present? |
|---|---|
| Edit draft | No |
| Edit submitted | No |
| update_history | Not written by this module |
| Delete / deactivate | No |
| Approve / Reject buttons | No |

---

## 13. Approval / Review

### Confirmed

Status values SUBMITTED / APPROVED / REJECTED are **display-only** in admin.  
No separate approvals page for distributors.

Whether APPROVED is a true business gate: **Unconfirmed** outside repo.

---

## 14. Permissions & Visibility

### Confirmed

| Key | Effect |
|---|---|
| `distributors.can_view` | Access directory; Access Denied otherwise |
| `distributors.can_edit` | **Unused** by DistributorsPage / DetailSheet |

Global scope (all SEs). Super Admin–only Settings nav for distributor template (separate from module permission).

---

## 15. Search / Filter / Export

### Confirmed filters

Status, Band (excludes `—`), Onboarded By.

Search: firm_name, owner_name, contact_mobile, city, SE name.

### Confirmed conflict — filtered export

Page sets `onFilteredDataChange={setFilteredData}` but `DistributorTable` **does not pass** `onFilteredDataChange` into `DataTable` → exports typically remain the initial full combined list after load (same class of bug as Dealers unless DataTable somehow receives it — it does not from DistributorTable).

### Confirmed export columns

Sr, Firm Name, Contact Person, Mobile, City, Band, Onboarded By, Date, Status.

---

## 16. Relationships to Farmers / FPOs / Routes

### Confirmed

- No farmer FK from distributors  
- No FPO link in this module  
- No route/territory usage of `distributors` table  

Dealers may reference distributors via soft JSON links only.

---

## 17. Edge Cases

### Confirmed

1. Draft detail nearly empty (thin mapping).  
2. `can_edit` unused despite existing in roles.  
3. Export filter sync broken.  
4. Band/score forced blank/zero for drafts even if draft_data had scores.  
5. `raw_data` only shown if present on submitted row.  
6. Owner column uses `owner_name`; export uses `contact_person` — drafts map contactPerson but not ownerName → Owner column “—” for drafts.  

---

## 18. Calculations / Derived Values

### Confirmed in admin

None beyond UI badge styling heuristics for band strings.

Stored `total_score` / `band` are treated as **precomputed** inputs.

---

## 19. Cross-Module Effects

| Module | Interaction |
|---|---|
| Sales Executives | `se_id`; counts |
| Dealers | Soft `distributor_links` from dealer side |
| Dashboard | KPI totals/pending |
| Settings distributor | Non-persisted scoring/commitment seeds |
| Roles | `distributors`, `mobile_distributor` |

---

## 20. Rules a New Stack Must Preserve

1. Merge distributor drafts + submitted rows in directory with DRAFT status for drafts.  
2. Own records by `se_id`; show onboarded-by.  
3. Surface `band` and `total_score` as first-class display fields (even if computed elsewhere).  
4. Support status vocabulary at least DRAFT / SUBMITTED / APPROVED / REJECTED for display.  
5. Read-only admin inspection of scoring, business_scope, dealer_network, bank, documents, annexures, raw_data, pdf_url — **or** explicitly add edit if product requires parity with Dealers.  
6. Preserve flat address fields unless redesigning location model.  
7. Do not invent band thresholds without confirming mobile/DB rules.  
8. Keep soft dealer↔distributor linking behavior consistent with Dealers module.  

---

## 21. Important Unresolved / Conflicting Rules

1. Band/score calculation entirely external — Settings turnover tiers may or may not match mobile.  
2. Admin read-only vs Dealers editable — intentional product split or incomplete port?  
3. Draft mapping too thin for meaningful draft review.  
4. `can_edit` unused.  
5. Export ignores filtered callback wiring.  
6. Meaning of APPROVED/REJECTED without admin actions.  
7. Shape of `scoring` / `dealer_network` JSON unknown in admin.  

---

## 22. Cross-Module Dependencies

**Depends on:** Profiles/SE, Permissions, drafts table.  

**Depended on by:** Dashboard, SE counts; Dealers (outbound soft links).

---

## 23. Evidence / Source Index

| Concern | Source |
|---|---|
| List merge, exports, permissions | `src/pages/DistributorsPage.tsx` |
| Filters, status/band UI | `src/components/DistributorTable.tsx` |
| Read-only detail | `src/components/DistributorDetailSheet.tsx` |
| Schema | `supabase/migrations/20260511052322_….sql` |
| Non-persisted templates | `SettingsTemplatePage.tsx` |
| KPIs / SE counts | `Dashboard.tsx`, `SEDetailSheet.tsx` |
| Dealer soft links | `DealerDetailSheet.tsx` / `DealersPage.tsx` |

---

## 24. Rules That Appear to Live Outside This Repository

1. Creating distributor drafts and `distributors` rows  
2. Draft → submitted promotion  
3. Computing `scoring`, `total_score`, `band`  
4. Setting status SUBMITTED / APPROVED / REJECTED  
5. Filling business_scope, dealer_network, commitments, annexures, documents, raw_data  
6. Generating `pdf_url`  
7. Any live `form_templates` consumption  

Mark: **`UNCONFIRMED — likely implemented outside this admin repository`**.

---

*End of Distributors business rules extraction.*
