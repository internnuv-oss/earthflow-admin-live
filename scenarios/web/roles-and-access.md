# WEB Test Scenarios — roles-and-access

**Module ID**: `roles-and-access`  
**Layer**: WEB  
**Primary sources analyzed**:
- `src/pages/RolesPage.tsx`
- `src/components/PermissionEditor.tsx`
- `src/components/AppLayout.tsx` (shell only — page wraps with `AppLayout`)

**Routing context (Index)**: `/roles` is session-guarded; sidebar module key is `role_management` (`AppSidebar`). **`RolesPage` itself has no `usePermissions` / `can_view` Access Denied gate.**

**Code note**: `PermissionEditor` is **not imported by any page/component** in this repo (orphan UI). Scenarios below cover its coded behavior when mounted with `userId` + `onSave`. It writes `user_permissions`, which is separate from `RolesPage`’s `roles` / `role_permissions` model.

---

# Test Scenario: Roles — List Roles

## Operation Overview
- **Module ID**: roles-and-access
- **UI Entry**: `/roles` → `RolesPage`
- **Primary files**: `src/pages/RolesPage.tsx`
- **Handler / function**: `fetchRoles` (mount `useEffect`)
- **API / data ops**: `supabase.from('roles').select('*, role_permissions(*)').order('created_at', { ascending: true })`
- **Layer**: WEB

## Code Analysis

### Validations Found in Code
None on list.

### Business Logic Found in Code
1. Loading row shows spinner across 4 columns
2. Empty list message: `No roles configured yet.`
3. Each row shows `name`, `platform` badge (Both → purple styling class; else slate), count `(role_permissions || []).length` as `N Modules Granted`
4. Actions: Edit (`handleOpenModal(role)`), Delete (`handleDeleteRole`)

### Error / Edge Paths Handled in UI
1. Fetch error — toast title `Error fetching roles`, description `error.message`, destructive

### Permissions / Visibility
1. Page has no module `can_view` check; any session user who can reach `/roles` sees the UI (subject to AppLayout platform gate elsewhere)

## Test Cases

### Success Scenarios

#### WEB-TC-001: Successful load shows roles table
- **Code Path**: `RolesPage` mount → `fetchRoles` → table
- **Based On**: `RolesPage.tsx` `fetchRoles`
- **User steps**: Navigate to `/roles` while authenticated (and web-allowed via AppLayout)
- **Expected UI behavior**: Title "Role & Access Management"; table of roles ordered by `created_at` asc; Create New Role button
- **Expected API call**: `from('roles').select('*, role_permissions(*)').order('created_at', { ascending: true })`

#### WEB-TC-002: Empty roles list shows empty message
- **Condition**: `roles.length === 0` after successful fetch
- **Expected UI behavior**: Cell text `No roles configured yet.`

### Business Logic Failure / Branch Scenarios

#### WEB-TC-003: Fetch roles error shows toast
- **Condition**: `error` from roles select
- **Expected UI behavior**: Toast `Error fetching roles` / `error.message`; loading ends

---

# Test Scenario: Roles — Open Create / Edit Modal

## Operation Overview
- **Module ID**: roles-and-access
- **UI Entry**: "Create New Role" or row Edit icon
- **Primary files**: `src/pages/RolesPage.tsx`
- **Handler / function**: `handleOpenModal`
- **API / data ops**: None (local state)
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. **Create** (`role` null): `editRoleId=null`, `roleName=''`, `platform='Both'`, `permissions={}`
2. **Edit**: set id/name/platform; map each `role_permissions` into `permissions[module_name] = { can_view, can_edit }`
3. Dialog title: Edit → `Edit Role Permissions`; Create → `Create New Role`
4. Cancel: `setIsModalOpen(false)`

### Permissions / Visibility
None beyond reaching the page.

## Test Cases

### Success Scenarios

