# Expenses — V2 API Requirements Audit

**Project:** FieldCommander Admin Dashboard (legacy)  
**Module:** Expenses (`/expenses`) — Travel & Expenses review, TA/DA adjustment, workflow actions, exports  
**Audit type:** Read-only frontend → backend capability inventory  
**Date:** 2026-08-26  
**Scope rule:** Conclusions are labeled **Verified**, **Inferred**, **Mocked**, **Partial**, or **New V2**. No application source files were modified for this audit. Requested V2 product features are **not** treated as verified legacy behavior.

---

## 1. Executive summary

### What the legacy Expenses module actually is

**Verified:** A single admin page that lists `expenses` rows from Supabase, filters them client-side, and opens a review sheet for approve / reject / query. There is **no** dedicated REST client, React Query store, typed OpenAPI schema, or mock expense dataset in this repo.

- List is month- or single-date scoped (`expenses.date` ISO range), ordered newest first.
- Demo SEs are excluded via a client-side filter against non-demo `profiles` (`role = SE`).
- Categories used in UI filters: `TA/DA`, `Travelling`, `Food`, `Misc`.
- Statuses: `Pending`, `Approved`, `Queried`, `Rejected`. Only **Pending** and **Queried** are actionable.
- TA/DA amounts shown in the review sheet are **recomputed in the browser** from linked `shifts` distance (odo preferred, else GPS `total_distance`), with rates ₹4/km or ₹8/km and DA ₹150 when distance > 60 km.
- Vehicle type for rate is **not** read from `shifts.vehicle_type`; it is **reverse-inferred** from whether submitted `amount − DA` equals `distance × 8`.
- On Approve for `TA/DA`, admin may toggle/edit TA and DA components; the **stored `amount` is overwritten** with the adjusted total, and a machine string is appended into `remarks`.
- Admin narrative lives in a single `admin_comments` column (optional in UI; not a conversation thread).
- Exports are **two synchronous client-generated CSVs** (detailed raw + consolidated SE payout), not server jobs.

### What V2 asks for vs what legacy does

| V2 requested capability | Legacy reality | Label |
|---|---|---|
| Admin views all executive expenses | Yes, month/date window; non-demo SEs only | **Verified** |
| Auto-calculated TA/DA | Display/recalc in admin UI from shift; original amount authored elsewhere (mobile) | **Partial** (calc is client; creation not in admin) |
| Review individual and grouped claims | Individual rows only; no claim-group / multi-day claim entity | Individual = **Verified**; grouped = **New V2** |
| Approve / reject / query | Yes when `can_edit` and status Pending\|Queried | **Verified** |
| Query/reject require comment | Comment field exists but is **optional** | **Partial**; required = **New V2** |
| Export expense reports | Details CSV + Approved payout CSV (client Blob) | **Verified** (client); server/async = **New V2** optional |

### Critical engineering notes for backend

1. **Entered vs calculated amounts:** Non-`TA/DA` categories use submitted `amount` as-is. For `TA/DA`, mobile/system submits a combined `amount` (often with `receipt_url = 'SYSTEM_GENERATED'`). Admin UI recalculates TA/DA for display and **may change `amount` on approve**.
2. **Calculation breakdown is shown** for `TA/DA` when a shift is linked (distance, duration, TA rate, DA, editable components, odo photos).
3. **Approval can change claimed/calculated amounts** for `TA/DA` only; other categories keep `amount` unchanged on status update.
4. **Workflow:** Pending|Queried → Approved|Rejected|Queried. No UI path from Approved/Rejected back to Pending. No concurrency / ETag. No action history table.
5. **Comments:** Single overwriteable `admin_comments` string — **not** a threaded conversation. TA/DA split metadata is encoded into `remarks` as `[Adjusted on approval: …]`.
6. **Attachments:** Receipt and odo images are **public URL strings** opened in a new tab; no signed download API in admin.
7. **Export:** Synchronous fetch + browser CSV. Payout export includes only `status = Approved` and re-splits TA/DA client-side (fragile vs remarks overrides).
8. **Currency / precision:** INR (`₹`, `en-IN`). Display uses 2 fraction digits; payout CSV uses `.toFixed(2)`. Distance odo rounded to 1 decimal. No tax fields.
9. **Timezone:** Month/date filters build UTC ISO bounds from `YYYY-MM` / `YYYY-MM-DD` strings (`T00:00:00.000Z` … next month). Browser `toLocaleDateString()` for display — org timezone (e.g. Asia/Kolkata) is **Inferred** V2 need.
10. **`src/integrations/supabase/types.ts`** is not a usable expenses schema source in this repo.

---

## 2. Legacy implementation map

### 2.1 Navigation & entry

| Item | Detail | Confidence |
|---|---|---|
| Sidebar | “Expenses” → `/expenses`, module `expenses` | **Verified** — `AppSidebar.tsx` L40 |
| Router | `<Route path="/expenses" element={guard(<ExpensesPage />)} />` | **Verified** — `Index.tsx` L62 |
| Permission | `getModulePerm('expenses')` → `{ can_view, can_edit }` | **Verified** — `ExpensesPage.tsx` L18–19; `usePermissions.ts` |
| Roles matrix (web) | Module key `expenses`, label “Expenses Management” | **Verified** — `RolesPage.tsx` L23; `PermissionEditor.tsx` L16 |
| Mobile companion perm | `mobile_travel_activity` — “Executive Travel Activity (Attendance, Reports, Expenses)” | **Verified** — `RolesPage.tsx` L38 (mobile; admin does not call it) |
| Related nav | Attendance `/attendance`, Shifts `/shifts` | **Verified** |

