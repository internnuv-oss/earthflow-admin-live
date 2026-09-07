# Business Rules — FPOs

**Source system:** Field Commander Admin (`earthflow-admin-live`)  
**Module:** FPOs  
**Related routes / keys:** `/fpos`, permission `fpos` (label: “FPOs Directory”); mobile key `mobile_fpo`  
**Primary sources:** `src/pages/FposPage.tsx`, `src/components/FpoTable.tsx`, `src/components/FpoDetailSheet.tsx`

This document describes **business behavior** for FPOs as implemented in the reference project. It is not a redesign.

Legend:

- **Confirmed** — directly supported by implementation  
- **Implementation Detail** — how the old app encodes the rule  
- **Unconfirmed** — not proven here  
- **`UNCONFIRMED — likely implemented outside this admin repository`** — mobile / remote DB  

---

## 1. Module Purpose

### Confirmed

Admin **FPO Directory** for Farmer Producer Organizations onboarded by field SEs:

1. List submitted `fpos` merged with `drafts` (`entity_type = 'fpo'`)  
2. Filter/search (including date range); export CSV / print PDF  
3. Open detail sheet to view profile and evaluation JSON  
4. With `fpos.can_edit`, edit **basic profile fields** (not scoring/evaluations)

UI copy: “FPO Directory” — “total FPOs onboarded by field SEs.”

Admin does **not** create new FPOs, approve/reject as a workflow, delete FPOs, or recalculate scores.

---

## 2. How FPOs Differ from Dealers / Distributors (Confirmed)

| Capability | Dealers | Distributors | FPOs |
|---|---|---|---|
| Admin edit basic profile | Yes | No | **Yes** |
| Admin edit / recalculate scoring | Yes (8 aspects → category) | No | **No** (read-only Evaluations) |
| Draft list mapping | Rich reshape | Thin | **Rich** (many camelCase → snake_case fields + JSON blocks) |
| Document upload | Attempted | View only | **Not in UI** |
| PDF dossier button | Yes | Yes | Type has `pdf_url` but **no View PDF control** in detail sheet |
| Settings onboarding template | Yes (non-persisted) | Yes (non-persisted) | **None** |
| Dashboard KPI | Yes (with drafts) | Yes | **No** |
| SE detail network count | Yes | Yes | **No** |
| Table date range filter | Check Dealers | No | **Yes** |
| Export filtered callback | Often unwired | Unwired | **Wired** (`onFilteredDataChange` passed) |

---

## 3. FPO Entity and Important Fields

### Confirmed — fields used by admin (no local `fpos` migration)

Inferred from list mapping, detail form, and updates:

| Field | Role |
|---|---|
| `id` | PK (drafts use `entity_id` as list `id`) |
| `se_id` | Owning SE; join `profiles:se_id(name)` as “Onboarded By” |
| `fpo_name` | Display / required on edit (≥2 chars) |
| `contact_mobile` | Contact; required 10 digits on save |
| `email` | Optional |
| `registration_number` | Reg # |
| `incorporation_year` | Inc. year (maxLength 4 in form) |
| `ceo_name` | CEO |
| `bod_president_name` | BOD President |
| `gst_number` / `pan_number` | Statutory (uppercased in edit inputs) |
| `address`, `state`, `city`, `taluka`, `pincode` | Location (flat strings; `city` labeled **District** in UI) |
| `promoting_agency` | Promoting agency |
| `command_area` | Command area |
| `status` | e.g. DRAFT (forced for drafts), SUBMITTED, other |
| `created_at` | Sort/export date (drafts use `drafts.updated_at`) |
| `member_base` | JSON (evaluations) |
| `business_scope` | JSON (evaluations) |
| `scoring` | JSON (evaluations) |
| `total_score` | Numeric shown in Evaluations |
| `band` | Present on `FpoRow` type; **not displayed** in table/detail UI |
| `bank_details` | Draft maps `{ bankAccounts }`; not edited in sheet |
| `documents` | Passed through for drafts; not edited in sheet |
| `storage_locations` | Draft-mapped; not shown in detail tabs |
| `commitments` | Draft-mapped; not shown in detail tabs |
| `update_history` | Audit array appended on admin save |
| `pdf_url` | Typed; unused in FpoDetailSheet |

---

## 4. Onboarding Lifecycle

### Confirmed in admin

```
External create draft and/or fpos row
        ↓
Admin lists drafts + submitted together
        ↓
Admin views detail
        ↓
Optional admin edit of basic fields
   (draft → drafts.draft_data | submitted → fpos)
        ↓
(No admin promote / approve / delete path)
```

### Confirmed status display

| Status | UI |
|---|---|
| `DRAFT` | Orange “Draft” badge (from drafts merge or stored) |
| `SUBMITTED` | Default (primary) badge |
| other / empty | Secondary badge / “Pending” |

Admin does **not** transition status. Approval as a separate business state is **not** implemented here.

**`UNCONFIRMED — likely implemented outside this admin repository`:** draft creation, submit to `fpos`, scoring at submit, status values beyond DRAFT/SUBMITTED.

