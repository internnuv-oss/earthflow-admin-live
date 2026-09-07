# API Requirements — Roles & Access

> Extracted from the reference application. Defines backend API capabilities required to support Roles & Access and the permission system used by all modules.

## Meta

| Item | Value |
|------|-------|
| Old route | `/roles` |
| Sidebar permission key | `role_management` (nav visibility) |
| Grantable module keys | `WEB_MODULES` + `MOBILE_MODULES` in `RolesPage.tsx` |
| Tables / services touched | `roles`, `role_permissions`, `profiles`, `user_permissions` (orphaned UI), Supabase Auth, `create-se` edge function |
| Admin can create? | **Yes** — create role + permissions |
| Admin can edit? | **Yes** — update role name, platform, permissions |
| Admin can delete? | **Yes** — delete role by id |

**Primary sources:** `RolesPage.tsx`, `usePermissions.ts`, `useAuth.ts`, `AppSidebar.tsx`, `PermissionEditor.tsx` (unused in routes), `supabase/functions/create-se/index.ts`

---

## Required APIs

| ID | Feature | Old implementation | Suggested endpoint | Method | Query/body summary | Permission | Priority | Implemented |
|----|---------|-------------------|-------------------|--------|-------------------|------------|----------|-------------|
| R-01 | List roles with permissions | `roles.select('*, role_permissions(*)').order('created_at')` | `/api/roles` | GET | Include nested permissions | Authenticated | Must | ☐ |
| R-02 | Create role | `roles.insert([{ name, platform }]).select('id')` | `/api/roles` | POST | `{ name, platform }` | Authenticated | Must | ☐ |
| R-03 | Update role metadata | `roles.update({ name, platform }).eq('id', id)` | `/api/roles/:id` | PATCH | `{ name, platform }` | Authenticated | Must | ☐ |
| R-04 | Delete role | `roles.delete().eq('id', id)` | `/api/roles/:id` | DELETE | — | Authenticated | Must | ☐ |
| R-05 | Replace role permissions | Delete all `role_permissions` for role_id, then batch insert | `/api/roles/:id/permissions` | PUT | `{ permissions: [{ module_name, can_view, can_edit }] }` | Authenticated | Must | ☐ |
| R-06 | Get current user profile + role | `profiles.select('role, roles(name, platform)').eq('id', userId)` | `/api/auth/me` | GET | Legacy role + dynamic role | Authenticated | Must | ☐ |
| R-07 | Resolve current user permissions | `profiles` + `role_permissions` by `role_id`; TH/Super Admin bypass | `/api/auth/me/permissions` | GET | `{ [module]: { can_view, can_edit }, isAdmin }` | Authenticated | Must | ☐ |
| R-08 | Get grantable module catalog | Hardcoded `WEB_MODULES` + `MOBILE_MODULES` in RolesPage | `/api/roles/module-catalog` | GET | Web + mobile keys and labels | Authenticated | Should | ☐ |
| R-09 | List user-specific permissions | `user_permissions.select('*').eq('user_id', userId)` | `/api/users/:id/permissions` | GET | Per-user overrides | Authenticated | Nice | ☐ |
| R-10 | Upsert user-specific permissions | `user_permissions.upsert(..., onConflict: user_id,module_name)` | `/api/users/:id/permissions` | PUT | Array of module perms | Authenticated | Nice | ☐ |
| R-11 | Provision user with role (edge fn) | `create-se` creates Auth user + profile; assigns `role`, optional `role_id` from caller | `/api/users` or `/api/admin/users` | POST | name, email, mobile, password, role, role_id | Service/admin | Should | ☐ |

---

## Module Catalog (grantable keys)

### Web modules (`WEB_MODULES`)

| module_name | Label |
|-------------|-------|
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

### Mobile modules (`MOBILE_MODULES`)

| module_name | Label |
|-------------|-------|
| `mobile_distributor` | Distributor Module |
| `mobile_dealer` | Dealer Module |
| `mobile_farmer` | Farmer Module (Includes Farm Card, Diary, FSPP, etc.) |
| `mobile_farmer_onboard` | Farmer Onboarding (Profiles & General Visits Only) |
| `mobile_fpo` | FPO Module |
| `mobile_travel_activity` | Executive Travel Activity (Attendance, Reports, Expenses) |
| `mobile_retail` | Retail & Inventory |