### 2.2 UI surface map

```
/expenses  ExpensesPage
├── Permission gate (can_view) → Access Denied
├── Header: Travel & Expenses + Export SE Payouts + Details CSV
├── Filters: specific date | month | executive | category | status tabs
├── Table: Date | Executive | Category | Amount | Status | Review
│   ├── Row click / Review → ExpenseActionSheet
│   ├── Client pagination (15 / page)
│   └── Footer: filtered row range + Filtered Total ₹ sum
├── Export SE Payouts dialog → month → client CSV (Approved only, TA/DA split)
└── Details CSV dialog → month + SE + category → client CSV

ExpenseActionSheet
├── Header: SE name • date • status badge
├── Amount hero (live adjusted total for actionable TA/DA)
├── If category TA/DA + linked shift:
│   ├── Distance / Duration cards
│   ├── TA checkbox + editable ₹ (rate 4 or 8 inferred)
│   ├── DA checkbox + editable ₹ (if distance > 60 or custom DA > 0)
│   ├── Adjusted Total
│   └── Start/End odo images (shift URLs)
├── Executive remarks (approval marker stripped for display)
├── Receipt image if receipt_url present and ≠ SYSTEM_GENERATED
├── Admin Comment textarea (optional)
└── Footer (can_edit && Pending|Queried): Reject | Query | Approve
```

### 2.3 Source files (Expenses core)

| File | Role |
|---|---|
| `src/pages/ExpensesPage.tsx` | List, filters, pagination, filtered total, both CSV exports |
| `src/components/ExpenseActionSheet.tsx` | Detail review, TA/DA math, approve/reject/query update |
| `src/hooks/usePermissions.ts` | RBAC / Super Admin / TH bypass |
| `src/components/AppSidebar.tsx` | Nav visibility |
| `src/pages/RolesPage.tsx` / `PermissionEditor.tsx` | Permission module registration |
| `src/pages/Index.tsx` | Route registration |

### 2.4 Shared / dependent modules

| File / table | Dependency |
|---|---|
| `profiles` | SE dropdown + name join; demo exclusion |
| `shifts` via `expenses.shift_id` | Times, km, `total_distance`, odo images for TA/DA |
| `src/pages/ShiftsPage.tsx` | Authors `vehicle_type` / distances used indirectly; Expenses sheet does **not** select vehicle fields |
| Attendance timeline | Icon style for `type === 'expense'` in events; **does not** query `expenses` |
| Dashboard | **No** expense widgets found |

### 2.5 Search term coverage

| Term | Finding |
|---|---|
| expense / expenses | **Verified** page + table + sheet |
| claim / reimbursement / settlement | **Not found** as entities or UI labels |
| TA / DA / TA/DA / travel allowance / daily allowance | **Verified** category + calc + payout split |
| mileage | **Not found** as term; distance km used |
| receipt | `receipt_url`; skip `SYSTEM_GENERATED` |
| approve / reject / query | Sheet actions |
| remark / admin_comments | Executive `remarks` + admin `admin_comments` |
| export | Two client CSVs |
| mock / hardcoded expense rows | **Not found** (live Supabase). Rates/thresholds are **hardcoded constants** in UI |
| bulk / group / history / audit / resubmit | **Not found** in Expenses UI |

---

## 3. Feature-to-API matrix

Legend **Status**: Verified | Partial | Mocked | Inferred | New V2  
Legend **Backend today**: Supabase table/query used by frontend

