# WEB Test Scenarios — sales-executives

**Module ID**: `sales-executives`  
**Layer**: WEB  
**Primary sources analyzed**:
- `src/pages/SEsPage.tsx`
- `src/components/SETable.tsx`
- `src/components/SEDetailSheet.tsx`
- `src/components/DataTable.tsx` (search/sort/pagination via SETable)
- `src/hooks/useAuth.ts` / `src/hooks/usePermissions.ts`

**UI Entry**: `/sales-executives`  
**Permission module key**: `sales_executives`

**Code notes**:
- Create dialog collects **Date of Birth** but `handleCreate` does **not** send `dob` in the `create-se` body (unused for API).
- JS create validation requires firstName/mobile/password only — **not** `selectedRoleId` (UI marks role with `*` / Select `required`; role_id update is conditional `if (selectedRoleId)`).
- `SEDetailSheet` is **view-only**; `canEdit` only toggles a footer message — no save/edit handlers in this sheet.
- Table "Edit" vs "View" both call `onSelect` (same sheet).

---

# Test Scenario: Sales Executives — Access Gate

## Operation Overview
- **Module ID**: sales-executives
- **UI Entry**: `/sales-executives`
- **Primary files**: `src/pages/SEsPage.tsx`
- **Handler / function**: `getModulePerm('sales_executives')`
- **API / data ops**: via `usePermissions`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. `authLoading || permLoading` → full-screen spinner
2. `!seAccess.can_view` → Access Denied: `You do not have permission to view Sales Executives.`
3. List `load()` only when `!authLoading && !permLoading && seAccess.can_view`
4. Mobile roles fetch only when `seAccess.can_edit`
5. "Add New SE" dialog only when `seAccess.can_edit`

### Permissions / Visibility
1. `can_view` — page content
2. `can_edit` — create dialog, demo switch enabled, Edit action label

## Test Cases

### Success Scenarios

#### WEB-TC-001: User with sales_executives.can_view sees directory
- **Code Path**: `SEsPage` → permission check → main UI → `load`
- **Based On**: `SEsPage.tsx`
- **Preconditions**: `seAccess.can_view === true`
- **User steps**: Open `/sales-executives`
- **Expected UI behavior**: "Sales Executives" heading; list or loading; no Access Denied

### Business Logic Failure / Branch Scenarios

#### WEB-TC-002: Auth/perm loading shows spinner
- **Condition**: `authLoading || permLoading`
- **Expected UI behavior**: Centered spinner; no directory yet

#### WEB-TC-003: Missing can_view shows Access Denied
- **Condition**: `!seAccess.can_view`
- **Expected UI behavior**: Access Denied UI; `load` not triggered by the can_view effect

#### WEB-TC-004: can_edit false hides Add New SE
- **Condition**: `can_view` true, `can_edit` false
- **Expected UI behavior**: No "Add New SE" button; no mobile roles fetch effect for edit

#### WEB-TC-005: can_edit true shows Add New SE
- **Condition**: `seAccess.can_edit === true`
- **Expected UI behavior**: "Add New SE" button visible; roles with platform Mobile/Both fetched for select

---

# Test Scenario: Sales Executives — List

## Operation Overview
- **Module ID**: sales-executives
- **UI Entry**: Directory after `can_view`
- **Primary files**: `src/pages/SEsPage.tsx`, `src/components/SETable.tsx`
- **Handler / function**: `load`
- **API / data ops**: `from('profiles').select('id, name, mobile, email, role, created_at, is_demo, sales_executive(...)').eq('role', 'SE').order('created_at', { ascending: false })`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Maps `sales_executive` array join to single object (`[0]` if array)
2. Subtitle shows `(rows).length` total
3. Empty table: `No Sales Executives yet.`
4. Profile Status badge: Complete if `sales_executive.is_profile_complete`, else Pending
5. Demo badge on name when `is_demo`

### Error / Edge Paths Handled in UI
1. Load error — toast `Failed to load` / `error.message`
2. Catch logs to console; `loading` cleared in `finally`

## Test Cases

### Success Scenarios

