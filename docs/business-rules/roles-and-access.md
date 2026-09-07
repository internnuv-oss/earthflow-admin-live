# Business Rules — Roles & Access

**Source system:** Field Commander Admin (`earthflow-admin-live`)  
**Module:** Roles & Access  
**Related routes / keys:** `/roles`, sidebar module key `role_management`  
**Primary sources:** `src/pages/RolesPage.tsx`, `src/hooks/usePermissions.ts`, `src/hooks/useAuth.ts`, `src/components/AppSidebar.tsx`, `src/components/AppLayout.tsx`, `src/components/AdminUserManagement.tsx`, `src/pages/SEsPage.tsx`, `src/components/PermissionEditor.tsx`, `supabase/functions/create-se/index.ts`, and all pages that call `getModulePerm`

This document describes **business behavior** of authorization and role management as implemented in the reference project. It is not a redesign.

Legend used throughout:

- **Confirmed** — directly supported by implementation  
- **Implementation Detail** — how the old app encodes the rule  
- **Unconfirmed** — referenced, partial, or not provable from this repository alone  

---

## 1. Module Purpose

### Confirmed

Roles & Access defines **named roles**, each scoped to a **platform reach** (`Web`, `Mobile`, or `Both`), and grants **per-module** capabilities of **View** (`can_view`) and **Edit** (`can_edit`).

Those grants control:

1. Which web sidebar modules a signed-in user can see  
2. Whether feature pages show content or an “Access Denied” state  
3. Whether mutating actions (create/update/approve/delete UI) are available on those pages  
4. Which mobile capability keys can be stored on a role (for the companion mobile app — enforcement of mobile keys is **not implemented in this repository**)

The module also supports **assigning a role** to users at user-creation time (web staff via Team Management; SEs via Sales Executives).

Evidence: `RolesPage` copy — “Define global roles and their granular module permissions for Web and Mobile.”

---

## 2. Actors / Roles Involved

The system uses **two parallel identity concepts**:

### 2.1 Legacy profile role (`profiles.role`)

### Confirmed

| Value | Meaning in this app |
|---|---|
| `SE` | Sales Executive — field / mobile user |
| `TH` | Territory Head — treated as full-access admin for module permissions |
| `CO` | Used when creating web team users via Team Management / `create-se` |

Evidence: `usePermissions` (TH bypass), `AdminUserManagement` (creates with `role: 'CO'`, lists `TH`/`CO`), `SEsPage` / `create-se` (creates with `role: 'SE'`).

### Unconfirmed

- Exact business meaning of `CO` beyond “web staff legacy role”  
- Whether production DB still enforces the early migration check `role IN ('SE','TH')` (code uses `CO`; local migration only lists `SE`/`TH`)

### 2.2 Dynamic role (`roles` table + `profiles.role_id`)

### Confirmed

- A user may be linked to a row in `roles` via `profiles.role_id`.  
- Displayed role name prefers **`roles.name`**, falling back to legacy `profiles.role`.  
- Platform prefers **`roles.platform`**, with fallback: if legacy role is `SE` → `Mobile`, otherwise → `Both`.

Evidence: `useAuth.ts`.

### Confirmed special dynamic name: `Super Admin`

- If linked role name is **`Super Admin`**, the user receives **full module permission bypass** (same as TH for `usePermissions`).  
- If resolved display role is **`Super Admin`**, the user also gets:
  - Settings nav (Dealer / Farmer / Distributor Onboarding)
  - Team Management block on Dashboard  

Evidence: `usePermissions.ts`, `AppSidebar.tsx`, `Dashboard.tsx`.

### Implementation Detail

Team Management UI **labels** a user with legacy `role === 'TH'` and no `roles.name` as **“Super Admin”** in the table badge. That is a **display alias**, not the same as having `roles.name === 'Super Admin'` for Settings / Team Management gating (those compare the string from `useAuth`, which would be `'TH'` if no dynamic role is linked).