| # | UI feature / user action | Status | Existing data source | Recommended V2 endpoint | Notes |
|---|---|---|---|---|---|
| E1 | View expense list (all non-demo SEs) | **Verified** | `expenses` + `profiles` + `shifts` | `GET /v2/expenses` | Client paginates |
| E2 | Access denied without `expenses.can_view` | **Verified** | `role_permissions` / admin bypass | AuthZ on all expense APIs | |
| E3 | Filter by month | **Verified** | `date` gte/lt UTC month | `month=YYYY-MM` or `from`/`to` | |
| E4 | Filter by specific date | **Verified** | Same-day UTC window | `date=YYYY-MM-DD` | Overrides month |
| E5 | Filter by executive | **Verified** (client) | `se_id` | `executiveId` query | |
| E6 | Filter by category | **Verified** (client) | `category` | `category` query | Case-insensitive trim on client |
| E7 | Filter by status tabs | **Verified** (client) | `status` | `status` query | |
| E8 | Filtered total amount | **Verified** (client sum) | `amount` | Optional `summary.filteredTotal` | |
| E9 | Status/count summary cards | **New V2** | — | `GET /v2/expenses/summary` | Not in UI |
| E10 | Open expense detail / review | **Verified** | Row already in memory | `GET /v2/expenses/{id}` | Prefer refetch for concurrency |
| E11 | Show TA/DA calculation breakdown | **Verified** (client) | shift distance + hardcoded rules | Embed `tadaBreakdown` in detail | Server should own calc |
| E12 | Show duration from shift | **Verified** (client) | `end_time - start_time` | `shift.workingDurationHours` | |
| E13 | Receipt preview | **Verified** | `receipt_url` | Signed URL / download | Hide system placeholder |
| E14 | Odometer photo preview | **Verified** | `start_odo_image`, `end_odo_image` | Signed URLs | Via shift |
| E15 | Approve (optional amount adjust for TA/DA) | **Verified** | `expenses.update` | `POST /v2/expenses/{id}/approve` | |
| E16 | Reject | **Verified** | status → Rejected | `POST /v2/expenses/{id}/reject` | Comment optional legacy |
| E17 | Query | **Verified** | status → Queried | `POST /v2/expenses/{id}/query` | Comment optional legacy |
| E18 | Require comment on reject/query | **New V2** | optional textarea | Enforce in E16/E17 | Product ask |
| E19 | Re-action on Queried (approve/reject/query again) | **Verified** | `isActionable` includes Queried | Same transitions | Not a separate “resolve” API |
| E20 | Resubmission by executive after query | **Inferred** / **New V2** | not in admin | Mobile submit → Pending | Admin never creates expenses |
| E21 | Bulk approve/reject/query | **New V2** | — | `POST /v2/expenses/bulk-actions` | Not in UI |
| E22 | Grouped claim review (multi-line claim) | **New V2** | one row = one expense | Claim aggregate APIs | Not in UI |
| E23 | Status / action history | **New V2** | — | `GET /v2/expenses/{id}/history` | Not stored/shown |
| E24 | Team / territory filters | **New V2** | — | Query filters on E1 | Not in UI |
| E25 | Export detailed CSV | **Verified** (client) | re-query expenses | `GET /v2/expenses/exports/details` | Sync OK for small months |
| E26 | Export consolidated SE payouts | **Verified** (client) | Approved + TA/DA split | `GET /v2/expenses/exports/payouts` | Prefer server split |
| E27 | Async export job + download | **New V2** (optional) | — | Job + status + URL | Legacy is sync Blob |
| E28 | Audit log of who approved | **New V2** | no actor fields written by UI | Audit events | Update only sets status/amount/remarks/comments |
| E29 | Taxes / GST / limits | **Not found** | — | Optional policy engine | |
| E30 | Create/edit expense as admin | **Not found** | — | Out of admin scope unless New V2 | Review-only |

---

## 4. Detailed contracts

> Naming uses recommended REST for V2. Legacy uses Supabase PostgREST-style table access. Each contract lists fields the frontend **actually consumes**, plus **New V2** fields clearly marked.

### 4.1 `GET /v2/expenses`

**Purpose:** Power Travel & Expenses list table.  
**Confidence:** **Verified** — `ExpensesPage` fetch L76–116 + client filters L122–136.

#### Query parameters

| Param | Type | Required | Legacy behavior | V2 notes |
|---|---|---|---|---|
| `month` | `YYYY-MM` | alt | Default current month | Used when no specific date |
| `date` | `YYYY-MM-DD` | alt | Specific date overrides month | |
| `from` / `to` | ISO datetime | alt | Built as `…T00:00:00.000Z` to next day/month | Pin timezone |
| `executiveId` | uuid | no | Client filter `selectedSE` | |
| `category` | enum/string | no | Client case-insensitive | `TA/DA` \| `Travelling` \| `Food` \| `Misc` \| other |
| `status` | enum | no | Client tabs | `Pending` \| `Approved` \| `Queried` \| `Rejected` |
| `page` | int | no | Client `ITEMS_PER_PAGE = 15` | |
| `pageSize` | int | no | 15 | |
| `sort` | string | no | `date` desc | Legacy `.order('date', { ascending: false })` |
| `includeDemo` | boolean | no | Always exclude demo SEs client-side | Prefer server |
| `teamId` / `territoryId` | uuid | no | — | **New V2** |
| `timezone` | IANA | no | Browser + UTC bounds | **Inferred** `Asia/Kolkata` |

#### Existing legacy calls

```text
profiles.select('id, name').eq('role','SE').or('is_demo.eq.false,is_demo.is.null').order('name')

expenses.select('*, profiles:se_id(name), shifts:shift_id(start_time, end_time, start_km, end_km, total_distance, start_odo_image, end_odo_image)')
  .gte('date', startDateStr)
  .lt('date', endDateStr)
  .order('date', { ascending: false })
```

Then client filters: SE ∈ non-demo list; optional `se_id`, `status`, `category`.

#### Response (fields consumed by list)

```json
{
  "items": [
    {
      "id": "uuid",
      "date": "ISO timestamptz or date",
      "executiveId": "uuid",
      "executiveName": "string",
      "category": "TA/DA|Travelling|Food|Misc|string",
      "amount": 0,
      "currency": "INR",
      "status": "Pending|Approved|Queried|Rejected",
      "remarks": "string|null",
      "adminComments": "string|null",
      "receiptUrl": "string|null",
      "shiftId": "uuid|null",
      "shift": { }
    }
  ],
  "pagination": { "page": 1, "pageSize": 15, "total": 0 },
  "summary": {
    "filteredTotalAmount": 0
  }
}
```

| Field | Required by UI | Source today |
|---|---|---|
| `id` | Yes (row key / update) | `expenses.id` |
| `date` | Yes | `expenses.date` → `toLocaleDateString()` |
| `executiveName` | Yes | `profiles.name` via `se_id` |
| `category` | Yes | `expenses.category` |
| `amount` | Yes | `expenses.amount` → `₹` + `en-IN` 2 dp |
| `status` | Yes | badge |
| Full row + nested shift/profile | Yes when opening sheet without refetch | Kept in React state |

#### Loading / empty / error / permission