#### WEB-TC-006: Successful load lists SE profiles
- **Code Path**: `load` → `setRows` → `SETable`
- **Based On**: `SEsPage.tsx` `load`
- **Preconditions**: `can_view`
- **User steps**: Open page with view access
- **Expected UI behavior**: Table of SE rows newest first; count in subtitle
- **Expected API call**: profiles select where `role = 'SE'`, order `created_at` desc, with nested `sales_executive` fields

#### WEB-TC-007: Empty list shows empty message
- **Condition**: no SE rows
- **Expected UI behavior**: `No Sales Executives yet.`

#### WEB-TC-008: Profile Complete vs Pending badge
- **Based On**: `SETable` complete column
- **Expected UI behavior**: `is_profile_complete` true → "Complete"; else "Pending"

### Business Logic Failure / Branch Scenarios

#### WEB-TC-009: List load error toast
- **Condition**: profiles select returns `error`
- **Expected UI behavior**: Toast `Failed to load` / `error.message`; loading ends

---

# Test Scenario: Sales Executives — Search & Sort

## Operation Overview
- **Module ID**: sales-executives
- **UI Entry**: SETable / DataTable controls
- **Primary files**: `src/components/SETable.tsx`, `src/components/DataTable.tsx`
- **Handler / function**: DataTable search/sort
- **API / data ops**: None (client-side)
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Search accessor: `name`, `mobile`, `email`
2. Sortable: Name, Profile Status (`is_profile_complete` 1/0), Joined (`created_at` time)
3. Default DataTable page size 10

## Test Cases

### Success Scenarios

#### WEB-TC-010: Search by name, mobile, or email
- **Based On**: `searchAccessor` in `SETable`
- **User steps**: Type in "Search by name, mobile, email..."
- **Expected UI behavior**: Rows filtered by case-insensitive includes on concatenated fields

#### WEB-TC-011: Sort by Name / Profile Status / Joined
- **Based On**: column `sortable` + `sortValue`
- **Expected UI behavior**: Asc/desc reorder per coded sort values

---

# Test Scenario: Sales Executives — Create SE

## Operation Overview
- **Module ID**: sales-executives
- **UI Entry**: Add New SE → Register SE
- **Primary files**: `src/pages/SEsPage.tsx`
- **Handler / function**: `handleCreate`
- **API / data ops**:
  1. `supabase.auth.getSession()`
  2. `functions.invoke('create-se', { body: { name: fullName, mobile, email, password, role: 'SE' }, headers: { Authorization: Bearer token } })`
  3. Optional: `profiles.update({ role_id: selectedRoleId }).eq('mobile', mobile.trim())` if `selectedRoleId`
- **Layer**: WEB

## Code Analysis

### Validations Found in Code
1. **JS required**: `firstName.trim()`, `mobile.trim()`, `password.trim()` — else toast `Please fill all required fields.`
2. **HTML**: firstName `required`; mobile `required` `maxLength={10}`; password `required` `minLength={6}`; email `type="email"` (optional)
3. Last name optional; DOB optional and **not sent** to API
4. No JS check that mobile is exactly 10 digits
5. No JS check that `selectedRoleId` is set (despite label `*`)

### Business Logic Found in Code
1. `fullName = \`${firstName.trim()} ${lastName.trim()}\`.trim()`
2. Legacy role in body always `'SE'`
3. Mobile roles options from `roles` where platform in `Mobile`,`Both`
4. Success toast: `Sales Executive created` / `They can now log into the mobile app.`
5. Clears first/last/dob/mobile/email/password; closes dialog; `load()` (does not clear `selectedRoleId` in coded reset)

### Error / Edge Paths Handled in UI
1. `error || data?.error` → toast `Could not create SE`
2. role_id update errors not toasted

## Test Cases

### Success Scenarios

#### WEB-TC-012: Load mobile roles when can_edit
- **Code Path**: effect when `seAccess.can_edit`
- **Based On**: `fetchMobileRoles`
- **Expected API call**: `roles.select('*').in('platform', ['Mobile','Both']).order('name')`
- **Expected UI behavior**: Role select populated with those roles

