# WEB Test Scenarios — dashboard

**Module ID**: `dashboard`  
**Layer**: WEB  
**Primary sources analyzed**:
- `src/pages/Dashboard.tsx`
- `src/components/AdminUserManagement.tsx`
- `src/components/KpiCard.tsx` (KPI links)
- `src/hooks/useAuth.ts` / `src/hooks/usePermissions.ts` (permission + Super Admin gate)

**UI Entry**: `/dashboard`

---

# Test Scenario: Dashboard — Access Gate

## Operation Overview
- **Module ID**: dashboard
- **UI Entry**: `/dashboard`
- **Primary files**: `src/pages/Dashboard.tsx`, `src/hooks/usePermissions.ts`
- **Handler / function**: `getModulePerm('dashboard')`
- **API / data ops**: via `usePermissions` (profiles / role_permissions)
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. While `authLoading || permLoading` → full-screen spinner (no AppLayout)
2. If `!dashboardAccess.can_view` → Access Denied inside AppLayout
3. Message: `You do not have permission to view the Dashboard Overview.`

### Permissions / Visibility
1. Requires `dashboard` module `can_view` (or admin bypass in `usePermissions`)

## Test Cases

### Success Scenarios

#### WEB-TC-001: User with dashboard.can_view sees Overview
- **Code Path**: `Dashboard` → `getModulePerm('dashboard')` → main return
- **Based On**: `Dashboard.tsx` after permission checks
- **Preconditions**: `dashboardAccess.can_view === true`
- **User steps**: Open `/dashboard`
- **Expected UI behavior**: "Overview" heading and KPI grid (and Team Management if Super Admin)

### Business Logic Failure / Branch Scenarios

#### WEB-TC-002: Auth/perm loading shows spinner
- **Condition**: `authLoading || permLoading`
- **Expected UI behavior**: Centered spinner; no Overview / Access Denied yet

#### WEB-TC-003: Missing dashboard.can_view shows Access Denied
- **Condition**: `!dashboardAccess.can_view`
- **Expected UI behavior**: Shield icon; "Access Denied"; text about Dashboard Overview; no KPI grid / Team Management

---

# Test Scenario: Dashboard — KPI Counts Load

## Operation Overview
- **Module ID**: dashboard
- **UI Entry**: Overview KPI cards after `can_view`
- **Primary files**: `src/pages/Dashboard.tsx`
- **Handler / function**: mount `useEffect` count fetches
- **API / data ops** (all `select(..., { count: 'exact', head: true })`):
  - `profiles` `.eq('role', 'SE')` → `ses`
  - `sales_executive` `.eq('is_profile_complete', true)` → `sesComplete`
  - `distributors` → submitted distributors
  - `dealers` → submitted dealers
  - `farmers` → submitted farmers
  - `drafts` `.eq('entity_type', 'distributor'|'dealer'|'farmer')` → pending drafts
- **Layer**: WEB

## Code Analysis

### Validations Found in Code
None on counts.

### Business Logic Found in Code
1. `distributors` KPI = submitted + distributor drafts
2. `dealers` KPI = submitted + dealer drafts
3. `farmers` KPI = submitted + farmer drafts
4. `distributorsPending` / `dealersPending` / `farmersPending` = draft counts only
5. `totalPending` = sum of three pending draft counts → "Total Drafts" card
6. Count nulls treated as `0`
7. **No error toast** if any count query fails

### Error / Edge Paths Handled in UI
None explicit for count API failures.

## Test Cases

### Success Scenarios

#### WEB-TC-004: KPI cards populate from combined submitted + draft counts
- **Code Path**: Dashboard mount → Promise.all counts → `setC` → KpiCards
- **Based On**: `Dashboard.tsx` count aggregation
- **Preconditions**: `can_view`
- **User steps**: Open dashboard with view access
- **Expected UI behavior**: Cards show:
  - Sales Executives = SE profile count
  - SE Profiles Complete = complete SE profiles count
  - Distributors / Dealers / Farmers = submitted + matching drafts
  - Total Drafts = sum of distributor/dealer/farmer draft counts
- **Expected API call**: eight parallel head-count queries as listed above