### Confirmed actors for this module’s workflows

| Actor | Can manage roles UI? | Notes |
|---|---|---|
| Authenticated web user who can open `/roles` | Yes (page has no `can_view` guard) | See §10 conflicts |
| User with `role_management` view (admins via bypass) | Sees sidebar link | `role_management` is not in the RolesPage grant matrix |
| `Super Admin` (dynamic name) | Settings + Team Management | |
| `TH` (legacy) | Permission bypass | Settings/Team Mgmt only if display role resolves to `Super Admin` |
| `SE` / platform `Mobile` | Blocked from web app shell | `AppLayout` |

---

## 3. Entities and Relationships

### Confirmed entities (from code usage)

```
auth.users (Supabase Auth)
    └── profiles
          ├── role          (legacy: SE | TH | CO | …)
          ├── role_id  ──►  roles
          │                   ├── id
          │                   ├── name
          │                   ├── platform   (Web | Mobile | Both)
          │                   └── created_at
          │                         └── role_permissions
          │                               ├── role_id
          │                               ├── module_name
          │                               ├── can_view
          │                               └── can_edit
          └── (optional legacy) user_permissions
                ├── user_id
                ├── module_name
                ├── can_view
                └── can_edit
                unique conflict key: (user_id, module_name)  [from upsert options]
```

### Confirmed relationships

1. **Role → many permission rows** (`role_permissions.role_id`).  
2. **Profile → at most one dynamic role** via `role_id` (assignment pattern in create flows).  
3. **Permission rows are module-keyed strings** (not foreign keys to a modules table in this repo).

### Unconfirmed

- Full DDL / FK / ON DELETE behavior for `roles`, `role_permissions`, `user_permissions`, `profiles.role_id`  
- Whether deleting a role cascades, restricts, or nullifies assigned profiles  
- RLS policies for these tables (not in checked-in migrations)

### Implementation Detail

Local migration only defines early `profiles` with `role IN ('SE','TH')` and permissive authenticated RLS on some tables. Roles/RBAC tables are used by the SPA but **not defined in local migrations**.

---

## 4. Catalog of Grantable Modules

### 4.1 Web Dashboard Modules (`WEB_MODULES`)

### Confirmed keys and labels (RolesPage)

| module_name key | Label |
|---|---|
| `dashboard` | Dashboard Overview |
| `sales_executives` | Sales Executives Directory |
| `distributors` | Distributors Directory |
| `dealers` | Dealers Directory |
| `farmers` | Farmers Directory |
| `fpos` | FPOs Directory |
| `routes` | Territory Routes |
| `attendance` | Attendance & Timelines |
| `expenses` | Expenses Management |
| `locations` | Location Master |
| `shifts` | Shift Management |
| `farm_diary_masters` | Farm Diary & SOPs |
| `fspp_approvals` | FSPP Approvals |
| `retail` | Retail & Inventory |
| `farm_diary_approvals` | Farm Diary |

### Confirmed sidebar key **not** in `WEB_MODULES`

| module_name key | Used where |
|---|---|
| `role_management` | `AppSidebar` for `/roles` |

### Confirmed Settings are **not** a permission module

Settings appear only when display `role === 'Super Admin'`, not via `can_view` on a settings module key.

### 4.2 Mobile App Modules (`MOBILE_MODULES`)

### Confirmed keys and labels (RolesPage)

| module_name key | Label |
|---|---|
| `mobile_distributor` | Distributor Module |
| `mobile_dealer` | Dealer Module |
| `mobile_farmer` | Farmer Module (Includes Farm Card, Diary, FSPP, etc.) |
| `mobile_farmer_onboard` | Farmer Onboarding (Profiles & General Visits Only) |
| `mobile_fpo` | FPO Module |
| `mobile_travel_activity` | Executive Travel Activity (Attendance, Reports, Expenses) |
| `mobile_retail` | Retail & Inventory |

### Unconfirmed

How the mobile app interprets `can_view` / `can_edit` for these keys (mobile app not in this repo).