#### WEB-TC-013: Successful create invokes create-se and reloads list
- **Code Path**: form submit → validate → invoke → optional role_id → toast → load
- **Based On**: `handleCreate`
- **Preconditions**: `can_edit`; firstName, mobile, password non-empty trim
- **User steps**: Fill required fields → Register SE
- **Input / body**: `{ name: fullName, mobile: trim, email: trim, password, role: 'SE' }`
- **Expected UI behavior**: Toast `Sales Executive created`; dialog closes; list refreshes
- **Expected API call**: `functions.invoke('create-se', ...)`; if role selected, `profiles.update({ role_id }).eq('mobile', mobile)`

#### WEB-TC-014: Create without selectedRoleId still succeeds if required fields pass
- **Condition**: `selectedRoleId` falsy after successful invoke
- **Expected UI behavior**: Success toast still shown; **no** profiles `role_id` update call

### Validation Failure Scenarios

#### WEB-TC-015: Missing firstName/mobile/password shows Validation Error
- **Validation Rule**: `!firstName.trim() || !mobile.trim() || !password.trim()`
- **Input**: omit one of those
- **Expected UI behavior**: Toast `Validation Error` / `Please fill all required fields.`; no invoke

#### WEB-TC-016: Password minLength 6 HTML constraint
- **Validation Rule**: `minLength={6}` on password
- **Input**: password length &lt; 6
- **Expected UI behavior**: Browser blocks submit

#### WEB-TC-017: Mobile maxLength 10 HTML constraint
- **Validation Rule**: `maxLength={10}` on mobile input
- **Expected UI behavior**: Input cannot exceed 10 characters in the field

### Business Logic Failure / Branch Scenarios

#### WEB-TC-018: create-se error shows Could not create SE
- **Condition**: `error || data?.error`
- **Expected UI behavior**: Toast `Could not create SE` with message; dialog may remain; list not success-refreshed on that path

---

# Test Scenario: Sales Executives — Toggle Demo Flag

## Operation Overview
- **Module ID**: sales-executives
- **UI Entry**: Demo SE? Switch in table
- **Primary files**: `src/pages/SEsPage.tsx`, `src/components/SETable.tsx`
- **Handler / function**: `handleToggleDemo`
- **API / data ops**: `from('profiles').update({ is_demo: newStatus }).eq('id', id)`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Optimistic UI flip `is_demo`
2. Switch `disabled={!canEdit}`
3. Click uses `stopPropagation` so row sheet does not open
4. Success toast: `Marked as Demo` or `Marked as Real SE` + `Your reports will update automatically.`
5. Error: toast `Update Failed`; revert optimistic state

## Test Cases

### Success Scenarios

#### WEB-TC-019: can_edit toggles is_demo true
- **Code Path**: Switch → `onToggleDemo` → profiles update
- **Based On**: `handleToggleDemo`
- **Preconditions**: `can_edit`; current `is_demo` false
- **User steps**: Turn Demo switch on
- **Expected UI behavior**: Immediate Demo Account badge; toast `Marked as Demo`
- **Expected API call**: `profiles.update({ is_demo: true }).eq('id', id)`

#### WEB-TC-020: Toggle demo off marks Real SE
- **Preconditions**: `is_demo` true
- **Expected UI behavior**: Toast `Marked as Real SE`; optimistic clear of demo badge

#### WEB-TC-021: Demo switch disabled without can_edit
- **Condition**: `!canEdit`
- **Expected UI behavior**: Switch disabled; no toggle handler from user interaction

### Business Logic Failure / Branch Scenarios

#### WEB-TC-022: Demo update failure reverts and toasts
- **Condition**: update returns `error`
- **Expected UI behavior**: Toast `Update Failed` / `error.message`; row `is_demo` restored to previous value

#### WEB-TC-023: Clicking demo switch does not open detail sheet
- **Condition**: switch container `e.stopPropagation()`
- **Expected UI behavior**: Sheet does not open from switch click

---

# Test Scenario: Sales Executives — View Detail Sheet

## Operation Overview
- **Module ID**: sales-executives
- **UI Entry**: Row click or Edit/View action
- **Primary files**: `src/components/SEDetailSheet.tsx`, `src/components/SETable.tsx`
- **Handler / function**: `onSelect` / sheet open counts fetch
- **API / data ops** (when open):
  - `dealers.select(..., head count).eq('se_id', se.id)`
  - `farmers.select(..., head count).eq('se_id', se.id)`
  - `distributors.select(..., head count).eq('se_id', se.id)`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Header: name; Profile Complete / Incomplete badge from `sales_executive.is_profile_complete`