#### WEB-TC-005: Total Drafts equals sum of entity draft pendings
- **Condition**: `totalPending = distributorsPending + dealersPending + farmersPending`
- **Expected UI behavior**: Total Drafts value matches that sum

---

# Test Scenario: Dashboard — KPI Navigation

## Operation Overview
- **Module ID**: dashboard
- **UI Entry**: Clickable KPI cards
- **Primary files**: `src/pages/Dashboard.tsx`, `src/components/KpiCard.tsx`
- **Handler / function**: `KpiCard` Link when `to` set
- **API / data ops**: None
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Cards with `to` wrap in `<Link to={to}>`
2. Wired links:
   - Sales Executives → `/sales-executives`
   - Distributors → `/distributors`
   - Dealers → `/dealers`
   - Farmers → `/farmers`
3. **No `to`**: SE Profiles Complete; Total Drafts (non-clickable Link)

## Test Cases

### Success Scenarios

#### WEB-TC-006: Sales Executives KPI navigates to /sales-executives
- **Based On**: `KpiCard` with `to="/sales-executives"`
- **User steps**: Click Sales Executives card
- **Expected UI behavior**: Router navigates to `/sales-executives`

#### WEB-TC-007: Distributors / Dealers / Farmers KPIs navigate to directories
- **Based On**: `to="/distributors"`, `/dealers`, `/farmers`
- **Expected UI behavior**: Click navigates to respective path

#### WEB-TC-008: SE Profiles Complete and Total Drafts are not links
- **Condition**: no `to` prop
- **Expected UI behavior**: Cards render without `Link` wrapper (not navigable via KpiCard link)

---

# Test Scenario: Dashboard — Super Admin Team Management Visibility

## Operation Overview
- **Module ID**: dashboard
- **UI Entry**: Below KPI grid
- **Primary files**: `src/pages/Dashboard.tsx`, `src/components/AdminUserManagement.tsx`
- **Handler / function**: `{role === 'Super Admin' && <AdminUserManagement />}`
- **API / data ops**: None for gate
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Team Management section only when `useAuth().role === 'Super Admin'` (dynamic role name)
2. Non–Super Admin with dashboard view sees KPIs only

### Permissions / Visibility
1. Separate from `dashboard.can_view`; requires exact role string `Super Admin`

## Test Cases

### Success Scenarios

#### WEB-TC-009: Super Admin sees Team Management
- **Condition**: `role === 'Super Admin'` and `can_view`
- **Expected UI behavior**: "Team Management" block rendered under KPIs

### Business Logic Failure / Branch Scenarios

#### WEB-TC-010: Non–Super Admin does not see Team Management
- **Condition**: `role !== 'Super Admin'`
- **Expected UI behavior**: No AdminUserManagement section

---

# Test Scenario: Team Management — List Web Staff

## Operation Overview
- **Module ID**: dashboard
- **UI Entry**: AdminUserManagement (Super Admin only)
- **Primary files**: `src/components/AdminUserManagement.tsx`
- **Handler / function**: `fetchUsers`
- **API / data ops**: `from('profiles').select('*, roles(name)').in('role', ['TH', 'CO']).order('created_at', { ascending: false })`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Loading spinner in table
2. Empty: `No users found.`
3. Role badge: `roles.name` OR if `user.role === 'TH'` → display `Super Admin` else `Unassigned`
4. Super Admin name gets purple badge classes; others blue
5. Shows name (or `—`), email, mobile (or `—`)

### Error / Edge Paths Handled in UI
1. Fetch error — toast `Error loading users` / `error.message`

## Test Cases

### Success Scenarios

#### WEB-TC-011: List loads TH and CO profiles
- **Code Path**: mount → `fetchUsers` → table
- **Based On**: `AdminUserManagement.tsx` `fetchUsers`
- **Preconditions**: Super Admin viewing dashboard
- **Expected UI behavior**: Table of TH/CO users newest first
- **Expected API call**: profiles select with `roles(name)`, `.in('role', ['TH','CO'])`, order `created_at` desc

#### WEB-TC-012: Empty staff list shows No users found
- **Condition**: `users.length === 0` after load
- **Expected UI behavior**: `No users found.`

