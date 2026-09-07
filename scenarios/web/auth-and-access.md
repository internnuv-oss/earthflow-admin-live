# WEB Test Scenarios — auth-and-access

**Module ID**: `auth-and-access`  
**Layer**: WEB  
**Primary sources analyzed**:
- `src/pages/LoginPage.tsx`
- `src/pages/Index.tsx`
- `src/hooks/useAuth.ts`
- `src/hooks/usePermissions.ts`
- `src/components/AppSidebar.tsx`
- `src/components/AppLayout.tsx` (discovered: wraps authenticated pages; platform/role gate + logout UI)

**Related (session-only mention)**: `src/pages/NotFound.tsx` — ungarded `*` route in `Index` (no auth check).

**Not covered here (separate modules / not in provided auth sources)**: Roles CRUD (`RolesPage`), per-module page Access Denied UIs (e.g. DealersPage), SE creation, PermissionEditor.

---

# Test Scenario: Auth — Sign In

## Operation Overview
- **Module ID**: auth-and-access
- **UI Entry**: `/login` → Sign In mode (default)
- **Primary files**: `src/pages/LoginPage.tsx`
- **Handler / function**: `handleSubmit` when `mode === 'signin'`
- **API / data ops**: `supabase.auth.signInWithPassword({ email, password })`
- **Layer**: WEB

## Code Analysis

### Validations Found in Code
1. **Email** — HTML `type="email"` + `required` (Source: `LoginPage.tsx` Input)
2. **Password** — HTML `required` + `minLength={6}` (Source: `LoginPage.tsx` Input)
3. No additional JS format/length checks beyond browser constraints before API call

### Business Logic Found in Code
1. On success: toast `Welcome back!`; `navigate('/dashboard', { replace: true })`
2. Submit button disabled while `loading`; shows spinner

### Error / Edge Paths Handled in UI
1. Auth API error — toast title `Authentication error`, description `err?.message || 'Try again.'`, variant destructive
2. `finally` always clears `loading`

### Permissions / Visibility
1. Login form only rendered when no session (`Index` redirects session users away from `/login`)

## Test Cases

### Success Scenarios

#### WEB-TC-001: Successful sign-in navigates to dashboard
- **Code Path**: `LoginPage` form → `signInWithPassword` → toast → navigate
- **Based On**: `LoginPage.tsx` signin branch
- **Preconditions**: User on `/login` without session; valid credentials accepted by Supabase Auth
- **User steps**: Enter email + password (≥6 chars) → Sign In
- **Input**: `{ email, password }` as entered
- **Expected UI behavior**: Toast `Welcome back!`; navigate to `/dashboard` with replace; loading spinner during request
- **Expected API call**: `supabase.auth.signInWithPassword({ email, password })`

### Validation Failure Scenarios

#### WEB-TC-002: Empty email blocked by HTML required
- **Validation Rule**: `required` on email input
- **Input**: empty email
- **Expected UI behavior**: Browser blocks submit; no `signInWithPassword` call from successful submit path

#### WEB-TC-003: Empty password blocked by HTML required
- **Validation Rule**: `required` on password input
- **Input**: empty password
- **Expected UI behavior**: Browser blocks submit

#### WEB-TC-004: Password shorter than 6 characters blocked by minLength
- **Validation Rule**: `minLength={6}` on password
- **Input**: password length &lt; 6
- **Expected UI behavior**: Browser blocks submit

#### WEB-TC-005: Non-email value constrained by type=email
- **Validation Rule**: `type="email"`
- **Input**: invalid email string per browser email validation
- **Expected UI behavior**: Browser blocks submit (browser-dependent message)

### Business Logic Failure / Branch Scenarios

#### WEB-TC-006: Sign-in API error shows Authentication error toast
- **Condition**: `signInWithPassword` returns/throws `error`
- **Expected UI behavior**: Toast `Authentication error` with `err.message` or `Try again.`; stay on login; loading cleared

---

# Test Scenario: Auth — Sign Up

## Operation Overview
- **Module ID**: auth-and-access
- **UI Entry**: `/login` → toggle to Sign up
- **Primary files**: `src/pages/LoginPage.tsx`
- **Handler / function**: `handleSubmit` when `mode === 'signup'`
- **API / data ops**: `supabase.auth.signUp({ email, password, options: { emailRedirectTo: origin + '/dashboard' } })`
- **Layer**: WEB