| Case | Legacy UI | Evidence |
|---|---|---|
| Auth/perm loading | Full-screen spinner | L340 |
| `!can_view` | Access Denied | L342–351 |
| Data loading | Spinner in table | L466–467 |
| Empty after filters | “No expenses found for this criteria.” + Receipt icon | L481–486 |
| Fetch error | `console.error` only — **no toast** | L107–108 |
| Filtered total | Sum of `amount` for `filteredData` | L517–521 |

#### Backend responsibilities

- Authorize `expenses.can_view`
- Exclude demo executives by default
- Date window semantics must match month/day filters (document timezone)
- Prefer server-side filter + pagination + `filteredTotalAmount`
- Include enough shift fields for sheet without N+1, or support detail refetch

---

### 4.2 `GET /v2/expenses/{id}`

**Purpose:** Expense review sheet payload (today: object already on list row).  
**Confidence:** **Verified** composition — `ExpenseActionSheet` L20–313.

#### Path

| Param | Type |
|---|---|
| `id` | uuid |

#### Recommended response

```json
{
  "id": "uuid",
  "date": "ISO",
  "executiveId": "uuid",
  "executiveName": "string",
  "category": "TA/DA",
  "amount": 1234.56,
  "claimedAmount": 1234.56,
  "status": "Pending",
  "remarks": "executive text…",
  "adminComments": "",
  "receiptUrl": "https://…|SYSTEM_GENERATED|null",
  "receiptIsSystemGenerated": true,
  "shiftId": "uuid|null",
  "shift": {
    "startTimeMs": 0,
    "endTimeMs": 0,
    "workingDurationHours": 8.5,
    "startKm": "string|null",
    "endKm": "string|null",
    "totalDistanceKm": 0,
    "odoDistanceKm": 12.5,
    "distanceUsedKm": 12.5,
    "distanceSource": "ODOMETER|GPS|NONE",
    "startOdoImageUrl": "string|null",
    "endOdoImageUrl": "string|null",
    "isPersonalVehicle": false,
    "vehicleType": "two-wheeler|four-wheeler|null"
  },
  "tadaBreakdown": {
    "applicable": true,
    "ratePerKm": 4,
    "vehicleRateSource": "AMOUNT_INFERENCE|VEHICLE_TYPE|POLICY",
    "baseTa": 50,
    "baseDa": 150,
    "daThresholdKm": 60,
    "daFixedAmount": 150,
    "approveTaDefault": true,
    "approveDaDefault": true,
    "payableTotal": 200
  },
  "isActionable": true,
  "allowedActions": ["approve", "reject", "query"]
}
```

#### Fields used by sheet (exact)

| UI element | Fields |
|---|---|
| Title line | `profiles.name`, `date` |
| Status badge | `status` |
| Amount hero | `amount` or live TA+DA when actionable `TA/DA` |
| Category label | `category` |
| Distance / duration | shift km fields, `start_time`/`end_time` |
| TA/DA editors | computed + checkboxes + `customTA`/`customDA` |
| Remarks | `remarks` with `[Adjusted on approval:…]` stripped |
| Receipt | `receipt_url` if truthy and ≠ `SYSTEM_GENERATED` |
| Admin comment | `admin_comments` |
| Odo photos | `start_odo_image`, `end_odo_image`, labels `start_km`/`end_km` |
| Action bar | `can_edit` AND status ∈ {Pending, Queried} |

#### Loading / empty / validation / error

| Case | Legacy | Notes |
|---|---|---|
| No expense | Sheet returns null | L83 |
| Non-TA/DA or no shift | Breakdown section omitted | L187 |
| Receipt system | Hidden | L293 |
| View-only | Actions hidden if `!canEdit` or not actionable | L316 |
| Update error | Toast “Update Failed” | L139–140 |

---

### 4.3 `POST /v2/expenses/{id}/approve`

**Purpose:** Approve expense; for `TA/DA`, optionally adjust payable amount.  
**Confidence:** **Verified** — `handleStatusChange('Approved')` L102–147.

#### Request body (recommended)

```json
{
  "adminComment": "string|null",
  "expectedStatus": "Pending|Queried",
  "tada": {
    "approveTa": true,
    "approveDa": true,
    "taAmount": 80,
    "daAmount": 150
  }
}
```

| Field | Legacy | Validation |
|---|---|---|
| `adminComment` | `admin_comments` trimmed or null | Optional in legacy; **New V2** may keep optional on approve |
| `tada.*` | Only if `category === 'TA/DA'` | Payable total = (approveTa ? ta : 0) + (approveDa ? da : 0) |
| Zero total | Blocked client-side with toast | **Verified** L112–118 — cannot approve ₹0 |
| Non-TA/DA | `amount` unchanged | **Verified** L105 |

#### Legacy write

```text
expenses.update({
  status: 'Approved',
  amount: finalAmount,
  remarks: finalRemarks.trim() || null,
  admin_comments: adminComment.trim() || null
}).eq('id', expense.id)
```

For TA/DA approve, remarks append:

```text
 [Adjusted on approval: Paid TA=Yes (₹{customTA})|No, DA=Yes (₹{customDA})|No]
```

Prior `[Adjusted on approval:…]` segments are stripped before append (**Verified** L122–123).

#### Response fields UI needs after success

- Updated `status`, `amount` (parent `onUpdate`)
- Toast “Expense Updated”
- Sheet closes

#### AuthZ / concurrency

- Require `expenses.can_edit`
- Legacy: no status precondition in query (UI only gates). **Inferred** V2 should reject if not Pending/Queried (`409` + `expectedStatus`)
- No version/ETag — **New V2** recommended