#### WEB-TC-013: Role label fallback for TH without roles.name
- **Condition**: `!user.roles?.name && user.role === 'TH'`
- **Expected UI behavior**: Badge text `Super Admin`

#### WEB-TC-014: Role label Unassigned when no roles.name and not TH
- **Condition**: `!user.roles?.name && user.role !== 'TH'`
- **Expected UI behavior**: Badge text `Unassigned`

### Business Logic Failure / Branch Scenarios

#### WEB-TC-015: Load users error toast
- **Condition**: profiles select returns `error`
- **Expected UI behavior**: Toast `Error loading users` / `error.message`

---

# Test Scenario: Team Management — Pagination

## Operation Overview
- **Module ID**: dashboard
- **UI Entry**: Table footer when users exist
- **Primary files**: `src/components/AdminUserManagement.tsx`
- **Handler / function**: client slice with `ITEMS_PER_PAGE = 10`
- **API / data ops**: None (client-side)
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. `totalPages = Math.ceil(users.length / 10) || 1`
2. `paginatedUsers = users.slice((page-1)*10, page*10)`
3. Prev disabled on page 1; Next disabled on last page
4. Showing range text uses current page bounds

## Test Cases

### Success Scenarios

#### WEB-TC-016: More than 10 users paginates at 10 per page
- **Preconditions**: `users.length > 10`
- **User steps**: Use Next / Prev
- **Expected UI behavior**: Page 1 shows first 10; Next advances; footer "Showing X to Y of Z"

#### WEB-TC-017: Prev disabled on first page / Next on last page
- **Condition**: `currentPage === 1` / `currentPage === totalPages`
- **Expected UI behavior**: Corresponding button `disabled`

---

# Test Scenario: Team Management — Load Web Roles for Create Form

## Operation Overview
- **Module ID**: dashboard
- **UI Entry**: Add New User modal role select
- **Primary files**: `src/components/AdminUserManagement.tsx`
- **Handler / function**: mount `fetchWebRoles`
- **API / data ops**: `from('roles').select('*').in('platform', ['Web', 'Both']).order('name')`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Only roles with platform `Web` or `Both` populate select
2. No toast if roles fetch fails/empty

## Test Cases

### Success Scenarios

#### WEB-TC-018: Role dropdown lists Web/Both roles
- **Code Path**: mount → roles query → SelectItem per role
- **Based On**: `fetchWebRoles`
- **User steps**: Open Add New User
- **Expected UI behavior**: Select options are roles with platform Web or Both, ordered by name
- **Expected API call**: `roles.select('*').in('platform', ['Web','Both']).order('name')`

---

# Test Scenario: Team Management — Create User

## Operation Overview
- **Module ID**: dashboard
- **UI Entry**: Add New User → Create Account
- **Primary files**: `src/components/AdminUserManagement.tsx`
- **Handler / function**: `handleCreateUser`
- **API / data ops**:
  1. `supabase.auth.getSession()`
  2. `supabase.functions.invoke('create-se', { body: { name, mobile, email, password, role: 'CO' }, headers: { Authorization: Bearer access_token } })`
  3. `profiles.update({ role_id: selectedRoleId }).eq('mobile', mobile.trim())`
- **Layer**: WEB

## Code Analysis

### Validations Found in Code
1. **Required fields (JS)**: `name.trim()`, `mobile.trim()`, `password.trim()`, `selectedRoleId` — else toast `Please fill all required fields and select a role.`
2. **Mobile length**: `mobile.trim().length !== 10` → `Mobile number must be exactly 10 digits.`
3. **Mobile input filter**: digits only, max 10 via `handleMobileChange`
4. **HTML**: name `required`; mobile `required` `maxLength={10}`; password `required` `minLength={6}`; email `type="email"` (optional, not in JS required check)
5. Submit button `disabled={isSubmitting || !selectedRoleId}`

### Business Logic Found in Code
1. Edge function always sends legacy `role: 'CO'`
2. On invoke `error || data?.error` → toast `Could not create user`; stop (no role_id update)
3. Success path: update `role_id` by mobile (errors not checked/toasted)
4. Success toast `User Created!` / `${name} has been successfully added.`
5. Reset form fields; close modal; `fetchUsers()`