## Code Analysis

### Validations Found in Code
Same HTML constraints as sign-in (email required/type; password required/minLength 6).

### Business Logic Found in Code
1. Success: toast title `Account created`, description `Check your inbox to confirm your email.`; `setMode('signin')` (does not auto-navigate)
2. Mode toggle button flips `signin` ↔ `signup`; CardDescription changes accordingly
3. Submit label: `Create Account` in signup mode

### Error / Edge Paths Handled in UI
1. Same catch toast: `Authentication error` / `err?.message || 'Try again.'`

## Test Cases

### Success Scenarios

#### WEB-TC-007: Toggle to signup mode updates copy and button
- **Code Path**: mode toggle button → `setMode`
- **Based On**: `LoginPage.tsx` mode UI
- **User steps**: Click "Sign up"
- **Expected UI behavior**: Description `Create an admin account`; button `Create Account`; footer `Already registered?` / `Sign in`

#### WEB-TC-008: Successful sign-up shows confirmation toast and returns to signin mode
- **Code Path**: signup → `signUp` → toast → `setMode('signin')`
- **Based On**: `LoginPage.tsx` signup branch
- **User steps**: Sign up with email + password ≥ 6 → Create Account
- **Expected UI behavior**: Toast `Account created` / `Check your inbox to confirm your email.`; mode switches to signin (no navigate coded)
- **Expected API call**: `supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/dashboard` } })`

### Business Logic Failure / Branch Scenarios

#### WEB-TC-009: Sign-up API error shows Authentication error toast
- **Condition**: `signUp` throws/returns error
- **Expected UI behavior**: Toast `Authentication error` with message or `Try again.`; loading cleared

---

# Test Scenario: Auth — Session Bootstrap & Route Guards

## Operation Overview
- **Module ID**: auth-and-access
- **UI Entry**: Any app route via `Index`
- **Primary files**: `src/pages/Index.tsx`, `src/hooks/useAuth.ts`
- **Handler / function**: `useAuth` effect; `guard`; root/login redirects
- **API / data ops**:
  - `supabase.auth.onAuthStateChange`
  - `supabase.auth.getSession`
  - `profiles.select('role, roles(name, platform)').eq('id', userId).single()` when session user present
- **Layer**: WEB

## Code Analysis

### Validations Found in Code
None on routing beyond session truthiness.

### Business Logic Found in Code
1. While `loading` — full-screen spinner; no routes yet
2. `guard(el)` → `session ? el : <Navigate to="/login" replace />`
3. `/` → Navigate to `/dashboard` if session else `/login`
4. `/login` → if session, Navigate to `/dashboard`; else `LoginPage`
5. Protected routes use `guard(...)` (dashboard, dealers, roles, settings templates, etc.); `/locations` uses equivalent inline `session ? ... : Navigate to /login`
6. `logout` = `supabase.auth.signOut()` passed as `onLogout` to pages
7. `*` → `NotFound` **without** session guard
8. **useAuth role**: prefer `roles.name`, else `profiles.role`
9. **useAuth platform**: prefer `roles.platform`, else if `profiles.role === 'SE'` then `'Mobile'` else `'Both'`
10. No session → `role`/`platform` null; `loading` false

### Error / Edge Paths Handled in UI
1. Profile fetch error / no data — `setRole(null); setPlatform(null)` then `setLoading(false)` (no toast)

### Permissions / Visibility
1. Session presence only at router level (module RBAC is separate)

## Test Cases

### Success Scenarios

#### WEB-TC-010: Auth loading shows spinner before routes
- **Code Path**: `Index` → `useAuth.loading`
- **Based On**: `Index.tsx` early return
- **Preconditions**: `loading === true`
- **Expected UI behavior**: Centered `Loader2`; no login/dashboard content yet

#### WEB-TC-011: Authenticated user hitting / is redirected to /dashboard
- **Condition**: `session` truthy on path `/`
- **Expected UI behavior**: Navigate replace to `/dashboard`

#### WEB-TC-012: Unauthenticated user hitting / is redirected to /login
- **Condition**: no `session` on path `/`
- **Expected UI behavior**: Navigate replace to `/login`

#### WEB-TC-013: Authenticated user opening /login is redirected to /dashboard
- **Condition**: `session` on `/login`
- **Expected UI behavior**: Navigate replace to `/dashboard` (LoginPage not shown)

#### WEB-TC-014: Unauthenticated access to guarded route redirects to /login
- **Code Path**: e.g. `/dashboard` → `guard`
- **Condition**: `!session`
- **Expected UI behavior**: Navigate replace to `/login`

#### WEB-TC-015: Authenticated access to guarded route renders page
- **Condition**: `session` truthy
- **Expected UI behavior**: Target page element rendered (further page-level RBAC may apply elsewhere)

#### WEB-TC-016: Session user loads role and platform from profiles/roles
- **Code Path**: `onAuthStateChange` / `getSession` → `fetchRole`
- **Based On**: `useAuth.ts`
- **Expected API call**: `from('profiles').select('role, roles(name, platform)').eq('id', userId).single()`
- **Expected UI behavior**: `role` = `roles.name` or fallback `profiles.role`; `platform` = `roles.platform` or SE→`Mobile` else `Both`

### Business Logic Failure / Branch Scenarios

#### WEB-TC-017: Profile fetch failure clears role/platform
- **Condition**: `!(data && !error)` in `fetchRole`
- **Expected UI behavior**: `role` and `platform` set to `null`; loading false (no error toast coded)

#### WEB-TC-018: Unknown path shows NotFound without session gate
- **Condition**: path matches `*`
- **Expected UI behavior**: 404 page (`Oops! Page not found`) even without auth check in `Index`

---

# Test Scenario: Auth — Logout

## Operation Overview
- **Module ID**: auth-and-access
- **UI Entry**: AppLayout "Log Out" / mobile logout icon; Mobile-only "Sign Out"
- **Primary files**: `src/pages/Index.tsx`, `src/components/AppLayout.tsx`
- **Handler / function**: `logout` / `handleLogout`
- **API / data ops**: `supabase.auth.signOut()`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. `Index.logout` → `await supabase.auth.signOut()`
2. AppLayout desktop/mobile logout: `onLogout()` then `navigate('/')`
3. Mobile-restricted screen Sign Out button calls `onLogout` only (no `navigate` in that branch)

### Error / Edge Paths Handled in UI
None explicit for `signOut` failure.

## Test Cases

### Success Scenarios

#### WEB-TC-019: Log Out from AppLayout signs out and navigates home
- **Code Path**: AppLayout `handleLogout` → Index `logout` → `/`
- **Based On**: `AppLayout.tsx` + `Index.tsx`
- **User steps**: Click "Log Out" (desktop) or logout icon (mobile header)
- **Expected UI behavior**: `signOut` invoked; navigate to `/` (then session-less root redirect to `/login`)
- **Expected API call**: `supabase.auth.signOut()`

#### WEB-TC-020: Mobile-only screen Sign Out calls signOut
- **Code Path**: Mobile App Only UI → `onLogout`
- **Based On**: `AppLayout.tsx` restricted branch
- **Preconditions**: `platform === 'Mobile' || role === 'SE'`
- **User steps**: Click "Sign Out"
- **Expected UI behavior**: `supabase.auth.signOut()` via Index logout; no navigate in this button handler (session clear drives Index redirects)

---

# Test Scenario: Access — Web Platform Gate (AppLayout)

## Operation Overview
- **Module ID**: auth-and-access
- **UI Entry**: Any page wrapped in `AppLayout` after session guard
- **Primary files**: `src/components/AppLayout.tsx`, `src/hooks/useAuth.ts`
- **Handler / function**: platform/role check before shell render
- **API / data ops**: none beyond `useAuth` profile load
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. While `useAuth.loading` — `AppLayout` returns `null`
2. If `platform === 'Mobile' || role === 'SE'` → block web shell:
   - Heading `Mobile App Only`
   - Text: `Your assigned role ({role}) is restricted to the Earthflow Mobile Application. Web access is denied.`
   - Sign Out button
3. Else render sidebar + main + logout headers

### Permissions / Visibility
1. This gate is independent of `usePermissions` / `can_view`

## Test Cases

### Success Scenarios

#### WEB-TC-021: Non-mobile web-allowed user sees admin shell
- **Condition**: not (`platform === 'Mobile' || role === 'SE'`); auth not loading
- **Expected UI behavior**: Sidebar + content + Log Out controls rendered

### Business Logic Failure / Branch Scenarios

#### WEB-TC-022: platform Mobile blocks web UI
- **Condition**: `platform === 'Mobile'`
- **Expected UI behavior**: `Mobile App Only` screen; no sidebar; Sign Out available

#### WEB-TC-023: role SE blocks web UI even if platform would allow
- **Condition**: `role === 'SE'` (OR branch)
- **Expected UI behavior**: Same Mobile App Only denial UI with role interpolated in message

#### WEB-TC-024: AppLayout returns null while auth role/platform loading
- **Condition**: `loading` from `useAuth` true inside AppLayout
- **Expected UI behavior**: Blank (`return null`) until loading completes

---

# Test Scenario: Access — Module Permissions Hook

## Operation Overview
- **Module ID**: auth-and-access
- **UI Entry**: Consumed by `AppSidebar` and feature pages (hook behavior only here)
- **Primary files**: `src/hooks/usePermissions.ts`
- **Handler / function**: `fetchPerms`, `getModulePerm`
- **API / data ops**:
  - `profiles.select('role, role_id, roles(name)').eq('id', userId).single()`
  - If not admin: `role_permissions.select('module_name, can_view, can_edit').eq('role_id', profile.role_id)`
- **Layer**: WEB

## Code Analysis

### Validations Found in Code
None.

### Business Logic Found in Code
1. No `userId` → `loading` false immediately; no fetch
2. **Admin / god mode**: `profile.role === 'TH'` OR `roles.name === 'Super Admin'` → `isAdmin true`; skip permission rows
3. Else if `role_id` present → load `role_permissions` into `perms`
4. `getModulePerm(moduleName)`:
   - if `isAdmin` → `{ can_view: true, can_edit: true }`
   - else find row by `module_name`; return `{ can_view: !!p?.can_view, can_edit: !!p?.can_edit }` (missing row → both false)

### Error / Edge Paths Handled in UI
1. No explicit toast on profile/permissions fetch failure; admin flag stays false; perms may stay empty → deny

### Permissions / Visibility
1. TH legacy role and Super Admin dynamic role name bypass all module checks

## Test Cases

### Success Scenarios

#### WEB-TC-025: TH user gets full can_view/can_edit for any module
- **Code Path**: fetchPerms admin branch → `getModulePerm`
- **Based On**: `usePermissions.ts` TH / `isAdmin`
- **Preconditions**: `profiles.role === 'TH'`
- **Expected API call**: profiles select; **no** `role_permissions` fetch after admin early return
- **Expected UI behavior**: `getModulePerm(any)` → `{ can_view: true, can_edit: true }`

#### WEB-TC-026: Super Admin dynamic role gets full module access
- **Condition**: `(profile.roles as any)?.name === 'Super Admin'`
- **Expected UI behavior**: Same admin bypass as TH

#### WEB-TC-027: Non-admin with role_id loads role_permissions
- **Code Path**: fetchPerms RBAC branch
- **Based On**: `usePermissions.ts` step 3
- **Preconditions**: not TH / not Super Admin; `role_id` set
- **Expected API call**: `from('role_permissions').select('module_name, can_view, can_edit').eq('role_id', profile.role_id)`
- **Expected UI behavior**: `getModulePerm` reflects matching row booleans

#### WEB-TC-028: Non-admin missing module row returns false/false
- **Condition**: `perms.find` returns undefined for moduleName
- **Expected UI behavior**: `{ can_view: false, can_edit: false }`

### Business Logic Failure / Branch Scenarios

#### WEB-TC-029: No userId skips permission fetch
- **Condition**: `!userId` in useEffect
- **Expected UI behavior**: `loading` false; no profiles/role_permissions calls; `getModulePerm` non-admin → false/false

#### WEB-TC-030: Non-admin without role_id never loads permissions list
- **Condition**: profile loaded, not admin, no `role_id`
- **Expected UI behavior**: `perms` remain `[]`; module checks deny

---

# Test Scenario: Access — Sidebar Navigation Visibility

## Operation Overview
- **Module ID**: auth-and-access
- **UI Entry**: `AppSidebar` inside `AppLayout`
- **Primary files**: `src/components/AppSidebar.tsx`, `src/hooks/usePermissions.ts`, `src/hooks/useAuth.ts`
- **Handler / function**: `filteredNavItems` filter; Settings collapsible
- **API / data ops**: via `useAuth` + `usePermissions(session?.user?.id)`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Nav items each map to a `module` key (`dashboard`, `role_management`, `sales_executives`, …)
2. **Dashboard always shown**: `if (item.label === 'Dashboard') return true`
3. Other items: keep if `getModulePerm(item.module).can_view`
4. Header subtitle shows `role || 'Staff'` (uppercase CSS)
5. **Settings** section (Dealer/Farmer/Distributor Onboarding links) only if `role === 'Super Admin'`
6. Active link styling via path match; settings open state follows `/settings*` path

### Permissions / Visibility
1. Sidebar uses `can_view` only (not `can_edit`)
2. Settings gated by role name string `Super Admin`, not by a settings module permission

## Test Cases

### Success Scenarios

#### WEB-TC-031: Dashboard nav always visible
- **Condition**: any authenticated web-allowed user with sidebar
- **Expected UI behavior**: Dashboard link present even if `getModulePerm('dashboard').can_view` would be false

#### WEB-TC-032: Module nav item visible when can_view true
- **Condition**: e.g. `getModulePerm('dealers').can_view === true`
- **Expected UI behavior**: Dealers (and other permitted modules) links appear

#### WEB-TC-033: Module nav item hidden when can_view false
- **Condition**: `getModulePerm(module).can_view === false` and label ≠ Dashboard
- **Expected UI behavior**: That nav link omitted from sidebar

#### WEB-TC-034: Super Admin sees Settings onboarding submenu
- **Condition**: `role === 'Super Admin'`
- **Expected UI behavior**: Settings collapsible with Dealer/Farmer/Distributor Onboarding links

#### WEB-TC-035: Non–Super Admin does not see Settings block
- **Condition**: `role !== 'Super Admin'`
- **Expected UI behavior**: No Settings collapsible / children

#### WEB-TC-036: Sidebar shows role label or Staff fallback
- **Based On**: `{role || 'Staff'}`
- **Expected UI behavior**: Displays current role name, or `Staff` when role null

---

## Backend/App Mapping Hints

| WEB-TC | Operation key |
|--------|----------------|
| WEB-TC-001 | sign_in |
| WEB-TC-002–005 | login_html_validation |
| WEB-TC-006 | sign_in_error |
| WEB-TC-007 | toggle_signup_mode |
| WEB-TC-008 | sign_up |
| WEB-TC-009 | sign_up_error |
| WEB-TC-010 | auth_loading |
| WEB-TC-011 | redirect_root_authenticated |
| WEB-TC-012 | redirect_root_unauthenticated |
| WEB-TC-013 | redirect_login_when_session |
| WEB-TC-014 | guard_redirect_unauthenticated |
| WEB-TC-015 | guard_allow_authenticated |
| WEB-TC-016 | load_profile_role_platform |
| WEB-TC-017 | profile_role_fetch_failed |
| WEB-TC-018 | not_found_ungarded |
| WEB-TC-019 | logout |
| WEB-TC-020 | logout_mobile_only_screen |
| WEB-TC-021 | web_shell_allowed |
| WEB-TC-022 | deny_web_platform_mobile |
| WEB-TC-023 | deny_web_role_se |
| WEB-TC-024 | applayout_auth_loading |
| WEB-TC-025 | admin_bypass_th |
| WEB-TC-026 | admin_bypass_super_admin |
| WEB-TC-027 | load_role_permissions |
| WEB-TC-028 | module_perm_missing_deny |
| WEB-TC-029 | permissions_no_userid |
| WEB-TC-030 | permissions_no_role_id |
| WEB-TC-031 | sidebar_dashboard_always |
| WEB-TC-032 | sidebar_show_can_view |
| WEB-TC-033 | sidebar_hide_without_can_view |
| WEB-TC-034 | sidebar_settings_super_admin |
| WEB-TC-035 | sidebar_hide_settings |
| WEB-TC-036 | sidebar_role_label |