### 4.3 Module catalog conflict — `PermissionEditor`

### Confirmed conflict

`PermissionEditor` maintains a **different, incomplete** web module list for **per-user** `user_permissions`:

- Includes: `farmers`, `dealers`, `distributors`, `fpos`, `sales_executives`, `routes`, `attendance`, `expenses`, `locations`, `shifts`, `farm_diary_masters`, `fspp_approvals`, `retail`, `farm_diary_approvals`  
- **Missing vs RolesPage:** `dashboard`  
- **Missing vs sidebar:** `role_management`  
- **No mobile keys**

### Confirmed: `PermissionEditor` is unused

No file in the repository imports `PermissionEditor`. Runtime authorization reads **`role_permissions`**, not `user_permissions`.

---

## 5. Creation Rules (Roles)

### Confirmed

1. A role may be created with:
   - **Role Name** (required, non-empty after trim)
   - **Platform Reach** (required in form; default on create = `Both`)
   - Zero or more module View/Edit grants  
2. Allowed platform values: `Mobile` (“Mobile App Only”), `Web` (“Web Dashboard Only”), `Both` (“Both Mobile & Web”).  
3. Which permission toggles are shown depends on platform:
   - `Web` or `Both` → show Web Dashboard Modules  
   - `Mobile` or `Both` → show Mobile App Modules  
4. On save (create): insert `roles` row, then replace that role’s permissions (see §7).  
5. Permissions with **neither** view nor edit are **not stored**.

### Implementation Detail

- Create UI button always available on Roles page (no `can_edit` check on the page).  
- Save disabled while name empty or while saving.

### Unconfirmed

- Uniqueness of role names  
- Maximum length / character rules for names  
- Whether “Super Admin” must exist as seed data or is created manually  

---

## 6. Editing Rules (Roles)

### Confirmed

1. Existing roles can be opened for edit; form loads `name`, `platform`, and existing `role_permissions`.  
2. Updating a role writes `name` and `platform` on `roles`.  
3. Permissions are **fully replaced** on every save (delete all for `role_id`, then insert granted rows).  
4. View/Edit coupling while toggling (see §8) applies during edit.

### Implementation Detail / Edge case

Permission state is kept in a single map. If a role previously had Mobile grants and the editor changes platform to `Web`, mobile toggles are hidden but previously loaded mobile keys may remain in local state and can still be **re-inserted on save** (save does not filter by current platform).

---

## 7. Deletion Rules (Roles)

### Confirmed

1. A role can be deleted after a browser confirm:  
   `Are you sure you want to delete the role "<name>"?`  
2. Deletion calls `roles.delete` by `id`.  
3. Client does **not** check whether profiles still reference the role before delete.

### Unconfirmed

- Database cascade / restrict behavior for `role_permissions` and `profiles.role_id`  
- Whether orphaned profiles retain a dead `role_id` and lose all non-bypass permissions  

---

## 8. Validation Rules (Permission Toggles)

### Confirmed (RolesPage toggle logic)

1. Enabling **Edit** forces **View** on for that module.  
2. Disabling **View** forces **Edit** off for that module.  
3. Therefore invalid combinations `edit=true, view=false` are prevented in the Roles UI.

### Confirmed contrast — `PermissionEditor`

Per-user editor allows independent View/Edit checkboxes **without** the coupling above (component unused at runtime).

### Confirmed role save validation

- Role name required (trim).  
- No client-side requirement that at least one module be granted (role with zero permissions is allowed).

---

## 9. Assignment Rules (Users ↔ Roles)

### 9.1 Assign Web role to team user (Team Management)

### Confirmed

1. Team Management is shown on Dashboard **only** when `useAuth().role === 'Super Admin'`.  
2. Listed users are profiles where legacy `role IN ('TH','CO')`.  
3. Role picker options = roles with `platform IN ('Web','Both')`.  
4. Create user requires: Full Name, Mobile (exactly 10 digits), Temporary Password (min 6), Assigned Web Role.  
5. Email field is optional in the form UI.  
6. Creation invokes edge function `create-se` with **`role: 'CO'`** (legacy), then updates `profiles.role_id` to the selected role, matched by **mobile**.

