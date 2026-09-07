# Business Rules — Expenses

**Source system:** Field Commander Admin (`earthflow-admin-live`)  
**Module:** Expenses  
**Related routes / keys:** `/expenses`, permission `expenses` (label: “Expenses Management”); related mobile catalog key `mobile_travel_activity` (not enforced on this page)  
**Primary sources:** `src/pages/ExpensesPage.tsx`, `src/components/ExpenseActionSheet.tsx`

This document describes **business behavior** for Expenses as implemented in the reference project. It is not a redesign.

Legend:

- **Confirmed** — directly supported by implementation  
- **Implementation Detail** — how the old app encodes the rule  
- **Unconfirmed** — not proven here  
- **`UNCONFIRMED — likely implemented outside this admin repository`** — mobile / remote DB  

---

## 1. Module Purpose

### Confirmed

Admin module titled **“Travel & Expenses”** lets authorized users:

1. List SE expenses for a month or specific date  
2. Filter by SE, category, status  
3. Open **Expense Review** to Approve / Query / Reject (when permitted)  
4. For category **TA/DA**, recalculate and adjust Travel Allowance (TA) and Daily Allowance (DA) using linked shift distance  
5. Export **Details CSV** (raw rows) and **Export SE Payouts** (consolidated Approved totals)

Admin does **not** create or submit new expenses in this UI.

---

## 2. Expense Entity and Important Fields

### Confirmed — fields used by admin

No local migration for `expenses` in the checked migration file; inventory inferred from reads/writes:

| Field | Role |
|---|---|
| `id` | PK |
| `se_id` | Owning Sales Executive (`profiles`) |
| `shift_id` | Optional FK to `shifts` (joined as `shifts`) |
| `date` | Timestamp/ISO used for month/day filters |
| `category` | Expense type string |
| `amount` | Numeric INR; may be overwritten on Approve for TA/DA |
| `status` | `Pending` \| `Approved` \| `Rejected` \| `Queried` |
| `remarks` | SE remarks + appended admin adjustment encoding on Approve |
| `admin_comments` | Separate admin free-text (optional) |
| `receipt_url` | Receipt image URL; special value `SYSTEM_GENERATED` hidden |

Joined for review: `profiles:se_id(name)`, `shifts:shift_id(start_time, end_time, start_km, end_km, total_distance, start_odo_image, end_odo_image)`.

---

## 3. Expense Categories / Types

### Confirmed — filter / export options

Hard-coded category list:

| Category | TA/DA math in admin? |
|---|---|
| `TA/DA` | Yes |
| `Travelling` | No — amount as stored |
| `Food` | No |
| `Misc` | No |

Payout export also buckets unknown categories into **Other**.

**Unconfirmed:** whether mobile allows additional category strings (would still list/filter if exact match; payout → Other).

---

## 4. Creation / Submission / Validation

### Confirmed in this repository

- **No create/submit UI**  
- **No** admin-side required-field validation for new expenses  
- **No** duplicate-expense prevention logic  

**`UNCONFIRMED — likely implemented outside this admin repository`:** who creates expenses, initial `amount`/`status`/`category`/`shift_id`/`receipt_url`, multi-day spanning, eligibility vs shift completion.

---

## 5. Status Values and Lifecycle

### Confirmed statuses (exact strings)

| Status | Badge |
|---|---|
| `Pending` | Amber |
| `Queried` | Blue |
| `Approved` | Green |
| `Rejected` | Red |

### Confirmed actionable states

`isActionable = status === 'Pending' || status === 'Queried'`

Only actionable expenses show Approve / Query / Reject buttons (and only if `expenses.can_edit`).

### Confirmed transitions (admin)

```
Pending ──┬──► Approved
          ├──► Queried
          └──► Rejected

Queried ──┬──► Approved
          ├──► Queried (again)
          └──► Rejected

Approved  → (no admin actions; sheet read-only for actions)
Rejected  → (no admin actions)
```

### Confirmed behavior by status

| Status | Admin actions | Amount on status change |
|---|---|---|
| Pending / Queried | Approve, Query, Reject | Approve (TA/DA only) recalculates `amount`; Query/Reject keep existing `amount` unless only comments/remarks updated |
| Approved | View only | — |
| Rejected | View only | — |

### Confirmed — resubmission

**Not implemented in admin.** After Rejected or Approved, footer actions are hidden.  

If an external system sets status back to `Pending` or `Queried`, the expense becomes actionable again (**Unconfirmed** whether mobile does this).

### Confirmed — Query meaning

Query is a first-class status. Admin can attach optional `admin_comments`. No further workflow automation (notifications, due dates) in this repo.

---