#### WEB-TC-004: Create New Role opens empty modal defaults
- **Code Path**: Create button → `handleOpenModal()`
- **Based On**: `RolesPage.tsx` else branch of `handleOpenModal`
- **User steps**: Click "Create New Role"
- **Expected UI behavior**: Modal open; title Create New Role; Role Name empty; Platform Reach `Both`; both Web and Mobile module toggle sections visible (platform Both)

#### WEB-TC-005: Edit loads role name, platform, and permission checkboxes
- **Code Path**: Edit icon → `handleOpenModal(role)`
- **Based On**: edit branch of `handleOpenModal`
- **User steps**: Click Edit on a role with existing `role_permissions`
- **Expected UI behavior**: Title Edit Role Permissions; fields populated; checkboxes match mapped `can_view` / `can_edit` for known modules

#### WEB-TC-006: Cancel closes modal without save
- **User steps**: Open modal → Cancel
- **Expected UI behavior**: Modal closes; no roles insert/update/delete for permissions

---

# Test Scenario: Roles — Platform-Conditional Module Lists

## Operation Overview
- **Module ID**: roles-and-access
- **UI Entry**: Platform Reach select inside modal
- **Primary files**: `src/pages/RolesPage.tsx`
- **Handler / function**: conditional `renderModuleToggles`
- **API / data ops**: None
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. `(platform === 'Web' || platform === 'Both')` → render `WEB_MODULES` titled `Web Dashboard Modules`
2. `(platform === 'Mobile' || platform === 'Both')` → render `MOBILE_MODULES` titled `Mobile App Modules`
3. Platform options: `Mobile` / `Web` / `Both` (labels: Mobile App Only, Web Dashboard Only, Both Mobile & Web)
4. Default platform on create: `Both`

### WEB_MODULES keys (as coded)
`dashboard`, `sales_executives`, `distributors`, `dealers`, `farmers`, `fpos`, `routes`, `attendance`, `expenses`, `locations`, `shifts`, `farm_diary_masters`, `fspp_approvals`, `retail`, `farm_diary_approvals`  
(Note: `role_management` is **not** in this list.)

### MOBILE_MODULES keys (as coded)
`mobile_distributor`, `mobile_dealer`, `mobile_farmer`, `mobile_farmer_onboard`, `mobile_fpo`, `mobile_travel_activity`, `mobile_retail`

## Test Cases

### Success Scenarios

#### WEB-TC-007: Platform Web shows only web modules
- **Condition**: `platform === 'Web'`
- **Expected UI behavior**: Web Dashboard Modules section visible; Mobile App Modules section hidden

#### WEB-TC-008: Platform Mobile shows only mobile modules
- **Condition**: `platform === 'Mobile'`
- **Expected UI behavior**: Mobile App Modules visible; Web Dashboard Modules hidden

#### WEB-TC-009: Platform Both shows web and mobile modules
- **Condition**: `platform === 'Both'`
- **Expected UI behavior**: Both sections rendered

---

# Test Scenario: Roles — Permission Toggle Coupling

## Operation Overview
- **Module ID**: roles-and-access
- **UI Entry**: View / Edit checkboxes per module in modal
- **Primary files**: `src/pages/RolesPage.tsx`
- **Handler / function**: `handleTogglePermission`
- **API / data ops**: None (local state until Save)
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Toggle flips `can_view` or `can_edit` for `moduleKey`
2. If setting **edit true** → force `can_view = true`
3. If setting **view false** → force `can_edit = false`
4. Missing module defaults to `{ can_view: false, can_edit: false }` before toggle

### Validations Found in Code
None beyond coupling rules.

## Test Cases

### Success Scenarios

#### WEB-TC-010: Enabling Edit forces View on
- **Condition**: `field === 'can_edit' && updated.can_edit`
- **User steps**: Check Edit when View was off
- **Expected UI behavior**: Both View and Edit checked for that module

#### WEB-TC-011: Disabling View forces Edit off
- **Condition**: `field === 'can_view' && !updated.can_view`
- **User steps**: Uncheck View while Edit was on
- **Expected UI behavior**: View and Edit both unchecked