### Error / Edge Paths Handled in UI
1. Validation Error toasts (required / mobile length)
2. Create failure toast `Could not create user`

## Test Cases

### Success Scenarios

#### WEB-TC-019: Create user with valid fields invokes create-se and sets role_id
- **Code Path**: form submit → validate → `create-se` → profiles.update role_id → refresh
- **Based On**: `handleCreateUser`
- **Preconditions**: Super Admin; valid name, 10-digit mobile, password, selectedRoleId
- **User steps**: Add New User → fill required → Create Account
- **Input / body**: `{ name: trim, mobile: trim, email: trim, password, role: 'CO' }` + Bearer token
- **Expected UI behavior**: Toast `User Created!`; modal closes; form cleared; users list refreshes
- **Expected API call**: `functions.invoke('create-se', ...)`; then `profiles.update({ role_id }).eq('mobile', mobile)`

#### WEB-TC-020: Open create modal and Cancel closes without API create
- **User steps**: Add New User → Cancel
- **Expected UI behavior**: Modal closes; no `create-se` invoke from cancel

### Validation Failure Scenarios

#### WEB-TC-021: Missing required field or role shows Validation Error
- **Validation Rule**: `!name.trim() || !mobile.trim() || !password.trim() || !selectedRoleId`
- **Input**: omit one required value (or no role)
- **Expected UI behavior**: Toast `Validation Error` / `Please fill all required fields and select a role.`; no invoke

#### WEB-TC-022: Mobile not exactly 10 digits blocked
- **Validation Rule**: `mobile.trim().length !== 10`
- **Input**: e.g. `98765` (still passes non-empty trim check)
- **Expected UI behavior**: Toast `Mobile number must be exactly 10 digits.`

#### WEB-TC-023: Mobile input strips non-digits and caps at 10
- **Validation Rule**: `handleMobileChange` — `\D` removed; length ≤ 10
- **Input**: paste `98ab76543210999`
- **Expected UI behavior**: State holds digits only up to 10 characters

#### WEB-TC-024: Password minLength 6 enforced by HTML
- **Validation Rule**: `minLength={6}` on password input
- **Input**: password length &lt; 6
- **Expected UI behavior**: Browser blocks submit (HTML constraint)

#### WEB-TC-025: Submit disabled without selectedRoleId
- **Condition**: `!selectedRoleId`
- **Expected UI behavior**: Create Account button disabled

### Business Logic Failure / Branch Scenarios

#### WEB-TC-026: create-se error shows Could not create user
- **Condition**: `error || data?.error` from invoke
- **Expected UI behavior**: Toast `Could not create user` with `error.message` or `data.error`; submitting cleared; no success toast / no forced success refetch path

---

## Backend/App Mapping Hints

| WEB-TC | Operation key |
|--------|----------------|
| WEB-TC-001 | view_dashboard |
| WEB-TC-002 | dashboard_loading |
| WEB-TC-003 | deny_dashboard_without_can_view |
| WEB-TC-004 | load_dashboard_kpis |
| WEB-TC-005 | compute_total_drafts |
| WEB-TC-006 | kpi_nav_sales_executives |
| WEB-TC-007 | kpi_nav_directories |
| WEB-TC-008 | kpi_non_link_cards |
| WEB-TC-009 | show_team_management_super_admin |
| WEB-TC-010 | hide_team_management |
| WEB-TC-011 | list_web_staff |
| WEB-TC-012 | list_web_staff_empty |
| WEB-TC-013 | staff_role_label_th_fallback |
| WEB-TC-014 | staff_role_label_unassigned |
| WEB-TC-015 | list_web_staff_error |
| WEB-TC-016 | paginate_web_staff |
| WEB-TC-017 | paginate_web_staff_bounds |
| WEB-TC-018 | load_web_roles_for_create |
| WEB-TC-019 | create_web_user |
| WEB-TC-020 | cancel_create_web_user |
| WEB-TC-021 | validate_create_user_required |
| WEB-TC-022 | validate_create_user_mobile_length |
| WEB-TC-023 | filter_mobile_digits |
| WEB-TC-024 | validate_password_minlength_html |
| WEB-TC-025 | disable_create_without_role |
| WEB-TC-026 | create_web_user_error |