2. Shows mobile/email
3. KPI counts for dealers/farmers/distributors owned by SE
4. Tabs: Personal, Organization, Financial & Assets, Documents — render nested JSON via KeyValueGrid
5. Financial tab excludes `insurances` from main grid; shows Insurances section if present
6. `!canEdit` footer: `Viewing Mode: You don't have authorization to edit this agent.`
7. **No edit form / save** regardless of `canEdit`
8. Action column: `canEdit` → "Edit" button; else "View" — both open same sheet

### Error / Edge Paths Handled in UI
1. Count fetch failures not toasted (counts stay 0 / previous)

## Test Cases

### Success Scenarios

#### WEB-TC-024: Row click opens detail sheet
- **Code Path**: `DataTable` `onRowClick` → `setSelected` → `SEDetailSheet`
- **User steps**: Click SE row
- **Expected UI behavior**: Sheet opens with SE name, contact, tabs

#### WEB-TC-025: Opening sheet loads onboarded entity counts
- **Based On**: `SEDetailSheet` useEffect
- **Preconditions**: sheet open with `se.id`
- **Expected UI behavior**: Dealers/Farmers/Distributors KPI numbers update from counts
- **Expected API call**: three head-count queries filtered by `se_id`

#### WEB-TC-026: Tabs show personal/org/financial/documents data
- **Based On**: TabsContent sections
- **Expected UI behavior**: KeyValueGrid renders corresponding `sales_executive` detail objects; insurances section if present

#### WEB-TC-027: can_edit false shows Viewing Mode footer
- **Condition**: `!canEdit`
- **Expected UI behavior**: Footer italic message about no authorization to edit

#### WEB-TC-028: can_edit true hides Viewing Mode footer
- **Condition**: `canEdit` true
- **Expected UI behavior**: No viewing-mode footer (still no edit controls coded)

#### WEB-TC-029: Action button label Edit vs View by canEdit
- **Based On**: `SETable` actions column
- **Expected UI behavior**: Edit icon/label when `canEdit`; View when not; both open sheet via `onSelect`

#### WEB-TC-030: Close sheet clears selection
- **User steps**: Close sheet
- **Expected UI behavior**: `onClose` → `selected` null; sheet closed

---

## Backend/App Mapping Hints

| WEB-TC | Operation key |
|--------|----------------|
| WEB-TC-001 | view_sales_executives |
| WEB-TC-002 | se_page_loading |
| WEB-TC-003 | deny_se_without_can_view |
| WEB-TC-004 | hide_add_se_without_can_edit |
| WEB-TC-005 | show_add_se_with_can_edit |
| WEB-TC-006 | list_sales_executives |
| WEB-TC-007 | list_se_empty |
| WEB-TC-008 | se_profile_status_badge |
| WEB-TC-009 | list_se_error |
| WEB-TC-010 | search_sales_executives |
| WEB-TC-011 | sort_sales_executives |
| WEB-TC-012 | load_mobile_roles_for_se |
| WEB-TC-013 | create_sales_executive |
| WEB-TC-014 | create_se_without_role_id |
| WEB-TC-015 | validate_create_se_required |
| WEB-TC-016 | validate_se_password_minlength |
| WEB-TC-017 | se_mobile_maxlength |
| WEB-TC-018 | create_se_error |
| WEB-TC-019 | mark_se_demo |
| WEB-TC-020 | mark_se_real |
| WEB-TC-021 | disable_demo_toggle_without_edit |
| WEB-TC-022 | toggle_demo_error_revert |
| WEB-TC-023 | demo_toggle_stop_propagation |
| WEB-TC-024 | view_se_detail |
| WEB-TC-025 | load_se_network_counts |
| WEB-TC-026 | view_se_detail_tabs |
| WEB-TC-027 | se_detail_view_only_footer |
| WEB-TC-028 | se_detail_hide_view_footer |
| WEB-TC-029 | se_action_edit_vs_view_label |
| WEB-TC-030 | close_se_detail |