### Implementation Detail

Edge function for non-SE requires a real email for Auth (`Email is required for Admin/CO accounts.`). So if Team Management submits without email, creation fails at the function — form does not mark email required.

### Confirmed display rules for assigned role badge

- Prefer `roles.name`  
- Else if legacy `role === 'TH'` → show “Super Admin”  
- Else → “Unassigned”

### Unconfirmed

- Editing / reassigning role on an existing team user after creation (no UI found)  
- Deleting team users  

### 9.2 Assign Mobile role to Sales Executive

### Confirmed

1. Creating an SE requires `sales_executives` **can_edit**.  
2. Role picker options = roles with `platform IN ('Mobile','Both')`.  
3. Create invokes `create-se` with **`role: 'SE'`**, then optionally sets `profiles.role_id` if `selectedRoleId` is set.  
4. UI labels Assigned Mobile Role as required (`*`).

### Confirmed conflict

`handleCreate` validation requires first name, mobile, password — **does not require** `selectedRoleId`. An SE can be created without a dynamic role link if the select is left empty (despite UI “required” markup).

### 9.3 Auth email rules tied to legacy role (provisioning)

### Confirmed (`create-se`)

| Legacy `payload.role` | Auth login email |
|---|---|
| `SE` (default) | `{mobile}@gmail.com` |
| anything else (e.g. `CO`) | provided `email` (required) |

SE real email may be stored on `profiles.email` after Auth create.

---

## 10. Permissions — Runtime Evaluation

### Confirmed evaluation algorithm (`usePermissions`)

For a signed-in user id:

1. Load `profiles.role`, `profiles.role_id`, and linked `roles.name`.  
2. **Admin bypass (“GOD MODE”)** if:
   - `profiles.role === 'TH'` **OR**
   - linked `roles.name === 'Super Admin'`  
   → treat every module as `{ can_view: true, can_edit: true }`.  
3. Else if `role_id` present → load all `role_permissions` for that role.  
4. Else → no grants (all modules false).  
5. `getModulePerm(moduleName)` returns booleans coerced with `!!` (null/false → false).

### Confirmed: `user_permissions` is not read at runtime

Despite an `AppSidebar` comment saying permissions come from `user_permissions`, the hook reads **`role_permissions` only**.

### Confirmed missing role_id behavior

A non-TH user without `role_id` has **no module access** (except sidebar always showing Dashboard link — see §11).

### Confirmed CO is not an automatic bypass

Legacy `CO` alone does **not** grant admin bypass; CO users rely on assigned `role_id` permissions (unless somehow named Super Admin).

---

## 11. Navigation / Access Rules

### 11.1 Authentication gate

### Confirmed

- Unauthenticated users are redirected to `/login`.  
- Authenticated session is required for app routes (`Index.tsx` `guard`).  
- Login uses Supabase email/password. Login page also offers signup with email (no role assignment in that path).

### 11.2 Platform / SE web denial

### Confirmed (`AppLayout`)

If `platform === 'Mobile'` **OR** display `role === 'SE'`:

- User sees “Mobile App Only” / web access denied and Sign Out.  
- They do not receive the admin shell (sidebar/content).

Message text references “Earthflow Mobile Application.”

### Implementation Detail

`RolesPage` itself wraps content in `AppLayout`, so Mobile/SE users cannot use Roles UI through the normal shell. Routes that render without going through layout still require session, but feature pages typically use `AppLayout`.

### 11.3 Sidebar visibility

### Confirmed

1. **Dashboard** nav item is **always shown** (not filtered by `can_view`).  
2. All other nav items require `getModulePerm(module).can_view`.  
3. Settings group visible only if display role is `Super Admin`.

