# WEB Test Scenarios — expenses

**Module ID**: `expenses`  
**Layer**: WEB  
**Primary sources analyzed**:
- `src/pages/ExpensesPage.tsx`
- `src/components/ExpenseActionSheet.tsx`
- `src/hooks/useAuth.ts` / `src/hooks/usePermissions.ts`

**UI Entry**: `/expenses`  
**Permission module key**: `expenses`

**Code notes**:
- No create/delete expense in this UI — list, filter, review, Approve/Query/Reject, two CSV exports.
- Approve/Query/Reject footer only when `canEdit && (status === 'Pending' || status === 'Queried')`.
- List hides expenses whose `se_id` is not in non-demo SE list (once `seList` loaded). While `seList` empty, filter allows all (`seList.length === 0`).
- Specific date filter overrides month range on fetch; changing month clears `selectedDate`.
- TA/DA approve recalculates `amount` from checked TA+DA customs; blocks approve if total ₹0. Appends `[Adjusted on approval: Paid TA=..., DA=...]` into `remarks`; saves optional `admin_comments`.

---

# Test Scenario: Expenses — Access Gate

## Operation Overview
- **Module ID**: expenses
- **UI Entry**: `/expenses`
- **Primary files**: `src/pages/ExpensesPage.tsx`
- **Handler / function**: `getModulePerm('expenses')`
- **API / data ops**: via `usePermissions`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. `authLoading || permLoading` → full-screen spinner
2. `!expenseAccess.can_view` → Access Denied + `You do not have permission to view expenses.`
3. `ExpenseActionSheet` gets `canEdit={expenseAccess.can_edit}`
4. Exports available whenever page is visible (not gated by `can_edit`)

## Test Cases

### Success Scenarios

#### WEB-TC-001: User with expenses.can_view sees Travel & Expenses
- **Code Path**: permission check → main UI
- **Based On**: `ExpensesPage.tsx`
- **Preconditions**: `expenseAccess.can_view === true`
- **Expected UI behavior**: Title; filters; Export SE Payouts + Details CSV; table

### Business Logic Failure / Branch Scenarios

#### WEB-TC-002: Auth/perm loading shows spinner
- **Condition**: `authLoading || permLoading`
- **Expected UI behavior**: Centered spinner

#### WEB-TC-003: Missing can_view shows Access Denied
- **Condition**: `!expenseAccess.can_view`
- **Expected UI behavior**: Access Denied for expenses

#### WEB-TC-004: can_edit false hides Approve/Query/Reject
- **Condition**: sheet open; `canEdit === false`; expense Pending/Queried
- **Expected UI behavior**: Review sheet still opens; no action footer; TA/DA inputs and admin comment disabled

---

# Test Scenario: Expenses — List & Filters

## Operation Overview
- **Module ID**: expenses
- **UI Entry**: Date/month/SE/category/status filters; table
- **Primary files**: `src/pages/ExpensesPage.tsx`
- **Handler / function**: fetch `useEffect`; `filteredData`
- **API / data ops**:
  - SE list: `profiles` role SE, `is_demo.eq.false OR is_demo.is.null`
  - Expenses: `expenses.select('*, profiles:se_id(name), shifts:shift_id(...)').gte('date', start).lt('date', end).order('date', { ascending: false })`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. If `selectedDate` set → day UTC window; else month `YYYY-MM-01` to first of next calendar month (via `Date(year, month, 1)`)
2. Month change clears specific date
3. Client filters: SE, status tab (`All|Pending|Approved|Queried|Rejected`), category case-insensitive trim match
4. Fetch errors only `console.error` (no toast)
5. `ITEMS_PER_PAGE = 15`; filter changes reset page; Filtered Total sum of amounts
6. Row click / Review → `setSelectedExpense`

## Test Cases

### Success Scenarios

#### WEB-TC-005: Load expenses for default month
- **Code Path**: mount → fetch by `selectedMonth`
- **Expected UI behavior**: Table or empty `No expenses found for this criteria.`; subtitle shows month

#### WEB-TC-006: Filter by specific date overrides month
- **User steps**: Set date input
- **Expected API call**: `.gte/.lt` for that calendar day UTC bounds
- **Expected UI behavior**: Subtitle shows that date’s locale string

