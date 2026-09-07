# WEB Test Scenarios — fpos

**Module ID**: `fpos`  
**Layer**: WEB  
**Primary sources analyzed**:
- `src/pages/FposPage.tsx`
- `src/components/FpoTable.tsx`
- `src/components/FpoDetailSheet.tsx`
- `src/components/DataTable.tsx` (search/filter/sort/pagination)
- `src/hooks/useAuth.ts` / `src/hooks/usePermissions.ts`

**UI Entry**: `/fpos`  
**Permission module key**: `fpos`

**Code notes**:
- No create/delete/approve in this UI.
- `FpoTable` **does** pass `onFilteredDataChange` to `DataTable` (exports track filtered rows). Date range is applied before DataTable.
- `canEdit` is passed into `FpoTable` but not used there; edit gating is only in `FpoDetailSheet`.
- Save validates only FPO name length ≥ 2 (no trim) and mobile 10 digits — State/District/Taluka show `*` in UI but are **not** checked in `handleSave`.

---

# Test Scenario: FPOs — Access Gate

## Operation Overview
- **Module ID**: fpos
- **UI Entry**: `/fpos`
- **Primary files**: `src/pages/FposPage.tsx`
- **Handler / function**: `getModulePerm('fpos')`
- **API / data ops**: via `usePermissions`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. `authLoading || permLoading` → full-screen spinner
2. `!fpoAccess.can_view` → Access Denied + `You do not have permission to view the FPO directory.`
3. `can_edit` passed to detail sheet for Edit Profile

## Test Cases

### Success Scenarios

#### WEB-TC-001: User with fpos.can_view sees FPO Directory
- **Code Path**: permission check → main UI
- **Based On**: `FposPage.tsx`
- **Preconditions**: `fpoAccess.can_view === true`
- **Expected UI behavior**: "FPO Directory"; count subtitle; table/export when loaded

### Business Logic Failure / Branch Scenarios

#### WEB-TC-002: Auth/perm loading shows spinner
- **Condition**: `authLoading || permLoading`
- **Expected UI behavior**: Centered spinner

#### WEB-TC-003: Missing can_view shows Access Denied
- **Condition**: `!fpoAccess.can_view`
- **Expected UI behavior**: Access Denied for FPO directory

---

# Test Scenario: FPOs — List (Submitted + Drafts)

## Operation Overview
- **Module ID**: fpos
- **UI Entry**: Directory after `can_view`
- **Primary files**: `src/pages/FposPage.tsx`, `src/components/FpoTable.tsx`
- **Handler / function**: mount `useEffect`
- **API / data ops**:
  - `profiles.select('name').eq('role','SE')`
  - `fpos.select('*, profiles:se_id(name)').order('created_at', { ascending: false })`
  - `drafts.select('*, profiles:se_id(name)').eq('entity_type','fpo')`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Draft mapping from `draft_data` (`fpoName` → `fpo_name`, location/contact/statutory fields, bank/documents/business/member/storage/commitments/scoring JSON); forced `status:'DRAFT'`, `id=entity_id`, `created_at=updated_at`
2. Combine + sort by `created_at` desc
3. Empty: `No FPOs found.`
4. Status badge: DRAFT → "Draft"; SUBMITTED → default; else secondary / Pending

### Error / Edge Paths Handled in UI
1. FPOs error → toast `Failed to load` / `error.message`
2. Drafts fetch has no error toast

## Test Cases

### Success Scenarios

#### WEB-TC-004: Load merges fpos and drafts
- **Code Path**: page effect → `FpoTable`
- **Based On**: `FposPage.tsx` combine/sort
- **Preconditions**: `can_view`
- **Expected UI behavior**: Combined rows newest first; drafts show Draft badge
- **Expected API call**: SE names + fpos + drafts `entity_type='fpo'`

#### WEB-TC-005: Incomplete draft name default
- **Based On**: `d.fpoName || 'Incomplete FPO'`
- **Expected UI behavior**: Firm shows Incomplete FPO (table may show Unnamed FPO if null)

#### WEB-TC-006: Empty list message
- **Condition**: no rows after filters
- **Expected UI behavior**: `No FPOs found.`

### Business Logic Failure / Branch Scenarios

#### WEB-TC-007: FPOs query error toast
- **Condition**: fpos select `error`
- **Expected UI behavior**: Toast `Failed to load`

---

# Test Scenario: FPOs — Date Filter, Search, Filters, Sort