## 6. Sales Executive Ownership

### Confirmed

- Ownership: `se_id`  
- SE list for filters: `role = 'SE'` and (`is_demo = false` **OR** `is_demo` is null)  
- Client filter drops expenses whose `se_id` is not in that list (when list non-empty)  
- Admins with access see all such SEs’ expenses (no TH scoping)  

---

## 7. Shift Relationship

### Confirmed

- Expenses may link to a shift via `shift_id`.  
- TA/DA **Travel Breakdown** UI appears only when `expense.shifts` is present **and** `category === 'TA/DA'`.  
- Distance / duration / odo photos come from the linked shift.  
- If TA/DA has **no** linked shift: no breakdown UI; Approve still uses `liveTotalCalculated` from defaults (distance 0 → TA 0, DA 0 → **approval blocked at ₹0** unless admin manually… but without breakdown, custom TA/DA inputs are **not shown** — so Approve on orphan TA/DA with no shift likely blocked at ₹0).  

### Implementation Detail — orphan TA/DA

Without shift, `distanceUsed = 0`, `baseTaAmount = 0`, `baseDaAmount = 0`, `liveTotalCalculated = 0` if checkboxes still true with 0 values → Approve blocked. Admin cannot edit TA/DA numbers without the breakdown panel.

### Confirmed — Attendance

Expense calculations **do not** read Attendance. Chain is Shifts → Expenses; Attendance is parallel consumer of Shifts.

---

## 8. Date Rules

### Confirmed

- Default list scope: selected **month** (`YYYY-MM`), date ≥ month-01 00:00 UTC and &lt; computed next bound.  
- Optional **specific date** override (full UTC day window). Choosing a month clears the specific date.  
- Display uses `toLocaleDateString()`.  
- No rule that expense `date` must equal shift `date` in admin.  

Multi-day expenses: **Unconfirmed** (single `date` field used).

---

## 9. Distance / Travel Rules (TA/DA)

### Confirmed — distance selection (shared with Shifts/Expenses)

```
Parse start_km / end_km by stripping non-numeric except digits and '.'
If both finite AND end > start:
  odoDistance = round(end - start, 1 decimal)
distanceUsed = odoDistance > 0 ? odoDistance : Number(shift.total_distance || 0)
```

Priority: **valid odometer delta** wins over `total_distance`.

Admin does **not** edit distance on the expense; changing shift odometer/total in Shifts module changes future review defaults after refetch.

Manually supplied distance on the expense row: **not present** — only via shift `total_distance` (often mobile/GPS/override on shift).

---

## 10. TA Calculation Rules

### Confirmed — default TA when opening review

```
baseDaAmount = distanceUsed > 60 ? 150 : 0
isFourWheeler = (Number(expense.amount) - baseDaAmount) === (distanceUsed * 8)
ratePerKm = isFourWheeler ? 8 : 4
baseTaAmount = distanceUsed * ratePerKm
```

### Confirmed — ₹4 vs ₹8

**Not** read from `shifts.vehicle_type`.  

Heuristic: if submitted `amount` minus computed base DA equals `distanceUsed * 8`, treat as **four-wheeler** (₹8/km); else **₹4/km**.

Edge cases:

- Floating mismatch ⇒ falls back to ₹4 even if intended 4W.  
- If amount was already adjusted previously, heuristic may misclassify.  

### Confirmed — admin adjustment

Admin may:

- Toggle **approve TA** checkbox  
- Edit `customTA` number when TA checked and actionable  

On Approve: if TA unchecked, TA contribution to total is 0.

---

## 11. DA Calculation Rules

### Confirmed

| Rule | Value |
|---|---|
| Threshold | `distanceUsed > 60` (**exclusive** of exactly 60) |
| At exactly 60 km | DA = **0** |
| Above 60 km | Default DA = **₹150** |
| Scope | Per **expense** review defaults (not a separate “per day” table); typically one TA/DA expense ↔ one shift day externally |

UI label: “Daily Allowance (&gt; 60km)”.

DA row shown if `customDA > 0` OR `distanceUsed > 60` OR sheet not actionable (so approved history still shows).

Admin may toggle DA / edit `customDA`.

---

## 12. Approval Rules (TA/DA)

### Confirmed on Approve when `category === 'TA/DA'`

1. `finalAmount = (approveTA ? customTA : 0) + (approveDA ? customDA : 0)`  
2. If `finalAmount === 0` → **block** with toast: cannot approve allowance value of ₹0  
3. Else write `amount = finalAmount`  
4. Append to `remarks`:  
   ` [Adjusted on approval: Paid TA=Yes (₹…) / No, DA=Yes (₹…) / No]`  
   (previous matching adjustment segment stripped first)  