---

### 4.4 `POST /v2/expenses/{id}/reject`

**Purpose:** Reject expense.  
**Confidence:** **Verified** — button L318; same update path with `newStatus = 'Rejected'`.

#### Request body

```json
{
  "adminComment": "string",
  "reason": "string",
  "expectedStatus": "Pending|Queried"
}
```

| Legacy | V2 product ask |
|---|---|
| Comment optional; amount unchanged; remarks unchanged (unless prior TA/DA approve marker logic only runs on Approve) | **Required** comment/reason (**New V2**) |

Do **not** apply TA/DA amount rewrite on reject (**Verified** — amount adjust only when `newStatus === 'Approved' && category === 'TA/DA'`).

---

### 4.5 `POST /v2/expenses/{id}/query`

**Purpose:** Send expense back with query.  
**Confidence:** **Verified** — button L322; status `Queried`.

Same body/validation pattern as reject. Comment optional in legacy; **required** for **New V2**.

Amount not recalculated. Queried items remain actionable (can Approve/Reject/Query again) — this is the only “resolution” path in admin (**Verified** L86).

---

### 4.6 `GET /v2/expenses/summary` (**New V2**)

**Purpose:** Status counts / totals for dashboard cards (not in legacy Expenses UI).  
**Legacy:** Only a filtered total in the table footer.

```json
{
  "byStatus": {
    "Pending": { "count": 0, "amount": 0 },
    "Approved": { "count": 0, "amount": 0 },
    "Queried": { "count": 0, "amount": 0 },
    "Rejected": { "count": 0, "amount": 0 }
  },
  "grandTotalAmount": 0,
  "filtersApplied": {}
}
```

---

### 4.7 Exports

#### 4.7.1 `GET /v2/expenses/exports/details`

**Confidence:** **Verified** client — `executeExport` L163–216.

| Param | Legacy |
|---|---|
| `month` | required `YYYY-MM` |
| `executiveId` | optional / All |
| `category` | optional / All |

Legacy query: `expenses` + `profiles:se_id(name)`, date month window, order date asc; optional `.eq('se_id')`, `.eq('category')`; filter non-demo.

CSV columns:

| Column | Source |
|---|---|
| Date | `toLocaleDateString(exp.date)` |
| Executive Name | `profiles.name` |
| Category | `category` |
| Amount (INR) | `amount` (raw number in CSV) |
| Status | `status` |
| Remarks | `remarks` with `"` escaped |

Filename: `Expense_Details_{month}_{SE}_{Cat}.csv` with BOM `\uFEFF`.

Empty → toast “No Data”. Error → toast “Export Failed”.

**Sync vs async:** Legacy synchronous. V2 may keep sync for typical month sizes; async job optional for large orgs (**New V2**).

#### 4.7.2 `GET /v2/expenses/exports/payouts`

**Confidence:** **Verified** client — `executePayoutExport` L219–338.

| Param | Legacy |
|---|---|
| `month` | required `YYYY-MM` |

Legacy query: `status = 'Approved'` only; join profile + `shifts(start_km, end_km, total_distance)`.

Grouping: by executive name. For each expense:

| Category | Bucket |
|---|---|
| `TA/DA` | Split into Total TA / Total DA (see §7) |
| `Travelling` / `Food` / `Misc` | Named columns |
| else | `Other` |

CSV headers:

`Executive Name, Total TA, Total DA, Total Travelling, Total Food, Total Misc, Other Allowances, Grand Total Payout (INR)`

Amounts `.toFixed(2)`. Filename: `SE_Consolidated_Payouts_{month}.csv`.

**Strong recommendation:** Server computes TA/DA split from structured approval fields, not remarks string parsing.

---

### 4.8 Attachments download (**Partial** → recommend **New V2** signed URLs)

Legacy: `<a href={url} target="_blank">` for receipt and odo images.

Recommended:

- `GET /v2/expenses/{id}/receipt` → redirect or short-lived signed URL  
- `GET /v2/shifts/{shiftId}/odo-images/{start|end}` similarly  
- AuthZ: `expenses.can_view`  
- Do not expose raw public buckets if avoidable  

---

### 4.9 History / audit (**New V2**)

Not present. Recommend append-only events:

```json
{
  "events": [
    {
      "at": "ISO",
      "actorId": "uuid",
      "actorName": "string",
      "action": "SUBMITTED|APPROVED|REJECTED|QUERIED|AMOUNT_ADJUSTED|RESUBMITTED",
      "fromStatus": "Pending",
      "toStatus": "Approved",
      "amountBefore": 0,
      "amountAfter": 0,
      "comment": "string|null",
      "tadaSnapshot": {}
    }
  ]
}
```

---

### 4.10 Bulk / grouped claims (**New V2**)

Not in legacy. If product requires:

- `POST /v2/expenses/bulk-actions` with `ids[]`, `action`, `comment`  
- Optional claim aggregate: `GET /v2/expense-claims?executiveId&period` grouping by SE+month or SE+date  

---

## 5. Expense models and calculation inputs

### 5.1 `expenses` fields observed in frontend