## Operation Overview
- **Module ID**: fpos
- **UI Entry**: FpoTable controls
- **Primary files**: `src/components/FpoTable.tsx`, `src/components/DataTable.tsx`
- **Handler / function**: `dateFilteredRows` + DataTable
- **API / data ops**: None (client-side)
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Date From: `created_at >= start` (start hours 00:00:00)
2. Date To: `created_at <= end` (end hours 23:59:59.999)
3. Clear Dates resets both
4. Status / State / District(`city`) / Onboarded By filters (options exclude location `'—'`)
5. Search: fpo_name, contact_mobile, city, state, profiles.name
6. Sortable: name, mobile, location, SE, date, status
7. `onFilteredDataChange` wired to parent `filteredData`

## Test Cases

### Success Scenarios

#### WEB-TC-008: Filter by From date excludes earlier rows
- **Condition**: `rowDate < start` after start setHours(0,0,0,0)
- **User steps**: Set From date
- **Expected UI behavior**: Only rows on/after From remain in table input set

#### WEB-TC-009: Filter by To date excludes later rows
- **Condition**: `rowDate > end` after end setHours(23,59,59,999)
- **Expected UI behavior**: Only rows on/before To remain

#### WEB-TC-010: Clear Dates restores full row set
- **User steps**: Click Clear Dates
- **Expected UI behavior**: start/end cleared; all rows again (before other filters)

#### WEB-TC-011: Search by name/mobile/city/state/SE
- **Based On**: `searchAccessor`
- **Expected UI behavior**: Case-insensitive includes

#### WEB-TC-012: Filter by Status / State / District / Onboarded By
- **Based On**: filter predicates
- **Expected UI behavior**: Matching rows only

#### WEB-TC-013: Sort by Date / FPO Name / Status
- **Based On**: column `sortValue`
- **Expected UI behavior**: Asc/desc reorder

---

# Test Scenario: FPOs — Export CSV / PDF

## Operation Overview
- **Module ID**: fpos
- **UI Entry**: Excel (CSV) / PDF when `!loading`
- **Primary files**: `src/pages/FposPage.tsx`
- **Handler / function**: `handleExportExcel`, `handleExportPDF`
- **API / data ops**: None — from `filteredData`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. CSV headers include CEO Name; filename `fpos_export_${date}.csv`
2. PDF omits CEO Name column; popup blocked → silent return

## Test Cases

### Success Scenarios

#### WEB-TC-014: Export CSV downloads fpos_export_<date>.csv
- **Based On**: `handleExportExcel`
- **Expected UI behavior**: CSV from current `filteredData` (reflects date + table filters when callback fires)

#### WEB-TC-015: Export PDF opens print window
- **Based On**: `handleExportPDF`
- **Expected UI behavior**: "FPO Directory Export" then print

### Business Logic Failure / Branch Scenarios

#### WEB-TC-016: PDF popup blocked — no toast
- **Condition**: `!printWindow`
- **Expected UI behavior**: Silent return

---

# Test Scenario: FPOs — View / Edit Visibility

## Operation Overview
- **Module ID**: fpos
- **UI Entry**: Row click → `FpoDetailSheet`
- **Primary files**: `src/components/FpoDetailSheet.tsx`
- **Handler / function**: open sheet; Edit Profile when `canEdit`
- **API / data ops**: None on open (loads from row)
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Tabs: Basic Info, Evaluations (read-only member_base/business_scope/scoring/total_score)
2. Edit Profile only if `!isEditing && canEdit`
3. Cancel exits edit; close resets editing
4. Edit form fields: reg, year, CEO, president, mobile, email, state/city/taluka/pincode, address, agency, command area, GST, PAN

## Test Cases

### Success Scenarios

#### WEB-TC-017: Open row shows detail sheet
- **Expected UI behavior**: Sheet with FPO name, status, city · onboarded by; Basic + Evaluations tabs

#### WEB-TC-018: canEdit false hides Edit Profile
- **Condition**: `!canEdit`
- **Expected UI behavior**: No Edit Profile button

#### WEB-TC-019: canEdit true shows Edit Profile
- **Condition**: `canEdit`
- **Expected UI behavior**: Edit Profile visible

#### WEB-TC-020: Evaluations tab is read-only structural data
- **Based On**: TabsContent `eval`
- **Expected UI behavior**: KeyValueGrid of member_base, business_scope, scoring, Total Score; no save of these fields in `handleSave`

#### WEB-TC-021: Cancel exits edit without API call
- **Expected UI behavior**: `isEditing` false; no update

---

# Test Scenario: FPOs — Save Validation & Draft/Submitted Update