#### WEB-TC-007: Change month clears date and refetches
- **User steps**: Change month input
- **Expected UI behavior**: `selectedDate` cleared; month-range fetch

#### WEB-TC-008: Client filter by SE, category, status
- **Expected UI behavior**: Instant filter on loaded rows; page reset to 1; Filtered Total updates

#### WEB-TC-009: Pagination 15 per page
- **Preconditions**: &gt;15 filtered rows
- **Expected UI behavior**: Prev/Next; page indicator

#### WEB-TC-010: Open expense review sheet
- **User steps**: Click row or Review
- **Expected UI behavior**: `ExpenseActionSheet` opens for that expense

### Business Logic Failure / Branch Scenarios

#### WEB-TC-011: Expense for SE not in seList hidden after SE list loads
- **Condition**: `seList.length > 0` and `!seList.some(se => se.id === exp.se_id)`
- **Expected UI behavior**: Row excluded from filtered list

#### WEB-TC-012: Fetch error does not toast
- **Condition**: expenses query `error`
- **Expected UI behavior**: Console error; loading ends; list may stay empty/stale

---

# Test Scenario: Expenses — Details CSV Export

## Operation Overview
- **Module ID**: expenses
- **UI Entry**: Details CSV → dialog → Download
- **Primary files**: `src/pages/ExpensesPage.tsx`
- **Handler / function**: `executeExport`
- **API / data ops**: `expenses` month range + optional `.eq('se_id')` / `.eq('category', exportCategory)` (exact match)
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Headers: Date, Executive Name, Category, Amount (INR), Status, Remarks
2. Filter to SEs in `seList`; empty → toast No Data
3. Filename: `Expense_Details_{month}_{seName}_{catName}.csv`
4. On success: download + close dialog (**no success toast**)
5. Query error → Export Failed toast

## Test Cases

### Success Scenarios

#### WEB-TC-013: Export details CSV for month/SE/category
- **Preconditions**: matching expenses for filters and seList
- **Expected UI behavior**: CSV downloads; dialog closes

### Validation Failure Scenarios

#### WEB-TC-014: Details export with no matching rows
- **Condition**: `cleanData.length === 0`
- **Expected UI behavior**: Toast No Data / `No expenses found for these exact filters.`

### Business Logic Failure / Branch Scenarios

#### WEB-TC-015: Details export query failure
- **Condition**: `error || !data`
- **Expected UI behavior**: Toast Export Failed

---

# Test Scenario: Expenses — Consolidated Payout CSV Export

## Operation Overview
- **Module ID**: expenses
- **UI Entry**: Export SE Payouts → month → Download
- **Primary files**: `src/pages/ExpensesPage.tsx`
- **Handler / function**: `executePayoutExport`
- **API / data ops**: Approved expenses only for month + shift km fields; client group by SE
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Query: `.eq('status', 'Approved')` + month bounds
2. TA/DA split: distance from odo (if e&gt;s) else `total_distance`; DA = 150 if distance &gt; 60 else 0; remarks `DA=No` → da 0; `TA=No` → daValue = full amt; ta = amt - da (failsafe if ta &lt; 0)
3. Other known cats Travelling/Food/Misc bucketed; else Other
4. Headers include Total TA/DA/Travelling/Food/Misc/Other/Grand Total
5. Success toast + close; empty → No Data for month; error → Export Failed

## Test Cases

### Success Scenarios

#### WEB-TC-016: Export approved payouts CSV
- **Preconditions**: ≥1 Approved expense for SEs in seList in month
- **Expected UI behavior**: File `SE_Consolidated_Payouts_{month}.csv`; Success toast; dialog closes

#### WEB-TC-017: TA/DA amounts split using distance and remarks overrides
- **Based On**: payout aggregation for `category === 'TA/DA'`
- **Expected UI behavior**: CSV TA/DA columns reflect odo/total_distance rules and DA=No / TA=No remark handling

### Validation Failure Scenarios

#### WEB-TC-018: Payout export with no approved expenses
- **Condition**: `cleanData.length === 0`
- **Expected UI behavior**: Toast No Data / `No Approved expenses found for {month}.`

### Business Logic Failure / Branch Scenarios

#### WEB-TC-019: Payout export query failure
- **Expected UI behavior**: Toast Export Failed

---

# Test Scenario: Expense Action Sheet — Review & Status Change