---

## 5. Draft vs Submitted Behavior

### Confirmed load merge (`FposPage`)

1. Fetch all `fpos` with `profiles:se_id(name)`  
2. Fetch `drafts` where `entity_type = 'fpo'`  
3. Map `draft_data` into directory rows (see below)  
4. Concatenate; sort by `created_at` desc  

### Confirmed draft field mapping

| `draft_data` (camelCase) | List / detail field |
|---|---|
| `fpoName` | `fpo_name` (fallback “Incomplete FPO”) |
| `contactMobile` | `contact_mobile` |
| `city`, `state`, `taluka`, `address`, `pincode` | same |
| `registrationNumber` | `registration_number` |
| `ceoName` | `ceo_name` |
| `bodPresidentName` | `bod_president_name` |
| `email`, `gstNumber`→`gst_number`, `panNumber`→`pan_number` | |
| `promotingAgency` | `promoting_agency` |
| `commandArea` | `command_area` |
| `bankAccounts` | `bank_details.bankAccounts` |
| `documents` | `documents` |
| `business_scope`, `member_base`, `storage_locations`, `commitments`, `scoring` | same keys |
| — | `status: 'DRAFT'` |
| `draft.updated_at` | `created_at` |
| `entity_id` | `id` |

### Confirmed — draft vs submitted save targets

| Condition | Persist to |
|---|---|
| `status === 'DRAFT'` | `drafts.update({ draft_data, updated_at, update_history })` matching `id.eq` **or** `entity_id.eq` |
| otherwise | `fpos.update(payload)` by `id` |

### Confirmed conflict — draft save can drop evaluation JSON

Draft save rebuilds `draft_data` with basic fields + `bankAccounts` + `documents` only. It does **not** re-include `member_base`, `business_scope`, `scoring`, `commitments`, or `storage_locations` from the in-memory row.

**Risk:** Admin “Save Changes” on a draft can **wipe** those nested evaluation blocks in `draft_data` even though Evaluations tab is read-only.

Submitted `fpos.update` payload also omits those JSON blocks (leaves them unchanged in DB if columns not sent — depending on PostgREST partial update behavior; only listed columns are updated, so submitted evaluations are **preserved**). Draft path is the risky one.

---

## 6. Creation / Required Fields / Validation

### Confirmed

- No create UI in admin  
- Save validation (edit only):

| Rule | Enforcement |
|---|---|
| FPO Name required, length ≥ 2 | Yes |
| Contact Mobile exactly 10 digits (`/^\d{10}$/`) | Yes |
| State / District / Taluka labeled `*` in form | **Not validated** on save |
| Email / GST / PAN / pincode format | No pattern checks (GST/PAN uppercased; pincode maxLength 6) |

**`UNCONFIRMED — likely implemented outside this admin repository`:** required fields at mobile onboarding.

No Settings FPO scoring/commitment template in this app.

---

## 7. Sales Executive Assignment

### Confirmed

- Ownership: `se_id`  
- Display: “Onboarded By” = `profiles.name`  
- Filter/search by SE name  
- SE dropdown includes **all** `role = 'SE'` names (demo SEs **not** excluded — same pattern as Dealers/Distributors/Farmers filters)  
- Admin cannot reassign SE  
- SE detail sheet does **not** count FPOs  

---

## 8. Location / Address

### Confirmed

Flat text fields on the FPO: address, state, city (UI: District), taluka, pincode.  
Not linked to Location Master FKs or Routes.  
Table filter label for `city` is **“District”**.

---

## 9. Scoring / Band / Evaluations

### Confirmed what admin does

- **Evaluations** tab (read-only): merges `member_base`, `business_scope`, `scoring`, and displays `Total Score: f.total_score`  
- Does **not** edit scoring  
- Does **not** compute `total_score` or `band`  
- `band` unused in UI despite type  

### Unconfirmed

Score dimensions, formulas, band thresholds, and when `total_score` is written: **`UNCONFIRMED — likely implemented outside this admin repository`**. Do not invent formulas.

---

## 10. Bank / Documents / Commitments / Storage

### Confirmed

- Draft mapping carries bank/documents/commitments/storage into the row object  
- Detail sheet does **not** render dedicated Bank/Documents/Commitments sections (unlike Dealers)  
- No upload/replace in admin  
- `pdf_url` not surfaced as a button  

---

## 11. Edit / Update / History / Delete

### Confirmed editable fields (when `canEdit` + Edit Profile)

`fpo_name`, `contact_mobile`, `email`, `registration_number`, `incorporation_year`, `ceo_name`, `bod_president_name`, `gst_number`, `pan_number`, `address`, `state`, `city`, `taluka`, `pincode`, `promoting_agency`, `command_area`

### Confirmed audit

Every save appends to `update_history`:

```
{ timestamp: ISO, action: 'Admin Edited Profile', updated_status: f.status }
```

Draft saves also write `update_history` onto the `drafts` row.

### Confirmed

| Action | Present? |
|---|---|
| Edit draft basic fields | Yes |
| Edit submitted basic fields | Yes |
| Edit evaluations/scoring | No |
| Delete / deactivate | No |
| Approve / Reject | No |
| Promote draft → submitted | No |