| Field | Used how | Confidence |
|---|---|---|
| `id` | Key, update filter | **Verified** |
| `se_id` | Filter, join profile | **Verified** |
| `date` | Filter range, display, export | **Verified** |
| `category` | Filter, TA/DA branch, export buckets | **Verified** |
| `amount` | Display, approve overwrite, export | **Verified** |
| `status` | Tabs, badges, actionable gate | **Verified** |
| `remarks` | Display (strip marker), TA/DA approval metadata, export | **Verified** |
| `admin_comments` | Load/save admin textarea | **Verified** |
| `receipt_url` | Image preview; sentinel `SYSTEM_GENERATED` | **Verified** |
| `shift_id` | Join shifts | **Verified** |
| created_at / updated_at / created_by | **Not read** by Expenses UI | **Not found** |

No DB migration defining `expenses` exists in this repo’s checked migration (profiles/entities only). Schema is **Inferred** from queries.

### 5.2 Linked `shifts` fields used by Expenses

| Field | Use |
|---|---|
| `start_time`, `end_time` | Duration hours = `(end - start) / 3600000` (ms) |
| `start_km`, `end_km` | Parse numeric; odo distance if `e > s` |
| `total_distance` | Fallback distance |
| `start_odo_image`, `end_odo_image` | Photos |
| `vehicle_type`, `is_personal_vehicle` | **Not selected** by Expenses queries — rate inferred from amount |

### 5.3 Categories

| Value | UI filter | Payout column |
|---|---|---|
| `TA/DA` | Yes | Total TA + Total DA |
| `Travelling` | Yes | Total Travelling |
| `Food` | Yes | Total Food |
| `Misc` | Yes | Total Misc |
| other strings | Pass list filter only if “All” | Other Allowances |

### 5.4 Who enters what vs who calculates

| Amount / field | Entered by | Calculated by | Evidence |
|---|---|---|---|
| Non-TA/DA `amount` | Executive / mobile (**Inferred**) | — | Admin never creates rows |
| TA/DA submitted `amount` | Mobile/system (**Inferred**); often `SYSTEM_GENERATED` receipt | Likely mobile using same rates (**Inferred**) | Admin recalculates for display |
| Distance used | Shift odo/GPS | Admin client prefers odo | `ExpenseActionSheet` L89–96 |
| TA / DA components in UI | Defaults from formula; admin may edit | Admin client | L47–51, L221–251 |
| Approved stored `amount` | — | Admin on approve (TA/DA) | L109–110 |
| TA/DA split in payout CSV | — | Admin client from distance + remarks | `ExpensesPage` L267–297 |

### 5.5 Frontend calculation breakdown display

**Yes** for `category === 'TA/DA'` and linked `shift`: distance, duration, TA rate label, DA threshold label, editable components, adjusted total, odo photos (**Verified**).

Non-TA/DA: category, amount, remarks, optional receipt only.

### 5.6 Currency, precision, rounding, timezone

| Topic | Legacy | V2 recommendation |
|---|---|---|
| Currency | INR implied (`₹`, CSV “INR”) | Explicit `INR` |
| Display precision | `toLocaleString('en-IN', { minimumFractionDigits: 2 })` | 2 dp money |
| Distance | odo `.toFixed(1)` | 1 dp km |
| TA base | `distance * rate` (no explicit round) | Document banker’s vs half-up |
| Payout export | `.toFixed(2)` | Same |
| Taxes | None | N/A unless New V2 |
| Timezone | UTC ISO bounds from date string; local display | Pin `Asia/Kolkata` for day/month boundaries |

---

## 6. Workflow / status state machine

### 6.1 Status enum (**Verified**)

`Pending` | `Approved` | `Queried` | `Rejected`

Badge styles: amber / green / blue / red (`ExpensesPage` L152–159; sheet L149–156).

### 6.2 Actionability (**Verified**)

```text
isActionable = status ∈ { Pending, Queried }
```

Actions shown only if `can_edit && isActionable`.

### 6.3 Transitions observed in UI

```text
Pending ──approve──► Approved
Pending ──reject───► Rejected
Pending ──query────► Queried

Queried ──approve──► Approved
Queried ──reject───► Rejected
Queried ──query────► Queried   (re-query allowed; same write)

Approved ──(none in UI)──►
Rejected ──(none in UI)──►
```

| Transition | Amount change | Remarks change | Admin comment |
|---|---|---|---|
| → Approved (non-TA/DA) | No | No (unless empty→null trim) | Saved |
| → Approved (TA/DA) | Yes → live TA+DA total; block if 0 | Append adjustment marker | Saved |
| → Rejected | No | No special | Saved |
| → Queried | No | No special | Saved |

### 6.4 Concurrency protection

**Not found.** Update is unconditional `.eq('id')`. Two admins can overwrite each other. **New V2:** `If-Match` / `expectedStatus` / row version.

### 6.5 Resubmission / query resolution

- Admin “resolution” = act again while status is `Queried` (approve/reject/query).  
- Executive resubmit to `Pending` is **not** implemented in admin; assume mobile (**Inferred** / **New V2** to document).  
- No conversation thread; latest `admin_comments` overwrites previous.

---

## 7. TA/DA business rules

### 7.1 Distance selection (**Verified**, duplicated in sheet + payout export)

```text
odoDistance =
  if start_km and end_km parseable and end > start
    then round(end - start, 1 decimal)
    else 0

distanceUsed = odoDistance > 0 ? odoDistance : Number(total_distance || 0)
```

Parsing: strip non-numeric except `.` via `/[^0-9.]/g`.

### 7.2 Daily Allowance (DA)

```text
baseDaAmount = distanceUsed > 60 ? 150 : 0
```