## Operation Overview
- **Module ID**: fpos
- **UI Entry**: Save Changes
- **Primary files**: `src/components/FpoDetailSheet.tsx`
- **Handler / function**: `handleSave`
- **API / data ops**:
  - Draft: `drafts.update({ draft_data, updated_at, update_history }).or('id.eq.<id>,entity_id.eq.<id>')`
  - Submitted: `fpos.update(payload).eq('id', f.id)`
- **Layer**: WEB

## Code Analysis

### Validations Found in Code
1. `!fpoName || fpoName.length < 2` → toast Error / `FPO Name is required.` (no `.trim()`)
2. `!/^\d{10}$/.test(contactMobile)` → toast Error / `Mobile must be 10 digits.`
3. No GST/PAN/email/state/city/taluka validation despite some `*` labels

### Business Logic Found in Code
1. Appends `update_history` entry `Admin Edited Profile`
2. Draft `draft_data` maps camelCase fields + existing bankAccounts/documents from row
3. Submitted payload uses snake_case columns listed in code
4. Success draft: `Draft updated.` + `onSaved` reload + close
5. Success submitted: `FPO updated.` + reload + close
6. Either path error: `Failed to save` / `error.message`

## Test Cases

### Success Scenarios

#### WEB-TC-022: Valid draft save updates drafts table
- **Preconditions**: `status === 'DRAFT'`; name length ≥ 2; mobile 10 digits
- **Expected UI behavior**: Toast `Draft updated.`; close; page reload
- **Expected API call**: drafts update with `.or(id/entity_id)`

#### WEB-TC-023: Valid submitted save updates fpos table
- **Preconditions**: `status !== 'DRAFT'`; validation passes
- **Expected UI behavior**: Toast `FPO updated.`; close; reload
- **Expected API call**: `fpos.update(payload).eq('id', f.id)`

### Validation Failure Scenarios

#### WEB-TC-024: FPO name missing or shorter than 2 chars
- **Validation Rule**: `!fpoName || fpoName.length < 2`
- **Input**: `""` or `"A"`
- **Expected UI behavior**: Toast `Error` / `FPO Name is required.`; no API call

#### WEB-TC-025: Mobile not exactly 10 digits
- **Validation Rule**: `!/^\d{10}$/.test(contactMobile)`
- **Input**: `98765` or non-digits
- **Expected UI behavior**: Toast `Mobile must be 10 digits.`

#### WEB-TC-026: Whitespace-only name of length ≥ 2 can pass name check
- **Condition**: e.g. `"  "` has length 2 and is truthy — **no trim in code**
- **Expected UI behavior**: Name validation does not block; save proceeds to API if mobile valid (documents actual coded behavior)

### Business Logic Failure / Branch Scenarios

#### WEB-TC-027: Save API error toast
- **Condition**: drafts/fpos update returns error
- **Expected UI behavior**: Toast `Failed to save` / `error.message`

---

## Operations Not Present in Code (no TCs)

- Create FPO
- Delete / approve / reject
- Document upload / bank account editing in admin sheet
- GST/PAN/state required validations (UI asterisks only)

---

## Backend/App Mapping Hints

| WEB-TC | Operation key |
|--------|----------------|
| WEB-TC-001 | view_fpos_directory |
| WEB-TC-002 | fpos_perm_loading |
| WEB-TC-003 | deny_fpos_without_can_view |
| WEB-TC-004 | list_fpos_and_drafts |
| WEB-TC-005 | map_fpo_draft_row |
| WEB-TC-006 | list_fpos_empty |
| WEB-TC-007 | list_fpos_error |
| WEB-TC-008 | filter_fpos_by_start_date |
| WEB-TC-009 | filter_fpos_by_end_date |
| WEB-TC-010 | clear_fpos_date_filter |
| WEB-TC-011 | search_fpos |
| WEB-TC-012 | filter_fpos_status_state_city_se |
| WEB-TC-013 | sort_fpos |
| WEB-TC-014 | export_csv |
| WEB-TC-015 | export_pdf |
| WEB-TC-016 | export_pdf_popup_blocked |
| WEB-TC-017 | view_fpo_detail |
| WEB-TC-018 | hide_edit_without_can_edit |
| WEB-TC-019 | show_edit_with_can_edit |
| WEB-TC-020 | view_fpo_evaluations_readonly |
| WEB-TC-021 | cancel_fpo_edit |
| WEB-TC-022 | update_fpo_draft |
| WEB-TC-023 | update_fpo_submitted |
| WEB-TC-024 | validate_fpo_name |
| WEB-TC-025 | validate_fpo_mobile |
| WEB-TC-026 | fpo_name_no_trim_behavior |
| WEB-TC-027 | update_fpo_error |