### Confirmed conflict — Dashboard always in nav vs page guard

Dashboard page still enforces `getModulePerm('dashboard').can_view` and can show Access Denied even though the nav link is always visible (non-admin without dashboard grant).

### Confirmed conflict — Roles page vs `role_management`

- Sidebar uses module key `role_management`.  
- `role_management` is **not** grantable in RolesPage `WEB_MODULES`.  
- Non-bypass users therefore **cannot receive** `role_management` through the Roles UI.  
- **RolesPage does not call `usePermissions`** — any authenticated user who is allowed into the web shell and navigates to `/roles` can create/edit/delete roles.

### Confirmed conflict — Settings URL vs nav

Settings routes (`/settings/...`) are only session-guarded in the router. Super Admin check is **nav-only** (and Team Management on Dashboard). A non–Super Admin who knows the URL can open Settings pages if they pass `AppLayout`.

---

## 12. How `can_view` / `can_edit` Affect Feature Modules

### Confirmed general pattern

| Capability | Typical effect |
|---|---|
| `can_view = false` | Page shows Access Denied; often skips data fetch |
| `can_view = true`, `can_edit = false` | Read-only: hide create/edit/approve/delete controls |
| both true | Full UI actions for that module |

### Confirmed per-module enforcement in this web app

| Module key | View enforced | Edit enforced (examples) |
|---|---|---|
| `dashboard` | Yes | N/A (KPIs); Team Management gated by Super Admin name, not `can_edit` |
| `sales_executives` | Yes | Add SE, demo toggle pass-through, detail edit |
| `distributors` | Yes | **Edit flag not used** on page (view-only gating found) |
| `dealers` | Yes | Table/detail `canEdit` |
| `farmers` | Yes | Table/detail `canEdit` |
| `fpos` | Yes | Table/detail `canEdit` |
| `routes` | Yes | Build/edit/unassign route |
| `attendance` | Yes | **No `can_edit` usage found** (view/export oriented) |
| `expenses` | Yes | Passed to expense action sheet |
| `locations` | Yes | CRUD buttons |
| `shifts` | Yes | Create/edit shift controls |
| `farm_diary_masters` | Yes | All master/SOP mutate controls |
| `fspp_approvals` | Yes | Approve/Reject actions |
| `retail` | Yes | Item create/edit/delete/transfer |
| `farm_diary_approvals` | **Conflict** | Page checks `farm_diary_masters` instead of `farm_diary_approvals` |

### Confirmed conflict — Farm Diary operations permission key

- Sidebar / Roles catalog key for Farm Diary list page: `farm_diary_approvals`  
- `FarmDiaryPage` calls `getModulePerm('farm_diary_masters')`  
→ Granting only `farm_diary_approvals` may **not** open the Farm Diary page; granting `farm_diary_masters` controls both Masters and (incorrectly) the Diary list page.

### Confirmed — FSPP detail sheet from approvals

When opening farmer details from FSPP Approvals, farmer sheet is opened with `canEdit={false}` (approvals edit is separate approve/reject on the card).

### Confirmed security limitation

Authorization is **client-side UI gating**. Checked-in RLS for core tables allows any authenticated user full read/write. Server-side enforcement of role_permissions is **Unconfirmed** / not present in local migrations.

---

## 13. Statuses and State Transitions

Roles & Access itself has **no status field** on roles.

### Confirmed derived “modules granted” count

Displayed as number of `role_permissions` rows for the role (not a distinct status).

### Confirmed permission truthiness

Stored `can_view` / `can_edit` may be null from DB; runtime treats null as false.

---

## 14. Workflow Rules

### Confirmed — Role lifecycle

1. Create role (name + platform)  
2. Toggle module View/Edit (with coupling rules)  
3. Save → persist role + replace permissions  
4. Assign role to users at creation (web CO or mobile SE)  
5. User signs in → resolve display role/platform → evaluate permissions → filter nav + page actions  
6. Optional delete role (confirm)

### Confirmed — Permission replace workflow