- Threshold: **strictly greater than** 60 km  
- Fixed amount: **₹150**  
- UI shows DA row if `customDA > 0` OR `distanceUsed > 60` OR sheet not actionable  

### 7.3 Travel Allowance (TA) rate

```text
isFourWheeler =
  (Number(expense.amount) - baseDaAmount) === (distanceUsed * 8)

ratePerKm = isFourWheeler ? 8 : 4
baseTaAmount = distanceUsed * ratePerKm
```

| Rate | Meaning in UI |
|---|---|
| ₹4/km | Default / two-wheeler inference |
| ₹8/km | Four-wheeler inference when submitted amount matches |

**Gap:** `shifts.vehicle_type` exists in Shifts module but is **not** used here — fragile if amount was manually edited or rates change.

### 7.4 Approval-time payable total

```text
liveTotal = (approveTA ? customTA : 0) + (approveDA ? customDA : 0)
```

- Admin may freely edit `customTA` / `customDA` numbers (no max/min besides zero-total block on approve).  
- On approved reopen, parse remarks:

```text
Paid TA=Yes (₹X) | Paid TA=No
DA=Yes (₹Y) | DA=No
```

### 7.5 Payout export TA/DA split (**Verified**, slightly different failsafe)

For Approved `TA/DA` rows:

1. Recompute `distanceUsed` as above.  
2. `daValue = distanceUsed > 60 ? 150 : 0`  
3. If remarks includes `DA=No` → `daValue = 0`  
4. If remarks includes `TA=No` → `daValue = amt` (entire amount treated as DA)  
5. `taValue = amt - daValue`; if `taValue < 0` then `taValue = amt`, `daValue = 0`  

**Does not** re-parse custom `Paid TA=Yes (₹X)` amounts into payout columns — uses live distance DA default minus remarks No flags. **Ambiguous** vs sheet’s custom ₹ edits (custom amounts are in `amount` total and remarks text, but payout DA still starts from 150 rule).

### 7.6 Links to shift / attendance / journey / route

| Link | Present? |
|---|---|
| `shift_id` → shift times/distance/odo | **Verified** |
| Attendance day report embedding expenses | **Not** in Expenses; attendance does not fetch expenses |
| Journey / route geometry | **Not** in Expenses UI |
| Activity / mileage entity | **Not found** |

### 7.7 Hardcoded policy constants (should be server config in V2)

| Constant | Value |
|---|---|
| 2W rate | 4 ₹/km |
| 4W rate | 8 ₹/km |
| DA threshold | > 60 km |
| DA amount | 150 ₹ |
| System receipt sentinel | `SYSTEM_GENERATED` |

---

## 8. Attachments, permissions, and audit

### 8.1 Attachments

| Asset | Source field | Behavior |
|---|---|---|
| Expense receipt | `expenses.receipt_url` | Show image if set and not `SYSTEM_GENERATED`; open new tab |
| Start odo photo | `shifts.start_odo_image` | Thumbnail + new tab |
| End odo photo | `shifts.end_odo_image` | Thumbnail + new tab |

- Admin **does not upload** receipts or odo images.  
- No content-type checks, size limits, or secure download flow in admin.  
- **Inferred:** mobile uploads to storage and stores URL.

### 8.2 Permissions

| Capability | Gate |
|---|---|
| View list/detail/exports | `expenses.can_view` (or TH / Super Admin) |
| Approve/Reject/Query + edit TA/DA + write admin comment | `expenses.can_edit` |
| Export buttons | Shown whenever page visible (`can_view`); no separate export perm |

`usePermissions`: TH role or roles.name `Super Admin` → full view+edit bypass.

Mobile module `mobile_travel_activity` is separate (submission side).

### 8.3 Audit

| Need | Legacy |
|---|---|
| Who changed status | **Not written/displayed** |
| Timestamp of action | **Not shown** |
| Previous amounts | Only via remarks marker string |
| Comment history | Single field overwrite |

**New V2:** structured audit + immutable history (§4.9).

---

## 9. Export requirements

| Report | Filter | Status filter | Generation | Format |
|---|---|---|---|---|
| Details CSV | Month + optional SE + category | All statuses | Sync client | CSV UTF-8 BOM |
| SE Payouts CSV | Month | **Approved only** | Sync client | CSV UTF-8 BOM |

### Explicit determinations

| Question | Answer |
|---|---|
| Sync vs async? | Legacy **synchronous**. V2: sync acceptable for month extracts; async **optional** for large data (**New V2**) |
| Export status/download job? | **Not present** |
| Server vs client? | Legacy client Blob; V2 should **prefer server** for payout TA/DA consistency and auth scoping |
| Permissions | View-level today |

---

## 10. Missing / mocked / ambiguous behavior

| Item | Label | Detail |
|---|---|---|
| Grouped claims | **New V2** | One DB row per expense; no claim header |
| Bulk actions | **New V2** | None |
| Required reject/query comment | **Partial** / **New V2** | UI optional |
| Summary status cards | **New V2** | Only filtered ₹ total |
| Team/territory filters | **New V2** | Absent |
| Status history / audit actor | **New V2** | Absent |
| Expense creation in admin | **Not found** | Review-only |
| Mock expense dataset | **Not found** | Live Supabase |
| Hardcoded rates/thresholds | **Verified** constants | Policy not configurable in UI |
| Vehicle type for rate | **Ambiguous** | Inference from amount vs `shifts.vehicle_type` |
| Payout split vs custom TA/DA ₹ | **Ambiguous** | Remarks `Paid TA=Yes (₹X)` not used in payout math |
| Fetch list error UX | **Partial** | Silent console error |
| Month boundary timezone | **Ambiguous** | UTC `T00:00:00.000Z` vs local month |
| Concurrent approvals | **Ambiguous** / gap | Last write wins |
| Queried → executive resubmit | **Inferred** mobile | Not in admin |
| Taxes / mileage entity / settlement | **Not found** | |
| `types.ts` expenses schema | **Not found** | Unusable in repo |
| Line items within one expense | **Not found** | Category is a single string; TA/DA split is UI-only |