#### WEB-TC-012: Enabling View alone does not force Edit
- **User steps**: Check View only
- **Expected UI behavior**: View on, Edit remains previous (false if was false)

---

# Test Scenario: Roles — Create Role (Save)

## Operation Overview
- **Module ID**: roles-and-access
- **UI Entry**: Save Role with `editRoleId === null`
- **Primary files**: `src/pages/RolesPage.tsx`
- **Handler / function**: `handleSaveRole`
- **API / data ops**:
  1. `from('roles').insert([{ name: roleName, platform }]).select('id').single()`
  2. `from('role_permissions').delete().eq('role_id', currentRoleId)`
  3. If any granted: `from('role_permissions').insert(permsToInsert)`
- **Layer**: WEB

## Code Analysis

### Validations Found in Code
1. **Role Name required (trim)** — Save button `disabled={saving || !roleName.trim()}`; handler `if (!roleName.trim()) return;`
2. No other JS validation (length, uniqueness, platform requiredness beyond Select default)

### Business Logic Found in Code
1. After insert, wipe permissions then insert only entries where `can_view || can_edit`
2. Insert payload shape: `{ role_id, module_name, can_view, can_edit }`
3. Success toast: `Success` / `Role created successfully.`; close modal; `fetchRoles()`
4. Save button shows spinner when `saving`

### Error / Edge Paths Handled in UI
1. Any throw — toast `Failed to save` / `error.message`
2. Permission delete errors are **not** checked before insert (await delete without error handling)

## Test Cases

### Success Scenarios

#### WEB-TC-013: Create role with name and platform, no permissions
- **Code Path**: Create modal → Save → insert role → delete perms → no insert if empty
- **Based On**: `handleSaveRole` create branch
- **Preconditions**: `roleName.trim()` non-empty; `editRoleId` null
- **User steps**: Enter name, leave all perms off → Save Role
- **Input**: `{ name: roleName, platform }` insert; `permsToInsert` empty → skip permissions insert
- **Expected UI behavior**: Toast `Role created successfully.`; modal closes; list refreshes
- **Expected API call**: `roles.insert([{ name, platform }])`; `role_permissions.delete().eq('role_id', id)`; no insert if no grants

#### WEB-TC-014: Create role with selected module permissions
- **Preconditions**: At least one module with `can_view` or `can_edit`
- **Expected API call**: After delete, `role_permissions.insert([...])` with only granted modules
- **Expected UI behavior**: Success toast created; refetch shows Modules Granted count

### Validation Failure Scenarios

#### WEB-TC-015: Blank role name blocks save
- **Validation Rule**: `!roleName.trim()` disables button / early return
- **Input**: empty or whitespace-only name
- **Expected UI behavior**: Save Role disabled; if handler somehow invoked, returns without API calls

### Business Logic Failure / Branch Scenarios

#### WEB-TC-016: Create save API error shows Failed to save
- **Condition**: insert/update/perm insert throws
- **Expected UI behavior**: Toast `Failed to save` / `error.message`; `saving` cleared; modal may remain open

---

# Test Scenario: Roles — Update Role (Save)

## Operation Overview
- **Module ID**: roles-and-access
- **UI Entry**: Save Role with existing `editRoleId`
- **Primary files**: `src/pages/RolesPage.tsx`
- **Handler / function**: `handleSaveRole` update branch
- **API / data ops**:
  1. `from('roles').update({ name: roleName, platform }).eq('id', editRoleId)`
  2. `role_permissions.delete().eq('role_id', currentRoleId)`
  3. Optional `role_permissions.insert(permsToInsert)`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Full replace of permissions (delete all for role, re-insert granted set)
2. Success toast: `Role updated successfully.`

## Test Cases

### Success Scenarios