Save always: `DELETE role_permissions WHERE role_id = …` then insert only rows with view or edit true.

---

## 15. Conditional Behavior Summary

| Condition | Behavior |
|---|---|
| No session | Redirect login |
| `platform === 'Mobile'` or display role `SE` | Web shell denied |
| `profiles.role === 'TH'` | Full module bypass |
| `roles.name === 'Super Admin'` | Full module bypass + Settings + Team Management |
| Display role `Super Admin` only (string from useAuth) | Settings + Team Management |
| No `role_id` and not bypass | All `getModulePerm` false |
| Dashboard nav | Always visible |
| Other nav | Requires `can_view` |
| Edit without view (Roles UI) | Impossible (auto-coupled) |

---

## 16. Dependencies on Other Modules

### Confirmed outbound dependencies (Roles & Access controls)

Every web feature module listed in §4.1 depends on this module’s grants for UI access.

### Confirmed inbound dependencies

| Dependency | Why |
|---|---|
| **Authentication (Supabase Auth + profiles)** | User identity and `role` / `role_id` |
| **Sales Executives** | Assigns Mobile/Both roles when creating SEs |
| **Dashboard / Team Management** | Assigns Web/Both roles when creating CO users; Super Admin-only |
| **Edge function `create-se`** | Creates Auth users + legacy role before `role_id` link |
| **AppLayout / AppSidebar** | Enforce platform and nav filtering |

### Confirmed mobile dependency (external)

Mobile module keys are configured here but consumed by a companion app **outside this repository**.

---

## 17. Calculations / Derived Values

### Confirmed

1. Display role name = `roles.name` OR legacy `profiles.role`.  
2. Display platform = `roles.platform` OR (`SE` → `Mobile`, else `Both`).  
3. Admin flag = TH legacy OR Super Admin dynamic name.  
4. Modules Granted count = count of permission rows.  
5. Boolean coercion of nullable permission flags.

No numeric scoring calculations in this module.

---

## 18. Data Ownership / Scoping

### Confirmed

- Roles and role_permissions are **global** (no territory / SE scoping in queries).  
- Permission evaluation is **per signed-in user** via their profile’s `role_id` (or bypass).  
- Team user list scoped to legacy roles `TH` and `CO` only (SEs managed elsewhere).

### Unconfirmed

Multi-tenant / org isolation (none found).

---

## 19. Exceptional Cases / Edge Cases

### Confirmed

1. **Bypass vs Settings:** Legacy `TH` gets all module permissions but **not** Settings/Team Management unless display role string is `Super Admin`.  
2. **Dashboard nav always on** can lead to Access Denied page.  
3. **Roles page ungarded** by `role_management` / `can_edit`.  
4. **`role_management` not grantable** via Roles UI.  
5. **Farm Diary key mismatch** (`farm_diary_approvals` vs `farm_diary_masters`).  
6. **Unused `user_permissions` path** vs live `role_permissions`.  
7. **SE create** can omit `role_id` despite required UI label.  
8. **Team create** email optional in UI but required by edge function for CO.  
9. **Platform change** may leave hidden platform’s permissions in save payload.  
10. **Login signup** on LoginPage creates Auth users without going through role assignment flows.  
11. **RegisterPage** (TH signup via `{mobile}@gmail.com`) exists but is **not routed** in `Index.tsx` — dead path unless linked elsewhere.  
12. Deleting a role does not warn about assigned users.

---

## 20. Security-Related Behavior

### Confirmed

1. Client-side RBAC only for module UI.  
2. Admin bypass is powerful (TH or Super Admin name).  
3. Early migration policies: authenticated users can ALL on profiles/dealers/farmers/etc. — **does not encode role_permissions**.  
4. Role administration endpoint is the same Supabase client as other CRUD — any authenticated shell user who can open `/roles` can mutate the global role matrix.  
5. `create-se` uses service role key server-side to create Auth users (privileged).

### Unconfirmed