### Sidebar-only key (not in WEB_MODULES)

| module_name | Used for |
|-------------|----------|
| `role_management` | `/roles` nav link in `AppSidebar` |

---

## Request and Response Shapes

### List roles

```json
[
  {
    "id": "uuid",
    "name": "Field Manager",
    "platform": "Both",
    "created_at": "2025-01-01T00:00:00Z",
    "role_permissions": [
      { "module_name": "dealers", "can_view": true, "can_edit": true },
      { "module_name": "distributors", "can_view": true, "can_edit": false }
    ]
  }
]
```

### Create / update role

```json
{
  "name": "Field Manager",
  "platform": "Both",
  "permissions": {
    "dealers": { "can_view": true, "can_edit": true },
    "distributors": { "can_view": true, "can_edit": false }
  }
}
```

`platform` values: `Web`, `Mobile`, `Both`.

### Current user permissions response

```json
{
  "isAdmin": false,
  "legacyRole": "CO",
  "roleName": "Field Manager",
  "platform": "Both",
  "modules": {
    "dealers": { "can_view": true, "can_edit": true },
    "distributors": { "can_view": true, "can_edit": false }
  }
}
```

When `isAdmin: true`, all modules return `{ can_view: true, can_edit: true }`.

### User permissions upsert (PermissionEditor — not mounted in app)

```json
[
  { "module_name": "dealers", "can_view": true, "can_edit": false },
  { "module_name": "fpos", "can_view": true, "can_edit": true }
]
```

---

## Business Rules

| Rule | Status |
|------|--------|
| Permission coupling: enabling `can_edit` forces `can_view`; disabling `can_view` forces `can_edit` off | **Confirmed in code** (RolesPage) |
| Save role: wipe existing `role_permissions` for role, insert only modules with view or edit true | **Confirmed in code** |
| Runtime permission check uses `role_permissions` via `profiles.role_id` | **Confirmed in code** (`usePermissions`) |
| Bypass: `profiles.role === 'TH'` OR `roles.name === 'Super Admin'` → full access | **Confirmed in code** |
| `useAuth` display role: prefer `roles.name`, fallback `profiles.role` | **Confirmed in code** |
| Platform fallback: SE → Mobile; else Both | **Confirmed in code** |
| Sidebar: Dashboard always visible; other items need `can_view` on module key | **Confirmed in code** |
| `role_management` gates sidebar only — **not** in RolesPage grant matrix | **Confirmed in code** |
| RolesPage has **no** `can_view` guard — any authenticated user can open `/roles` | **Confirmed in code** |
| `PermissionEditor` + `user_permissions` exist but **not imported** anywhere in app | **Confirmed in code** |
| Runtime does **not** read `user_permissions` in `usePermissions` | **Confirmed in code** |
| Mobile module keys stored on roles but mobile enforcement not in this repo | **UNCONFIRMED (needs manual product decision)** |
| FK/cascade when deleting role with assigned users | **UNCONFIRMED (needs manual product decision)** |
| `create-se`: SE auth email = `{mobile}@gmail.com`; CO/Admin uses real email | **Confirmed in code** (edge function) |

---

## What the Old App Does Not Expose

- Page-level permission guard on `/roles` itself
- `role_management` in the role-permission grant UI (only sidebar)
- Runtime use of `user_permissions` (component exists but orphaned)
- Settings modules as grantable permissions (Settings = Super Admin display role only)

---

## Dependencies

| API | Purpose |
|-----|---------|
| Supabase Auth / JWT session | All authenticated routes |
| `profiles` table | Links users to `role_id` and legacy `role` |
| User provisioning | `create-se` or equivalent for assigning roles at user create |

---

## Impact on Dealers / Distributors / FPOs modules

Every directory page calls:

1. `GET /api/auth/me` — session
2. `GET /api/auth/me/permissions` — module gate (`dealers`, `distributors`, `fpos`)
3. Edit actions require `can_edit: true` on respective module (except Distributors — read-only regardless)

Ensure your backend enforces the same permission keys on every mutating endpoint.