#### WEB-TC-017: Update role name/platform and replace permissions
- **Code Path**: Edit → change fields/toggles → Save
- **Based On**: `handleSaveRole` when `editRoleId` set
- **Preconditions**: Valid trimmed name
- **Expected UI behavior**: Toast `Role updated successfully.`; modal closes; list refresh
- **Expected API call**: `roles.update({ name, platform }).eq('id', editRoleId)`; delete all `role_permissions` for role; insert filtered grants

#### WEB-TC-018: Update clearing all permissions leaves zero grants
- **Condition**: all toggles false → `permsToInsert.length === 0`
- **Expected API call**: delete permissions; skip insert
- **Expected UI behavior**: Success updated; Modules Granted can show `0`

### Business Logic Failure / Branch Scenarios

#### WEB-TC-019: Update save error toast
- **Condition**: update or perm insert error
- **Expected UI behavior**: `Failed to save` / `error.message`

---

# Test Scenario: Roles — Delete Role

## Operation Overview
- **Module ID**: roles-and-access
- **UI Entry**: Trash icon on role row
- **Primary files**: `src/pages/RolesPage.tsx`
- **Handler / function**: `handleDeleteRole`
- **API / data ops**: `supabase.from('roles').delete().eq('id', id)`
- **Layer**: WEB

## Code Analysis

### Validations Found in Code
1. Browser `confirm(\`Are you sure you want to delete the role "${name}"?\`)` — cancel aborts

### Business Logic Found in Code
1. On confirm → delete by id
2. Success → `fetchRoles()` only (no success toast)
3. Error → toast title `Error`, description `error.message`

### Error / Edge Paths Handled in UI
1. User cancels confirm — no delete call
2. Delete error — destructive toast `Error`

## Test Cases

### Success Scenarios

#### WEB-TC-020: Confirm delete removes role and refreshes list
- **Code Path**: Trash → confirm OK → delete → fetchRoles
- **Based On**: `handleDeleteRole`
- **User steps**: Click delete → accept confirm
- **Expected UI behavior**: Confirm shows role name; on OK, role removed after refetch (no success toast coded)
- **Expected API call**: `from('roles').delete().eq('id', id)`

### Business Logic Failure / Branch Scenarios

#### WEB-TC-021: Cancel confirm does not delete
- **Condition**: `confirm(...)` returns false
- **Expected UI behavior**: No delete API call; list unchanged

#### WEB-TC-022: Delete API error shows Error toast
- **Condition**: delete returns `error`
- **Expected UI behavior**: Toast `Error` / `error.message`; no refetch on error path

---

# Test Scenario: PermissionEditor — Load User Permissions

## Operation Overview
- **Module ID**: roles-and-access
- **UI Entry**: Component mount with `userId` (no in-repo parent found)
- **Primary files**: `src/components/PermissionEditor.tsx`
- **Handler / function**: `fetchPermissions`
- **API / data ops**: `supabase.from('user_permissions').select('*').eq('user_id', userId)`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Builds one row per `MODULES` entry; merge existing DB row or default `{ module_name, can_view: false, can_edit: false }`
2. `MODULES` list: `farmers`, `dealers`, `distributors`, `fpos`, `sales_executives`, `routes`, `attendance`, `expenses`, `locations`, `shifts`, `farm_diary_masters`, `fspp_approvals`, `retail`, `farm_diary_approvals`
3. While loading — spinner only
4. Label display: `module_name.replace('_', ' ')` + capitalize class (only first `_` replaced)

### Error / Edge Paths Handled in UI
1. Fetch error not toasted — `data` may be undefined; defaults all false

### Permissions / Visibility
1. No auth/RBAC checks inside component

## Test Cases

### Success Scenarios

#### WEB-TC-023: Load initializes all MODULES with DB or defaults
- **Code Path**: mount → `fetchPermissions` → checkbox list
- **Based On**: `PermissionEditor.tsx`
- **Preconditions**: Component rendered with `userId`
- **Expected UI behavior**: One row per MODULES key; View/Edit reflect DB or false/false
- **Expected API call**: `from('user_permissions').select('*').eq('user_id', userId)`