- Whether production RLS was later tightened to enforce roles  
- Whether edge function verifies caller authorization beyond receiving a Bearer token  

---

## 21. Important Legacy Behavior

### Confirmed

1. Dual model: legacy `profiles.role` (`SE`/`TH`/`CO`) **plus** dynamic `roles` / `role_id`.  
2. TH remains a hard-coded bypass independent of `role_permissions` content.  
3. Super Admin is a **role name string**, not a separate enum.  
4. Web staff created as legacy `CO` then linked to a dynamic web role.  
5. Field staff created as legacy `SE` then linked to a dynamic mobile role.  
6. Sidebar comment still refers to `user_permissions` after migration to role-based RBAC.  
7. `PermissionEditor` remains as leftover per-user permission UI writing `user_permissions` but is not mounted.

---

## 22. Cross-Module Effects

### Confirmed

Changing a role’s `role_permissions` immediately affects all users with that `role_id` on next permission fetch (per page/hook mount — no global cache invalidation beyond component lifecycle).

Assigning Mobile-only platform to a user who tries to use the web admin results in **web denial** via `AppLayout`.

Granting/revoking web module keys changes sidebar and page mutability across Distributors, Dealers, Farmers, FPOs, Routes, Attendance, Expenses, Locations, Shifts, Farm Diary Masters, FSPP Approvals, Retail, Dashboard, Sales Executives.

Mobile key changes affect the companion app only (**Unconfirmed** how).

---

## 23. Evidence Index (key files)

| Concern | File |
|---|---|
| Role CRUD + module catalogs + view/edit coupling | `src/pages/RolesPage.tsx` |
| Runtime permission resolution + bypass | `src/hooks/usePermissions.ts` |
| Display role / platform resolution | `src/hooks/useAuth.ts` |
| Nav filtering + Settings Super Admin | `src/components/AppSidebar.tsx` |
| Mobile/SE web block | `src/components/AppLayout.tsx` |
| Team user create + web role assign | `src/components/AdminUserManagement.tsx` |
| Super Admin Team Management visibility | `src/pages/Dashboard.tsx` |
| SE create + mobile role assign | `src/pages/SEsPage.tsx` |
| Auth user provisioning by legacy role | `supabase/functions/create-se/index.ts` |
| Unused per-user permissions UI | `src/components/PermissionEditor.tsx` |
| Route auth only | `src/pages/Index.tsx` |
| Farm Diary key mismatch | `src/pages/FarmDiaryPage.tsx` vs sidebar |

---

## 24. Rules a New Stack Must Preserve (functional checklist)

To behave like the reference system, a reimplementation must at least:

1. Support roles with `name`, `platform ∈ {Web, Mobile, Both}`, and per-module `can_view` / `can_edit`.  
2. Support the exact web and mobile module key catalogs above (including label meanings).  
3. Enforce Edit ⇒ View and ¬View ⇒ ¬Edit when configuring role grants.  
4. Persist only grants where view or edit is true; replace-all on save.  
5. Resolve user access from profile `role_id` → role_permissions, with bypass for legacy `TH` and role name `Super Admin`.  
6. Deny web admin shell to platform `Mobile` or role `SE`.  
7. Always show Dashboard nav; still gate Dashboard page by `dashboard` view for non-bypass users **or** consciously resolve this conflict.  
8. Gate Settings and Team Management by Super Admin display name (as today).  
9. Assign Web/Both roles to CO web users and Mobile/Both roles to SE users at creation.  
10. Preserve dual legacy role + dynamic role model unless an explicit migration redesign is approved outside this document.

Explicit conflicts that must be decided deliberately (do not paper over):

- Roles page access vs missing `role_management` grant matrix  
- `user_permissions` leftover vs `role_permissions` runtime  
- Farm Diary permission key mismatch  
- Dashboard always-visible nav vs dashboard `can_view`  
- TH bypass without Super Admin Settings privileges  

---

*End of Roles & Access business rules extraction.*