## Operation Overview
- **Module ID**: expenses
- **UI Entry**: Expense Review sheet
- **Primary files**: `src/components/ExpenseActionSheet.tsx`
- **Handler / function**: `handleStatusChange`; open `useEffect` for TA/DA defaults
- **API / data ops**: `expenses.update({ status, amount, remarks, admin_comments }).eq('id', expense.id)`
- **Layer**: WEB

## Code Analysis

### Validations Found in Code
1. **Approve TA/DA with ₹0 total blocked** when `newStatus === 'Approved' && category === 'TA/DA' && liveTotalCalculated === 0`
   - Toast: Action Blocked / Cannot approve an allowance value of ₹0...

### Business Logic Found in Code
1. `isActionable` = Pending or Queried only
2. Distance: odo if end&gt;start else `total_distance`; DA base 150 if distance &gt; 60 else 0
3. Four-wheeler heuristic: `(amount - baseDa) === distance * 8` → rate 8 else 4; base TA = distance * rate
4. If already Approved TA/DA, parse remarks `Paid TA=Yes (₹x)` / `DA=Yes (₹x)` or TA=No/DA=No for initials
5. Approve TA/DA: set amount to live total; strip prior `[Adjusted on approval:...]`; append new adjustment string
6. Reject/Query: keep original amount (unless other paths); still save `admin_comments` and remarks as trimmed/null
7. Receipt shown if `receipt_url` and not `SYSTEM_GENERATED`
8. Success: toast Expense Updated; `onUpdate` list patch; close sheet
9. DA row shown if `customDA > 0 || distanceUsed > 60 || !isActionable`

## Test Cases

### Success Scenarios

#### WEB-TC-020: Approve non-TA/DA expense
- **Preconditions**: can_edit; Pending/Queried; category ≠ TA/DA
- **Expected API call**: update status Approved; amount unchanged (original)
- **Expected UI behavior**: Toast Status changed to Approved; list status updates; sheet closes

#### WEB-TC-021: Approve TA/DA with TA and/or DA checked and non-zero total
- **Input**: custom TA/DA; approve checkboxes
- **Expected API call**: `amount = liveTotalCalculated`; remarks include Adjusted on approval string; `admin_comments` optional
- **Expected UI behavior**: Success toast; parent amount/status updated

#### WEB-TC-022: Query expense
- **User steps**: Query button
- **Expected API call**: `status: 'Queried'`
- **Expected UI behavior**: Toast; sheet closes; remains actionable later

#### WEB-TC-023: Reject expense
- **User steps**: Reject button
- **Expected API call**: `status: 'Rejected'`
- **Expected UI behavior**: Toast; sheet closes; no further action footer when reopened

#### WEB-TC-024: View Approved/Rejected sheet without actions
- **Condition**: `!isActionable`
- **Expected UI behavior**: Details + admin comment read-only (if canEdit false or not actionable); no footer buttons

### Validation Failure Scenarios

#### WEB-TC-025: Approve TA/DA when both components yield ₹0
- **Validation Rule**: Approved + TA/DA + `liveTotalCalculated === 0`
- **Expected UI behavior**: Action Blocked toast; no DB update

### Business Logic Failure / Branch Scenarios

#### WEB-TC-026: Update API error
- **Condition**: supabase update error
- **Expected UI behavior**: Toast Update Failed; sheet stays open

#### WEB-TC-027: Null expense returns null component
- **Condition**: `!expense`
- **Expected UI behavior**: Sheet component returns `null`

#### WEB-TC-028: TA/DA rate detection 4 vs 8 km
- **Condition**: amount−baseDa equals distance×8 → four-wheeler rate label ₹8/km else ₹4/km
- **Expected UI behavior**: Travel Allowance label shows detected rate

---

## Backend/App Mapping Hints
- WEB-TC-001 → view_expenses
- WEB-TC-005 → list_expenses
- WEB-TC-008 → filter_expenses
- WEB-TC-010 → open_expense_review
- WEB-TC-013 → export_expense_details_csv
- WEB-TC-016 → export_se_payouts_csv
- WEB-TC-020 → approve_expense
- WEB-TC-021 → approve_ta_da_expense
- WEB-TC-022 → query_expense
- WEB-TC-023 → reject_expense
- WEB-TC-025 → approve_ta_da_zero_blocked