After save: toast, exit edit, `onSaved` → full page reload, close sheet.

---

## 12. Approval / Review

### Confirmed

Status is display-only. No FPO approvals page. SUBMITTED is a badge style, not an admin action.

---

## 13. Permissions & Visibility

### Confirmed

| Key | Effect |
|---|---|
| `fpos.can_view` | Access directory; Access Denied otherwise |
| `fpos.can_edit` | “Edit Profile” on detail sheet |

`canEdit` is passed to `FpoTable` but **unused** there (no row-level edit control).

Global scope (all SEs’ FPOs). Exports available with view access.

---

## 14. Search / Filter / Export

### Confirmed filters

- Date From / To on `created_at` (inclusive end-of-day); Clear Dates  
- Status (dynamic from rows)  
- State  
- District (`city`)  
- Onboarded By (SE name)  

Search: fpo_name, contact_mobile, city, state, SE name.

### Confirmed export

CSV and print-PDF use `filteredData` updated via `onFilteredDataChange` (wired correctly, unlike Distributors).

CSV columns: Sr, FPO Name, Reg Number, Contact Mobile, City, State, CEO Name, Onboarded By, Date, Status.  
PDF columns: similar but **omits CEO Name**.

Filename: `fpos_export_{YYYY-MM-DD}.csv`.

---

## 15. Relationships to Farmers / Dealers / Routes / Retail

### Confirmed

- No farmer FK from FPOs in this module  
- No dealer/distributor link  
- No route/territory usage of `fpos`  
- Retail orders use denormalized farmer fields, not FPO  

---

## 16. Edge Cases

### Confirmed

1. Draft admin save may strip evaluation JSON from `draft_data`.  
2. Location fields marked required in UI but not validated.  
3. `band` unused; `pdf_url` unused in UI.  
4. `storage_locations` / `commitments` mapped on load but not shown.  
5. Incomplete draft names show “Incomplete FPO”.  
6. Mobile validation rejects non-10-digit including placeholder “—” from thin incomplete drafts if user tries to save without fixing.  
7. SE filter includes demo SEs.  
8. No Dashboard / SE KPI for FPO counts.  

---

## 17. Calculations / Derived Values

### Confirmed in admin

None. `total_score` is displayed as stored.

---

## 18. Cross-Module Effects

| Module | Interaction |
|---|---|
| Sales Executives | `se_id`; Onboarded By (not in SE network counts) |
| Drafts | `entity_type = 'fpo'` |
| Permissions / Roles | `fpos`, `mobile_fpo` |
| Settings | No FPO template |
| Dashboard | No FPO card |

---

## 19. Rules a New Stack Must Preserve

1. Merge FPO drafts + submitted rows; force DRAFT status for drafts.  
2. Own records by `se_id`; show onboarded-by.  
3. Allow admin edit of basic profile fields with name ≥2 and 10-digit mobile.  
4. Persist draft vs submitted to different stores (`drafts` vs `fpos`).  
5. Append `update_history` on admin edits.  
6. Keep Evaluations (member_base / business_scope / scoring / total_score) read-only in admin unless product expands parity with Dealers.  
7. Preserve District label for `city` if matching field-app terminology.  
8. Do not invent score/band formulas without mobile/DB confirmation.  
9. Avoid draft-save data loss for nested evaluation keys (current bug to fix or consciously preserve).  

---

## 20. Important Unresolved / Conflicting Rules

1. Draft save **omits** evaluation JSON → data-loss conflict with read-only Evaluations intent.  
2. UI `*` on location vs no validation.  
3. Scoring/band derivation entirely external; `band` unused in UI.  
4. `pdf_url` typed but not shown.  
5. No Settings template / Dashboard presence vs other channel partners.  
6. Status vocabulary beyond DRAFT/SUBMITTED unknown.  

---

## 21. Cross-Module Dependencies

**Depends on:** Profiles/SE, Permissions, `drafts`, `fpos`.  

**Depended on by:** None for writes in this admin app.

**Related docs:** `dealers.md`, `distributors.md`, `sales-executives.md`, `roles-and-access.md`.

---

## 22. Evidence / Source Index

| Concern | Source |
|---|---|
| List merge, exports, permissions | `src/pages/FposPage.tsx` |
| Filters, date range, status UI | `src/components/FpoTable.tsx` |
| Edit, validation, draft/submitted save, history | `src/components/FpoDetailSheet.tsx` |
| Phase 0 notes | `docs/module-inventory.md` |

---

## 23. Rules That Appear to Live Outside This Repository

1. Creating FPO drafts and `fpos` rows  
2. Draft → submitted promotion  
3. Computing `scoring` / `total_score` / `band`  
4. Filling member_base, business_scope, commitments, storage_locations, documents, bank accounts at onboarding  
5. Generating `pdf_url`  
6. Any live FPO form templates  

Mark: **`UNCONFIRMED — likely implemented outside this admin repository`**.

---

*End of FPOs business rules extraction.*