---

# Test Scenario: PermissionEditor — Save User Permissions

## Operation Overview
- **Module ID**: roles-and-access
- **UI Entry**: "Save Permissions" button
- **Primary files**: `src/components/PermissionEditor.tsx`
- **Handler / function**: `save`
- **API / data ops**: `from('user_permissions').upsert(toUpsert, { onConflict: 'user_id,module_name' })`
- **Layer**: WEB

## Code Analysis

### Validations Found in Code
None (no coupling of view/edit; both independently settable)

### Business Logic Found in Code
1. Upsert payload strips ids: `{ user_id, module_name, can_view, can_edit }` for every MODULES entry
2. Success: toast `Access Updated!`; call `onSave()`
3. Error: toast `Error` / `error.message`
4. `updatePerm` sets field independently — **no** force view-on-edit / edit-off-on-view-off (unlike RolesPage)

## Test Cases

### Success Scenarios

#### WEB-TC-024: Toggle view/edit independently then save upserts all modules
- **Code Path**: checkboxes → Save Permissions → upsert
- **Based On**: `PermissionEditor` `updatePerm` + `save`
- **User steps**: Change View/Edit on modules → Save Permissions
- **Input**: array of `{ user_id, module_name, can_view, can_edit }` for all MODULES
- **Expected UI behavior**: Toast `Access Updated!`; `onSave()` invoked
- **Expected API call**: `user_permissions.upsert(..., { onConflict: 'user_id,module_name' })`

#### WEB-TC-025: PermissionEditor allows Edit without forcing View
- **Condition**: set `can_edit` true while `can_view` false (possible in this component)
- **Expected UI behavior**: Both states persist independently until save; upsert stores as set

### Business Logic Failure / Branch Scenarios

#### WEB-TC-026: Upsert error shows Error toast
- **Condition**: upsert returns `error`
- **Expected UI behavior**: Toast `Error` / `error.message`; `onSave` not called; loading cleared

---

## Incomplete / Related Code Notes

- **No page-level Access Denied** for `role_management` on `RolesPage` — unlike many other directory pages.
- **`PermissionEditor` has no consumer** in this repository; cannot verify host UI/preconditions beyond props `{ userId, onSave }`.
- **Team user assignment** (`AdminUserManagement`) is related to roles but was not in the provided primary sources — not expanded into TCs here.

---

## Backend/App Mapping Hints

| WEB-TC | Operation key |
|--------|----------------|
| WEB-TC-001 | list_roles |
| WEB-TC-002 | list_roles_empty |
| WEB-TC-003 | list_roles_error |
| WEB-TC-004 | open_create_role_modal |
| WEB-TC-005 | open_edit_role_modal |
| WEB-TC-006 | cancel_role_modal |
| WEB-TC-007 | platform_web_modules_only |
| WEB-TC-008 | platform_mobile_modules_only |
| WEB-TC-009 | platform_both_modules |
| WEB-TC-010 | toggle_edit_forces_view |
| WEB-TC-011 | toggle_view_off_clears_edit |
| WEB-TC-012 | toggle_view_only |
| WEB-TC-013 | create_role_no_perms |
| WEB-TC-014 | create_role_with_perms |
| WEB-TC-015 | validate_role_name_required |
| WEB-TC-016 | create_role_error |
| WEB-TC-017 | update_role |
| WEB-TC-018 | update_role_clear_perms |
| WEB-TC-019 | update_role_error |
| WEB-TC-020 | delete_role |
| WEB-TC-021 | delete_role_cancel |
| WEB-TC-022 | delete_role_error |
| WEB-TC-023 | load_user_permissions |
| WEB-TC-024 | upsert_user_permissions |
| WEB-TC-025 | user_perm_independent_toggles |
| WEB-TC-026 | upsert_user_permissions_error |