---

## 11. V2 coverage checklist

### List & filters

- [ ] `GET /v2/expenses` with month/date, executive, category, status, pagination, sort
- [ ] Exclude demo SEs
- [ ] `filteredTotalAmount` (and optional status summary)
- [ ] AuthZ `expenses.can_view`
- [ ] Team/territory filters (**New V2** if required)

### Detail & calculations

- [ ] `GET /v2/expenses/{id}` with shift + `tadaBreakdown`
- [ ] Server-owned distance preference (odo > GPS)
- [ ] DA rule `> 60 → 150`; TA rates 4/8 from **vehicle_type** (prefer over amount inference)
- [ ] Receipt + odo signed URLs
- [ ] Hide / flag `SYSTEM_GENERATED` receipts

### Workflow

- [ ] Approve / Reject / Query endpoints
- [ ] Actionable only Pending|Queried
- [ ] TA/DA amount adjustment on approve; block ₹0
- [ ] Structured TA/DA approval fields (stop encoding solely in remarks)
- [ ] Required comment on reject/query (**New V2** product)
- [ ] `expectedStatus` / concurrency
- [ ] AuthZ `expenses.can_edit`
- [ ] History/audit events (**New V2**)
- [ ] Bulk / grouped claims (**New V2** if required)
- [ ] Document mobile resubmit after query

### Exports

- [ ] Details CSV parity columns
- [ ] Payout CSV Approved-only with server TA/DA split
- [ ] Sync default; optional async job
- [ ] Currency INR, 2 dp

### Cross-module

- [ ] Attendance day-report optional `expenses[]` (see attendance audit)
- [ ] Shifts edits: policy for linked expenses when distance changes

---

## 12. Open questions

1. **Vehicle source of truth:** Should TA rate use `shifts.vehicle_type` / `is_personal_vehicle`, submitted amount inference, or a policy table?
2. **Who creates TA/DA rows and when?** Confirm mobile auto-create after shift complete, rate version, and whether admin ever inserts.
3. **Should reject/query comments be mandatory?** Product asks yes; legacy allows empty.
4. **Are comments a thread?** Legacy single field — confirm V2 conversation model vs one workflow reason.
5. **After Query, does mobile set status back to Pending on edit, or keep Queried until admin acts?**
6. **Can Approved/Rejected be reopened?** Not in UI — needed for V2?
7. **Payout custom amounts:** Should export use structured approved TA/DA components instead of distance+remarks heuristics?
8. **Timezone for `expenses.date`:** Is the column date-only or timestamptz? Which zone defines “month”?
9. **Currency/tax:** Always INR? Any GST or caps per category?
10. **Grouped claims:** Is V2 “grouped review” = SE+day, SE+month, or explicit claim IDs?
11. **Attachment security:** Are current URLs public? Require signed downloads?
12. **Concurrency:** Optimistic locking required for finance approvals?
13. **Shift distance edits after expense approval:** Freeze approved amount, recalculate, or flag for re-review?
14. **Export scale:** Prefer always-async jobs or keep sync with row limits?
15. **Other category values** beyond the four filters — closed enum or free text?

---

## Appendix A — Legacy Supabase operations inventory

| # | Operation | File | Lines | Purpose |
|---|---|---|---|---|
| 1 | `profiles.select(id,name).eq(role,SE).or(is_demo…)` | `ExpensesPage.tsx` | 64–72 | SE filter list |
| 2 | `expenses.select(*, profiles, shifts…).gte/lt(date).order(date desc)` | `ExpensesPage.tsx` | 98–102 | Main list |
| 3 | `expenses.select(*, profiles…).gte/lt.order(asc)` + optional se/category | `ExpensesPage.tsx` | 171–179 | Details export |
| 4 | `expenses.select(*, profiles, shifts…).eq(status,Approved).gte/lt` | `ExpensesPage.tsx` | 227–232 | Payout export |
| 5 | `expenses.update({status, amount, remarks, admin_comments}).eq(id)` | `ExpenseActionSheet.tsx` | 127–135 | Approve/Reject/Query |

---

## Appendix B — Explicit product determinations (audit answers)

| Question | Determination |
|---|---|
| Amounts entered vs calculated | Non-TA/DA entered upstream; TA/DA submitted as combined amount; admin **recalculates and may overwrite on approve** |
| Calculation breakdown shown? | **Yes** for TA/DA + shift |
| Approval can change amounts? | **Yes** for TA/DA; **No** for other categories |
| Workflow transitions | See §6; concurrency unprotected |
| Attachment requirements | URL preview only; upload not in admin; recommend signed GET |
| Export sync vs async | Legacy **sync**; async optional for V2 |
| Comments thread vs single reason | **Single** `admin_comments` overwrite (+ remarks machine marker) |
| Currency / precision / TZ | INR, ~2 dp money, 1 dp km; UTC filter bounds + local display — pin org TZ in V2 |