5. Save `admin_comments` (optional; empty → null)  
6. Set `status = 'Approved'`

### Confirmed — non-TA/DA Approve

`amount` unchanged; status Approved; remarks not auto-appended with adjustment block; `admin_comments` still saved.

### Confirmed — remarks vs admin_comments

| Field | Purpose |
|---|---|
| `remarks` | SE remarks + machine-appended approval adjustment string |
| `admin_comments` | Admin free-text; optional for approve/query/reject |

Admin comment **not required** for any action (placeholder says optional).

Display of remarks strips the `[Adjusted on approval:…]` segment for the “Executive Remarks” panel.

---

## 13. Query / Rejection Rules

### Confirmed

- Same permission gate (`can_edit` + actionable).  
- Updates `status`, preserves `amount` (no TA/DA recalculation path for Query/Reject).  
- Still writes current `remarks` string (unchanged unless already modified) and `admin_comments`.  
- No mandatory reason field.  

---

## 14. Approved Expense Modification

### Confirmed

Once `Approved` or `Rejected`, action buttons hidden → **cannot** re-approve or change amount via UI.

Opening an Approved TA/DA sheet still **parses** prior adjustment from remarks to populate custom TA/DA for display (`Paid TA=Yes (₹x)`, `DA=Yes (₹y)`, or No flags).

---

## 15. Payout / Export Rules

### Confirmed — Details CSV

- Month + optional SE + category filters  
- All statuses  
- Columns: Date, Executive Name, Category, Amount, Status, Remarks  
- Filename `Expense_Details_{month}_{SE}_{cat}.csv`  
- Demo/non-list SEs filtered out  

### Confirmed — Consolidated Payout CSV (“Export SE Payouts”)

- Month only  
- **`status = 'Approved'` only**  
- Group by SE name  
- Columns: Executive Name, Total TA, Total DA, Total Travelling, Total Food, Total Misc, Other Allowances, Grand Total Payout (INR)  
- Filename `SE_Consolidated_Payouts_{month}.csv`  

### Confirmed — payout split for category `TA/DA`

```
distanceUsed = (odo delta if valid) else total_distance
daValue = distanceUsed > 60 ? 150 : 0
if remarks includes 'DA=No' → daValue = 0
if remarks includes 'TA=No' → daValue = amt   // whole approved amount treated as DA
taValue = amt - daValue
if taValue < 0 → taValue = amt, daValue = 0
```

Then accumulate into Total TA / Total DA.

### Confirmed conflict — approval custom split vs payout re-split

On Approve, admin may set **arbitrary** `customTA` / `customDA` (sum becomes `amount`), encoded as `Paid TA=Yes (₹x), DA=Yes (₹y)`.

Payout export **does not parse** those ₹ amounts. It re-derives DA as 0 or 150 from distance (unless TA=No / DA=No flags). Therefore:

- Custom DA ≠ 150 or custom TA ≠ rate×km can **disagree** between what was approved and how payout CSV attributes TA vs DA  
- Grand Total still uses stored `amount` (sum of approved components), so **total payout** matches approved amount; **TA/DA column split** may not  

### Confirmed — other categories in payout

Exact keys `Travelling`, `Food`, `Misc` accumulate to those columns; anything else → Other. Full `amount` also added to Grand Total.

---

## 16. Permissions

### Confirmed

| Permission | Effect |
|---|---|
| `expenses.can_view` | See list/exports; Access Denied otherwise |
| `expenses.can_edit` | Passed as `canEdit` to sheet; enables Approve/Query/Reject and editable TA/DA/admin comment when actionable |

View-only users can open Review sheet and exports but cannot change status.

Exports are **not** separately gated by `can_edit`.

---

## 17. Search / Filter Behavior

### Confirmed

| Filter | Behavior |
|---|---|
| Specific date | Overrides month for fetch |
| Month | Default fetch window |
| Executive | Client filter |
| Category | Client case-insensitive trim match |
| Status tabs | All / Pending / Approved / Queried / Rejected |
| Pagination | 15 / page |
| Filtered Total | Sum of `amount` on client-filtered set |

---

## 18. Delete / Edit Restrictions

### Confirmed

- No delete in admin  
- No general field edit (category/date/SE)  
- Only status workflow + TA/DA amount rewrite on Approve + remarks/admin_comments  

---

## 19. Edge Cases

### Confirmed

1. ₹0 TA/DA Approve blocked.  
2. Exactly 60 km → no default DA.  
3. `receipt_url === 'SYSTEM_GENERATED'` → no receipt image.  
4. Reject/Query with empty admin comment allowed.  
5. Heuristic ₹8 misclassification when amount ≠ formula.  
6. Payout TA/DA split ≠ custom approved split (conflict).  
7. TA/DA without shift: approve practically blocked.  
8. Demo SE expenses excluded via SE list filter.  
9. Local list `handleExpenseUpdate` does not refresh `remarks`/`admin_comments` in memory (status/amount only) until refetch.  

---

## 20. Calculations Cheat Sheet

| Item | Rule |
|---|---|
| Odo distance | end − start if end &gt; start after numeric strip |
| Distance used | odo if &gt; 0 else `total_distance` |
| Default DA | 150 iff distance **&gt; 60** else 0 |
| Default rate | ₹8/km if `(amount − baseDA) === distance×8` else ₹4/km |
| Default TA | distance × rate |
| Approve total | checked custom TA + checked custom DA |
| Approve block | total === 0 for TA/DA |
| Duration display | (end−start)/3600000 hrs if both times |

Do not invent other rates or thresholds.

---

## 21. Lifecycle Answer Sheet

| Question | Answer from this repo |
|---|---|
| Who creates/submits? | **Outside admin** (unconfirmed mobile) |
| Who queries/rejects/approves? | Admin with `expenses.can_edit` |
| Approval conditions (TA/DA) | Actionable status; final adjusted total ≠ 0; typically needs shift for usable defaults |
| After Query | Status Queried; still actionable |
| After Reject | Status Rejected; not actionable in admin |
| Resubmit? | Not in admin |
| Modify Approved? | Not via actions |
| In payout? | Yes if Approved in selected month |
| Payout data | Per-SE sums of Approved amounts, TA/DA re-split as above |

---

## 22. Cross-Module Effects

| Module | Interaction |
|---|---|
| Shifts | Distance, duration, odo images via `shift_id` |
| Profiles / SE | Ownership; demo filtering |
| Attendance | **No** direct dependency |
| Dashboard | No expense mutations found beyond this module |

Editing a shift’s odometer/total after expense approval does **not** auto-update stored expense `amount`; it can change payout **split** for TA/DA if distance heuristic changes while `amount` stays fixed.

---

## 23. Rules a New Stack Must Preserve

1. Status vocabulary: Pending, Queried, Approved, Rejected.  
2. Actionable = Pending or Queried only.  
3. Categories at least TA/DA, Travelling, Food, Misc.  
4. Distance: prefer valid odo delta else `total_distance`.  
5. DA default: ₹150 only when distance **&gt; 60**.  
6. TA default rates ₹4 / ₹8 with documented heuristic (or replace with explicit vehicle_type if product decides).  
7. Block Approve when TA/DA adjusted total is ₹0.  
8. Persist approval adjustments in remarks; keep `admin_comments` separate.  
9. Payout export = Approved only; consolidate by SE; document TA/DA re-split behavior.  
10. Admin is review/approve oriented — creation remains field-app unless redesigned.  

---

## 24. Important Unresolved / Conflicting Rules

1. **Custom approved TA/DA vs payout re-split** (totals match; column split may not).  
2. **₹4/₹8 from amount heuristic**, not `vehicle_type`.  
3. Creation/validation/duplicates/resubmit **outside** this repo.  
4. TA/DA without `shift_id` barely approvable.  
5. Whether one TA/DA per shift/day is enforced externally.  
6. Month date-bound construction depends on JS `Date(year, monthFromString, 1)` quirk — preserve equivalent inclusive month window carefully.  

---

## 25. Cross-Module Dependencies

**Depends on:** `expenses`, `profiles`, `shifts` (optional join), Permissions.  

**Related docs:** `docs/business-rules/shifts.md`, `sales-executives.md`, `roles-and-access.md`, `attendance.md` (parallel, not dependent).

---

## 26. Evidence / Source Index

| Concern | Source |
|---|---|
| List, filters, exports, payout | `src/pages/ExpensesPage.tsx` |
| Review, TA/DA, status mutations | `src/components/ExpenseActionSheet.tsx` |
| Permissions / nav | `RolesPage.tsx`, `AppSidebar.tsx` |
| Inventory notes | `docs/module-inventory.md` |

---

## 27. Rules That Appear to Live Outside This Repository

1. Creating/submitting expenses (amount, category, shift link, receipt)  
2. Initial status (typically Pending)  
3. SE response after Query / resubmit after Reject  
4. Computing initial TA/DA amount on the device  
5. Writing shift odometer / total_distance / odo images used here  
6. Any payroll disbursement beyond CSV export  

Mark: **`UNCONFIRMED — likely implemented outside this admin repository`**.

---

*End of Expenses business rules extraction.*
