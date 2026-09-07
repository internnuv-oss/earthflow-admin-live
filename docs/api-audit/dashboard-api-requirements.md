# Dashboard / Home — V2 API Requirements Audit

**Project:** FieldCommander Admin Dashboard (legacy)  
**Module:** Dashboard / Home (`/` → `/dashboard`)  
**Audit type:** Read-only frontend → backend capability inventory  
**Date:** 2026-08-31  
**Scope rule:** Conclusions are labeled **Verified**, **Inferred**, **Mocked**, **Hardcoded**, **Partial**, or **New V2**. No application source files were modified for this audit. Requested V2 product features are **not** treated as verified legacy behavior. Widgets that exist only on other module pages (Attendance, Shifts, Routes, Retail, Expenses) are **not** attributed to this screen.

---

## 1. Executive summary

### What the legacy Dashboard actually is

**Verified:** `/dashboard` is a **directory census**, not a field-operations command center.

The Home screen renders:

1. A static heading (“Overview”).
2. **Six KPI cards** of unscoped `COUNT(*)` totals for sales executives, completed SE onboarding, distributors, dealers, farmers, and incomplete onboarding drafts.
3. For users whose **dynamic role name** is exactly `Super Admin`, a **Team Management** table to list web staff (`profiles.role ∈ {TH, CO}`) and create new CO/admin accounts.

There are **no** charts, graphs, maps, leaderboards, timelines, activity feeds, alerts, date-range filters, comparison periods, attendance/shift/route/expense/retail widgets, export, polling, or real-time updates on this page.

### What V2 asks for vs what legacy does

| V2 requested capability | Legacy Dashboard reality | Label |
|---|---|---|
| Current admin profile and permissions | Loaded by layout/auth hooks, not by a dashboard API. Page gates on `dashboard.can_view` | **Verified** (auth/RBAC); not a dashboard payload |
| Organization / company context | **Not found** as a first-class entity | **New V2** |
| Teams, territories, executives as dashboard filters | **Not found** on Dashboard. KPI copy says “territory” but queries are global | **Hardcoded** copy; filters = **New V2** |
| Role-specific widget configuration | Only Super Admin sees Team Management. No widget config table | **Partial** (one hardcoded role check) |
| Default reporting period | **Not found** — counts are all-time | **New V2** |
| Attendance / shift / route / sales / expense / performance cards | **Not rendered** on Dashboard | **New V2** (module APIs exist elsewhere; see sibling audits) |
| Charts, maps, leaderboards, alerts, activity | **Not rendered** on Dashboard | **New V2** |
| Drill-down lists behind KPI counts | Four cards are `Link`s to directory routes; **no** modal/list of the counted rows | **Partial** (navigation only) |
| Independent widget load / partial failure | Eight HEAD counts in one `Promise.all`; failures become `0` with no error UI | **Verified** (fragile) |
| One dashboard summary endpoint | Frontend issues **eight parallel Supabase count queries** | Recommend hybrid (see §13) |

### Data access pattern (legacy)

**Verified:** Direct Supabase JS client from React. No REST/OpenAPI client, no React Query usage on this page (a `QueryClientProvider` wraps the app but Dashboard does not call `useQuery`), no dashboard store/reducer/context, no Zod schema, no mock dashboard fixtures.

`src/integrations/supabase/types.ts` is not a usable generated schema in this repo (placeholder text only).

### Critical engineering notes for backend

1. **Do not implement a field-ops dashboard by copying this page.** Preserving “all existing cards” means preserving **six directory counts + Super Admin user admin**. Attendance, shifts, routes, retail, and expenses are **separate modules**; their summary endpoints (already proposed as **New V2** in sibling audits) are **optional additions**, not legacy Home behavior.
2. **KPI copy lies.** “Active SEs in territory” is a **Hardcoded** description. The query is `profiles.role = 'SE'` with **no** active-status, territory, or `is_demo` filter.
3. **Demo-account inconsistency.** Attendance, Shifts, Expenses, and Retail exclude `is_demo = true`. Dashboard SE count **includes demo SEs**. V2 must pick one rule and document it.
4. **Draft math is frontend-only.** Directory totals = submitted table count + `drafts` count for that `entity_type`. Pending counts are fetched but **only the sum** is shown. FPO drafts are **excluded**.
5. **RLS is not a tenancy boundary.** Early migration policies are `FOR ALL TO authenticated USING (true)`. Any authenticated web user who can hit these tables sees **global** counts. Dashboard also fires the count queries **before** the `can_view` gate (effect runs on mount with `[]` deps).
6. **`dashboard.can_edit` is unused.** Roles UI exposes View/Edit for “Dashboard Overview”; the page only checks `can_view`.
7. **Sidebar vs page permission mismatch.** Nav always shows Dashboard; the page may then show Access Denied.
8. **Super Admin widget uses a different identity rule** than RBAC god-mode (`TH` **or** role name Super Admin vs role name **exactly** `Super Admin`).

---

## 2. Dashboard screen and widget inventory

### 2.1 Navigation and entry

| Item | Detail | Confidence |
|---|---|---|
| Default route | `/` → `/dashboard` if session, else `/login` | **Verified** — `Index.tsx` L42 |
| Login success | `navigate('/dashboard', { replace: true })` | **Verified** — `LoginPage.tsx` L27 |
| Signup email redirect | `${origin}/dashboard` | **Verified** — `LoginPage.tsx` L32 |
| Router | `<Route path="/dashboard" element={guard(<Dashboard />)} />` | **Verified** — `Index.tsx` L44 |
| Auth guard | Unauthenticated → `/login` | **Verified** — `Index.tsx` L38, L44 |
| Sidebar | Always listed, module key `dashboard` | **Verified** — `AppSidebar.tsx` L31, L71–73 |
| Permission (page) | `getModulePerm('dashboard').can_view` | **Verified** — `Dashboard.tsx` L25, L70–79 |
| Roles matrix | `{ key: 'dashboard', label: 'Dashboard Overview' }` | **Verified** — `RolesPage.tsx` L15 |
| Web vs mobile shell | `platform === 'Mobile'` or `role === 'SE'` → “Mobile App Only” (no Dashboard) | **Verified** — `AppLayout.tsx` L26–35 |
| Layout | `AppLayout` (sidebar + header + logout). No dashboard-specific chrome | **Verified** |

### 2.2 UI surface map (what `/dashboard` actually renders)

```
/dashboard  Dashboard
├── Auth/perm loading → full-screen Loader2
├── !dashboard.can_view → Access Denied (still inside AppLayout)
└── Overview
    ├── Header (static title + subtitle)
    ├── KPI grid (1 / 2 / 3 columns)
    │   ├── Sales Executives          → Link /sales-executives
    │   ├── SE Profiles Complete      → no link
    │   ├── Distributors              → Link /distributors
    │   ├── Dealers                   → Link /dealers
    │   ├── Farmers                   → Link /farmers
    │   └── Total Drafts              → no link
    └── [role name === 'Super Admin'] Team Management (AdminUserManagement)
        ├── Users table (TH/CO profiles)
        ├── Client pagination (10 / page)
        └── Add New User dialog → Edge Function create-se + profiles.role_id update
```

### 2.3 Widget inventory (legacy Home)

| ID | Widget | Business purpose | Status |
|---|---|---|---|
| W0 | Overview header | Static page title | **Hardcoded** |
| W1 | Sales Executives KPI | Count of SE profiles; navigate to SE directory | **Verified** |
| W2 | SE Profiles Complete KPI | Count of completed mobile onboarding rows | **Verified** |
| W3 | Distributors KPI | Submitted distributors + distributor drafts; navigate to directory | **Verified** |
| W4 | Dealers KPI | Submitted dealers + dealer drafts; navigate to directory | **Verified** |
| W5 | Farmers KPI | Submitted farmers + farmer drafts; navigate to directory | **Verified** |
| W6 | Total Drafts KPI | Sum of distributor + dealer + farmer draft counts | **Verified** (client sum) |
| W7 | Team Management | Super Admin web-staff list + create user | **Verified** (role-gated) |
| W7a | Team table | Name, email, mobile, assigned role | **Verified** |
| W7b | Add New User dialog | Create CO/admin via `create-se` | **Verified** |
| W7c | Table pagination | 10 rows / page, client-side | **Verified** |

### 2.4 Requested widgets **not** on this screen

The following were searched on Dashboard (and its only child `AdminUserManagement` / `KpiCard`). They are **Not found** on Home. Sibling modules may implement related UIs; those are **not** Dashboard requirements. Treat as **New V2** if product wants them on Home.

| Area | Not found on `/dashboard` |
|---|---|
| Attendance | Present / absent / half-day / leave counts, attendance %, trends, late punch-in, missing punch-out, drill-down lists |
| Shifts | Active / completed / missed / incomplete counts, currently active executives, exceptions |
| Routes / field | Assigned / completed / pending / missed routes, adherence, planned vs actual visits, in-field executives, map markers, punched activities |
| Retail / sales / inventory | Orders, invoices, sales amount, collections, targets, outlet visits, product performance, stock / low-stock, stock assigned to SEs, invoice trends |
| Expenses | Submitted / queried / approved / rejected counts, pending review amount, TA/DA totals, expense trends |
| Executive performance | Active/inactive split, productivity, target achievement, top/low performers, ranking, team/territory comparison |
| Alerts / activity | Pending admin actions, unread count, acknowledgement, audit feed |
| Analytics chrome | Date presets (D/W/M/Q/custom), previous-period comparison, % change, chart granularity, export of dashboard data |
| Other directories | FPO count/card (FPOs exist as `/fpos` but not on Dashboard) |

**Out of scope (name collision):** `FarmerDetailSheet` has an internal view state `'dashboard'` — that is a farmer profile landing pane, **not** Home. Territory Routes “Analytics” tabs and `RoutesPage` analytics tables are **not** mounted on `/dashboard`.

### 2.5 Search term coverage

| Term | Finding on Dashboard |
|---|---|
| dashboard / home / overview | **Verified** route `/dashboard`, heading “Overview” |
| summary / KPI / statistics / metrics | Six `KpiCard`s; no other metrics |
| performance / trend / chart / graph | **Not found** (`src/components/ui/chart.tsx` exists unused here) |
| map / activity / leaderboard | **Not found** |
| target / achievement / productivity | **Not found** |
| attendance / shift / route / sales / stock / invoice / expense | **Not found** on this page |
| executive / retailer / outlet / visit | SE count only; no retailer/outlet/visit widgets. “Retailer” is not a Dashboard entity (Dealers/Distributors/Farmers) |
| mock / fixture dashboard data | **Not found** |

---

## 3. Legacy implementation and data-flow map

### 3.1 Source files (Dashboard core)

| File | Role |
|---|---|
| `src/pages/Dashboard.tsx` | Page, permission gate, 8 count queries, KPI grid, Super Admin slot |
| `src/components/KpiCard.tsx` | Presentational card + optional `react-router` `Link` |
| `src/components/AdminUserManagement.tsx` | Super Admin team table + create-user dialog |
| `src/hooks/useAuth.ts` | Session, dynamic role name, platform |
| `src/hooks/usePermissions.ts` | `role_permissions` + TH/Super Admin bypass |
| `src/components/AppLayout.tsx` | Shell; blocks Mobile/SE |
| `src/components/AppSidebar.tsx` | Nav; Dashboard always visible |
| `src/pages/Index.tsx` | Routes and session guard |
| `src/pages/LoginPage.tsx` | Auth → `/dashboard` |
| `src/pages/RolesPage.tsx` | Registers module `dashboard` |
| `src/components/PermissionEditor.tsx` | **Dead code** — never imported; uses `user_permissions` and **omits** `dashboard` |
| `src/App.tsx` | `QueryClientProvider` (unused by Dashboard) |
| `src/integrations/supabase/client.ts` | Anon-key Supabase client, localStorage session |
| `supabase/functions/create-se/index.ts` | Edge Function used to create SE **and** CO/admin users |
| `supabase/migrations/20260511052322_*.sql` | Early `profiles` / `sales_executive` / directory tables + open RLS |

### 3.2 Runtime data flow

```
Browser
  supabase.auth.getSession + onAuthStateChange     → session
  profiles ⋈ roles (useAuth)                       → role name, platform
  profiles + role_permissions (usePermissions)     → dashboard.can_view
        │
        ├─ AppLayout: if Mobile or SE → block entire web
        ├─ AppSidebar: always show Dashboard link
        └─ Dashboard
              if !can_view → Access Denied
              else:
                Promise.all 8 HEAD counts ──────────► KPI cards
                if role === 'Super Admin':
                  roles (Web|Both)                  ► role dropdown
                  profiles where role in (TH,CO)    ► team table
                  POST functions/v1/create-se       ► new user
                  PATCH profiles.role_id            ► link dynamic role
```

### 3.3 Request fan-out (legacy)

On every Dashboard mount (including users who will be Access Denied):

| # | Query | Purpose |
|---|---|---|
| 1 | `profiles.select('id', {count:'exact', head:true}).eq('role','SE')` | W1 |
| 2 | `sales_executive.select('profile_id', {count:'exact', head:true}).eq('is_profile_complete', true)` | W2 |
| 3 | `distributors.select('id', head count)` | W3 numerator (submitted) |
| 4 | `dealers.select('id', head count)` | W4 submitted |
| 5 | `farmers.select('id', head count)` | W5 submitted |
| 6 | `drafts.select('id', head count).eq('entity_type','distributor')` | W3 pending + W6 |
| 7 | same for `'dealer'` | W4 pending + W6 |
| 8 | same for `'farmer'` | W5 pending + W6 |

Plus, independently of KPIs: `useAuth` (1) + `usePermissions` (1–2). Super Admin adds `roles` list + `profiles` staff list.

**N+1:** Not present for KPIs (fixed 8 counts). Team create is sequential (getSession → invoke function → update profile by **mobile**, not by returned user id).

### 3.4 Shared / dependent modules (navigation only)

| Target | How Dashboard uses it |
|---|---|
| `/sales-executives` | W1 `to` |
| `/distributors` | W3 `to` |
| `/dealers` | W4 `to` |
| `/farmers` | W5 `to` |
| Attendance / Shifts / Routes / Expenses / Retail / FPOs | **No** Dashboard queries or links |

Directory pages combine submitted + drafts the same way as W3–W5 (**Verified** on Distributors/Dealers/Farmers pages). SE directory lists the same `role='SE'` population as W1, including demo accounts (**Verified** `SEsPage.tsx` L70–75).

---

## 4. Global filters and dashboard initialization

### 4.1 Initialization sequence (legacy)

| Step | Source | Fields consumed | Status |
|---|---|---|---|
| 1. Session | `supabase.auth` | `session.user.id`, later `access_token` for `create-se` | **Verified** |
| 2. Profile + role | `profiles.select('role, roles(name, platform)').eq('id', userId).single()` | `roles.name` preferred over `profiles.role`; `roles.platform`; fallback platform `SE` → Mobile else Both | **Verified** `useAuth.ts` L12–30 |
| 3. Permissions | If `profiles.role === 'TH'` **or** `roles.name === 'Super Admin'` → all modules allowed. Else `role_permissions` by `role_id` | `{ module_name, can_view, can_edit }` | **Verified** `usePermissions.ts` L21–67 |
| 4. Dashboard gate | `getModulePerm('dashboard').can_view` | boolean | **Verified** |
| 5. KPI load | 8 counts (see §3.3) | integer `count` only | **Verified** |
| 6. Super Admin slot | `role === 'Super Admin'` string compare | shows W7 | **Verified** `Dashboard.tsx` L104 |

There is **no** dashboard-config, widget-visibility, default-filter, or reporting-period API.

### 4.2 Filters present on Home

| Filter | Legacy | Status |
|---|---|---|
| Date range / preset (today, week, month, quarter, custom) | **Not found** | **New V2** |
| Comparison period / previous period | **Not found** | **New V2** |
| Timezone | Counts are not time-sliced. Dates in Team table use `created_at` only for sort, not display | N/A for KPIs |
| Territory / team / executive | **Not found** | **New V2** |
| Status (attendance, shift, expense, invoice, …) | **Not found** | **New V2** |
| Organization / company | **Not found** | **New V2** |
| Include demo SEs | Implicitly **included** in W1; not a toggle | **Verified** omission |
| Search (KPI) | **Not found** | — |
| Search (Team table) | **Not found** | — |

### 4.3 Default values

| Item | Default | Status |
|---|---|---|
| KPI numbers before fetch completes | `0` for all counts (same as empty) | **Verified** `Dashboard.tsx` L27–30 |
| Team table page | `1`, page size `10` | **Verified** |
| Create-user legacy role | always `'CO'` in Edge Function body | **Verified** `AdminUserManagement.tsx` L123 |

### 4.4 Recommended V2 init contract (**hybrid**; see §13)

Preserve legacy with:

- `GET /v2/me` — profile, role, platform, permission map  
- `GET /v2/dashboard/summary` — the six KPI integers in one round trip  

Add only if product requires (all **New V2**):

- `GET /v2/organization`  
- `GET /v2/dashboard/config` (widget visibility by role)  
- Shared filter context: `from`, `to`, `timezone`, `territoryId`, `teamId`, `executiveId`, `includeDemo`

---

## 5. Widget-to-API matrix

Legend **Status**: Verified | Partial | Mocked | Hardcoded | Inferred | New V2  
Legend **Backend today**: Supabase table/query or Edge Function used by frontend

| # | UI feature / user action | Status | Existing data source | Recommended V2 endpoint | Notes |
|---|---|---|---|---|---|
| D0 | Load shell: session + role + platform | **Verified** | `auth` + `profiles` ⋈ `roles` | `GET /v2/me` | Not Dashboard-specific |
| D1 | Load module permissions | **Verified** | `role_permissions` or admin bypass | include in `GET /v2/me` or `GET /v2/me/permissions` | `dashboard.can_edit` unused |
| D2 | Access Denied without `dashboard.can_view` | **Verified** | D1 | AuthZ on all dashboard APIs | Sidebar still shows the link |
| D3 | Block SE / Mobile platform | **Verified** | `roles.platform` / legacy `role==='SE'` | AuthZ / `403` with code `WEB_ACCESS_DENIED` | `AppLayout.tsx` L26 |
| D4 | View W1 Sales Executives count | **Verified** | `profiles` count `role=SE` | `GET /v2/dashboard/summary` field `salesExecutives` | Includes demo |
| D5 | Click W1 → SE directory | **Verified** | Client route | n/a (or `GET /v2/executives`) | No count drill-down API |
| D6 | View W2 SE Profiles Complete | **Verified** | `sales_executive` count `is_profile_complete=true` | same summary | Not joined to `role=SE` |
| D7 | View W3 Distributors count | **Verified** | `distributors` + `drafts` distributor | same summary | Frontend adds the two counts |
| D8 | Click W3 → `/distributors` | **Verified** | Client route | n/a | |
| D9 | View W4 Dealers count | **Verified** | `dealers` + `drafts` dealer | same summary | |
| D10 | Click W4 → `/dealers` | **Verified** | Client route | n/a | |
| D11 | View W5 Farmers count | **Verified** | `farmers` + `drafts` farmer | same summary | HEAD count avoids Farmers page 1000-row pagination issue |
| D12 | Click W5 → `/farmers` | **Verified** | Client route | n/a | |
| D13 | View W6 Total Drafts | **Verified** (client) | sum of three draft counts | same summary `drafts.total` | Excludes FPO |
| D14 | Show per-entity pending on cards | **Not found** | pending stored in state unused | optional `drafts.byEntity` | `distributorsPending` etc. never rendered |
| D15 | FPO count / FPO drafts on Home | **Not found** | `/fpos` module only | optional summary field | **New V2** if desired |
| D16 | KPI error / loading / stale UI | **Partial** | none | `meta.calculatedAt`, per-widget errors | Failures look like `0` |
| D17 | List web staff (W7) | **Verified** | `profiles` `role in (TH,CO)` ⋈ `roles(name)` | `GET /v2/admin/users` | Super Admin only |
| D18 | Paginate staff | **Verified** (client) | slice 10 | `page`/`pageSize` on D17 | |
| D19 | Load web roles for create form | **Verified** | `roles` platform in Web, Both | `GET /v2/roles?platform=Web,Both` | |
| D20 | Create web user | **Verified** | `POST` Edge `create-se` then `profiles.update(role_id)` | `POST /v2/admin/users` | Legacy role forced `CO` |
| D21 | Edit / deactivate / delete staff | **Not found** | — | `PATCH`/`DELETE /v2/admin/users/{id}` | **New V2** |
| D22 | Attendance / shift / route / expense / retail / performance / alerts / charts / maps / export / polling | **Not found** | — | See §6.5 and sibling audits | **New V2** |
| D23 | Dashboard widget config by role | **Not found** | hardcoded Super Admin check | `GET /v2/dashboard/config` | **New V2** |
| D24 | Organization context | **Not found** | SE `organization_details` JSON is personal SE data, not tenant | `GET /v2/organization` | **New V2** |

---

## 6. Detailed API contracts

### 6.1 `GET /v2/me` — current admin (legacy: `useAuth` + `usePermissions`)

**Purpose:** Identify the signed-in web user, platform, and module flags so the shell and Dashboard gate can render.  
**Confidence:** **Verified** as existing queries; REST shape is **New V2**.  
**When:** App layout + every authenticated page, including Dashboard.

#### Existing calls

```text
profiles.select('role, roles(name, platform)').eq('id', userId).single()          -- useAuth.ts L13–17
profiles.select('role, role_id, roles(name)').eq('id', userId).single()           -- usePermissions.ts L23–31
role_permissions.select('module_name, can_view, can_edit').eq('role_id', role_id) -- L42–45
```

#### Recommended response (fields the frontend actually uses)

```json
{
  "id": "uuid",
  "legacyRole": "SE|TH|CO|string",
  "roleName": "string|null",
  "platform": "Web|Mobile|Both",
  "isSuperAdmin": false,
  "permissions": {
    "dashboard": { "canView": false, "canEdit": false }
  }
}
```

| Field | Legacy source | Consumed by |
|---|---|---|
| `id` | `session.user.id` | `usePermissions(userId)` |
| `legacyRole` | `profiles.role` | fallback role label; SE block; TH god-mode |
| `roleName` | `roles.name` | sidebar subtitle; Super Admin widget; god-mode |
| `platform` | `roles.platform` or inferred | `AppLayout` Mobile block |
| `permissions.dashboard.canView` | `role_permissions` or bypass | Dashboard Access Denied |
| `permissions.dashboard.canEdit` | same | **never read** on Dashboard |

**God-mode (Verified):** `profiles.role === 'TH'` **OR** `roles.name === 'Super Admin'` → `can_view`/`can_edit` true for every module, including dashboard.

**If no `role_id` and not god-mode:** permission list stays empty → `can_view` false (**Verified**).

**Auth:** Supabase JWT. Unauthenticated users never reach Dashboard (`Index.tsx` guard).

**Errors:** `useAuth` on profile error sets `role`/`platform` null and `loading` false — user may pass session guard then hit layout/permission oddities (**Partial** / **Inferred**).

---

### 6.2 `GET /v2/dashboard/summary` — KPI census (legacy: 8 HEAD counts)

**Purpose:** Populate W1–W6.  
**Confidence:** **Verified** inputs/outputs; single endpoint is a **recommended** wrap of today’s `Promise.all`.  
**HTTP:** `GET`  
**AuthZ:** `dashboard.can_view` (Recommended V2). Legacy still **executes the queries even when Access Denied**.

#### Path / query parameters (legacy)

**None.** No date, timezone, territory, team, executive, status, or `includeDemo`.

Recommended V2 query params (all **New V2**, unused today):

| Param | Type | Legacy |
|---|---|---|
| `includeDemo` | boolean | implicit `true` for SE count |
| `includeFpoDrafts` | boolean | implicit `false` |
| `timezone` | string | N/A |

#### Existing calls and exact consumed fields

Each call uses `{ count: 'exact', head: true }` and reads **only** `response.count` (or `0`). No row payloads, no nested objects.

| Variable | Query | Fields |
|---|---|---|
| `ses.count` | `from('profiles').select('id', head).eq('role','SE')` | count |
| `sesC.count` | `from('sales_executive').select('profile_id', head).eq('is_profile_complete', true)` | count |
| `dist.count` | `from('distributors').select('id', head)` | count |
| `deal.count` | `from('dealers').select('id', head)` | count |
| `farm.count` | `from('farmers').select('id', head)` | count |
| `draftDist.count` | `from('drafts').select('id', head).eq('entity_type','distributor')` | count |
| `draftDeal.count` | `from('drafts').select('id', head).eq('entity_type','dealer')` | count |
| `draftFarm.count` | `from('drafts').select('id', head).eq('entity_type','farmer')` | count |

`entity_type` values **Verified** on Dashboard: `distributor`, `dealer`, `farmer`. (`fpo` exists on `FposPage` but is not queried here.)

#### Frontend combination (**Verified** `Dashboard.tsx` L52–62, L82)

```text
ses                    = ses.count
sesComplete            = sesC.count
distributors           = dist.count + draftDist.count
distributorsPending    = draftDist.count          -- not displayed
dealers                = deal.count + draftDeal.count
dealersPending         = draftDeal.count          -- not displayed
farmers                = farm.count + draftFarm.count
farmersPending         = draftFarm.count          -- not displayed
totalPending           = distributorsPending + dealersPending + farmersPending
```

#### Recommended response

```json
{
  "salesExecutives": 0,
  "seProfilesComplete": 0,
  "distributors": { "submitted": 0, "drafts": 0, "total": 0 },
  "dealers": { "submitted": 0, "drafts": 0, "total": 0 },
  "farmers": { "submitted": 0, "drafts": 0, "total": 0 },
  "drafts": {
    "distributor": 0,
    "dealer": 0,
    "farmer": 0,
    "fpo": 0,
    "total": 0
  },
  "meta": {
    "calculatedAt": "ISO-8601",
    "includeDemo": true,
    "scope": "global"
  }
}
```

`fpo` and `meta` are **New V2**. Legacy UI needs `total` fields (or the six integers it already shows). Returning submitted vs draft separately lets V2 cards show pending without extra requests; Home today does not display the split.

#### Pagination / sort / limit

N/A (counts). Prefer SQL `COUNT` over loading rows. Farmers directory paginates at 1000 rows; Dashboard HEAD count does **not**.

#### Refresh / cache

| Behavior | Legacy | V2 recommendation |
|---|---|---|
| On mount | Fetch once (`useEffect` `[]`) | Same |
| Polling | **Not found** | Optional; not required to preserve UX |
| Realtime | **Not found** | Optional |
| Cache | None; remount refetches | Short TTL OK; counts are cheap |
| Manual refresh | **Not found** | Optional |

#### Partial failure (**Verified**)

No `error` checks, no `try/catch`. Supabase error objects yield `count` falsy → **0**. If `Promise.all` throws, state stays at initial zeros. There is **no** per-widget spinner; zeros are indistinguishable from empty data.

#### Permissions / visibility

Legacy: any authenticated user whose JWT passes open RLS. **Recommended V2:** require `dashboard.can_view`; optionally also require matching directory module to **navigate** (today a user can click W1 even without `sales_executives.can_view` and then see that page’s Access Denied).

---

### 6.3 `GET /v2/admin/users` — Team Management list (legacy W7)

**Purpose:** Table of web staff.  
**Confidence:** **Verified**. Visible only when `useAuth().role === 'Super Admin'` (**not** when merely `profiles.role === 'TH'`).  
**Module permission:** None beyond that string check. `dashboard.can_edit` is **not** consulted. `role_management` is a **separate** sidebar module.

#### Existing call (`AdminUserManagement.tsx` L77–81)

```text
profiles.select('*, roles(name)')
  .in('role', ['TH', 'CO'])
  .order('created_at', { ascending: false })
```

#### Query parameters (legacy)

None. No search, status, role filter.

Recommended V2: `page`, `pageSize` (default 10), `sort=createdAt:desc`, optional `q`, `roleId`.

#### Response fields consumed

| Field | Usage |
|---|---|
| `id` | React `key` |
| `name` | Name column; fallback `'—'` |
| `email` | Contact |
| `mobile` | Contact; fallback `'—'` |
| `role` | Badge fallback: `TH` → label “Super Admin”, else “Unassigned” |
| `roles.name` | Badge text; purple if `'Super Admin'`, else blue |
| `created_at` | Sort only (not shown) |
| `role_id` | Typed on interface; **not displayed** |

Unused typed fields: `role_id` in the table UI.

#### Pagination (**Verified** client)

`ITEMS_PER_PAGE = 10`. `totalPages = ceil(n/10) || 1`. Slice current page. Footer: “Showing x to y of n entries”.

#### Loading / empty / error

| State | UI |
|---|---|
| Loading | Spinner row, `colSpan=3` |
| Empty | “No users found.” |
| Error | Toast `Error loading users` + `error.message`; list stays empty |

#### Recommended response

```json
{
  "items": [
    {
      "id": "uuid",
      "name": "string|null",
      "email": "string|null",
      "mobile": "string|null",
      "legacyRole": "TH|CO",
      "roleId": "uuid|null",
      "roleName": "string|null",
      "createdAt": "ISO-8601"
    }
  ],
  "page": 1,
  "pageSize": 10,
  "total": 0
}
```

---

### 6.4 `GET /v2/roles?platform=Web,Both` — create-user dropdown

**Existing:** `roles.select('*').in('platform', ['Web','Both']).order('name')` — `AdminUserManagement.tsx` L59–63.

**Consumed:** `r.id` (value), `r.name` (label). Errors ignored (`if (data) setWebRoles`).

**AuthZ:** Super Admin UI only in practice.

---

### 6.5 `POST /v2/admin/users` — create web staff

**Existing:** `supabase.functions.invoke('create-se', { body, headers: { Authorization: Bearer session.access_token } })` then:

```text
profiles.update({ role_id: selectedRoleId }).eq('mobile', mobile.trim())
```

**Body sent today (`AdminUserManagement.tsx` L118–124):**

| Field | Required in UI | Sent | Notes |
|---|---|---|---|
| `name` | yes | trimmed | Full name |
| `mobile` | yes, exactly 10 digits | trimmed | Lookup key for `role_id` patch |
| `email` | no | trimmed (may be `""`) | Edge Function: required for non-SE (`create-se/index.ts` L28–31) |
| `password` | yes, minLength 6 | as typed | Temporary password; input `type="text"` |
| `role` | — | **always `'CO'`** | Comment: “legacy role for backward compatibility” |
| `roleId` | yes in UI (`selectedRoleId`) | **not in Edge body** | Applied in a second client update |

**Edge Function behavior (`create-se/index.ts`) — Verified:**

- Service-role `auth.admin.createUser`
- For `role === 'SE'`, auth email is `{mobile}@gmail.com`; for admin/CO, uses provided email
- `email_confirm: true`
- Metadata: `name`, `mobile`, `role`, `real_email`
- Returns `{ user, message }` or `{ error }` status 400

**Client success path:** toast “User Created!”, reset form, close dialog, `fetchUsers()`. The `role_id` update is **not** error-checked (**Partial**). Matching by mobile is ambiguous if mobiles are not unique (**Ambiguous**).

**Validation (frontend):** name, mobile, password, `selectedRoleId`; mobile 10 digits. Email optional in form but required by Edge Function for CO — empty email will fail at the function (**Verified** mismatch).

**Recommended V2 body:**

```json
{
  "name": "string",
  "mobile": "string",
  "email": "string",
  "temporaryPassword": "string",
  "roleId": "uuid",
  "legacyRole": "CO"
}
```

Perform auth user + profile + `role_id` **atomically** on the server. Do not require the client to patch by mobile.

**Permissions:** Restrict to Super Admin (or a dedicated `admin_users.can_edit`). Legacy has no server-side check visible in the React app; Edge Function does not inspect caller role in the snippet audited (**Inferred** gap).

---

### 6.6 Widgets requested by V2 that have **no** legacy Dashboard contract

Do **not** treat the following as existing Home APIs. If product adds them to V2 Home, reuse sibling-module summary designs and load them **independently** of `GET /v2/dashboard/summary`.

| Suggested endpoint | HTTP | Source of truth in legacy product | Dashboard today |
|---|---|---|---|
| `GET /v2/attendance/summary` | GET | Attendance module (client status engine) | **New V2** — see `docs/api-audit/attendance-api-requirements.md` §4.4 |
| `GET /v2/shifts/summary` | GET | Shifts `ACTIVE`/`COMPLETED` | **New V2** — `shifts-api-requirements.md` §4.6 |
| `GET /v2/territory-routes/summary` | GET | Routes / territory view | **New V2** |
| `GET /v2/territory-routes/maps/executives` | GET | Not on Home; GPS lives on Attendance timeline | **New V2** |
| `GET /v2/expenses/summary` | GET | Expenses list statuses | **New V2** — `expenses-api-requirements.md` §4.6 |
| `GET /v2/invoices/summary` | GET | Retail orders | **New V2** |
| `GET /v2/inventory/summary` | GET | Ledger only in admin | **New V2** — `retail-inventory-api-requirements.md` §5.3 |
| `GET /v2/executives/performance` | GET | **Not found** as ranking UI | **New V2** |
| `GET /v2/dashboard/alerts` | GET | **Not found** | **New V2** |
| `GET /v2/dashboard/activity` | GET | **Not found** | **New V2** |
| `GET /v2/dashboard/exports` | GET | **Not found** | **New V2** |

Formulas for those metrics **must not** be invented from Dashboard.tsx — it does not define them. Use the sibling audits or mark **Ambiguous** until product confirms.

---

## 7. Metric definitions and calculation formulas

All KPI math below is **Verified** as **frontend combination of server COUNT results**. The database is not asked for percentages, trends, or ratios. There is **no** `calculatedAt` timestamp.

### 7.1 `salesExecutives` (W1)

| Item | Definition |
|---|---|
| Formula | `COUNT(profiles)` where `role = 'SE'` |
| Numerator / denominator | Count only (not a rate) |
| Computed by | Supabase `count: 'exact'` |
| Exclusions | **None** in code: demo SEs included; no deleted flag; no active/inactive |
| Null / cancelled / holiday | N/A |
| Real-time vs snapshot | Live table count at request time; no snapshot table |
| Ambiguity | “Active SEs in territory” is **Hardcoded** card copy, **not** a filter. “Active” is **Ambiguous** (not `is_demo`, not shift-active, not employment status) |

**Duplicate elsewhere:** `SEsPage` lists the same unfiltered SE set. Attendance/Shifts/Expenses/Retail lookups use `is_demo = false` — **different population**.

### 7.2 `seProfilesComplete` (W2)

| Item | Definition |
|---|---|
| Formula | `COUNT(sales_executive)` where `is_profile_complete = true` |
| Computed by | Server count |
| Join to SE profiles | **Not performed** |
| Demo filter | **None** |
| Exclusions | Rows with `is_profile_complete` false or missing are simply not counted. No handling of missing `sales_executive` row (those SEs are incomplete on the SE page badge) |
| Ambiguity | Could include a complete row whose profile is not `role=SE` if such data existed (**Inferred** unlikely; PK is `profile_id`) |

**Duplicate:** `SETable` “Profile Status” uses `!!sales_executive.is_profile_complete` per **profile** row (left join semantics). A complete count on `sales_executive` vs complete count among `role=SE` profiles can diverge if orphans exist — **Ambiguous** without DB constraints beyond the migration PK.

Card description “Finished mobile onboarding” is **Hardcoded**; no extra onboarding-state column is read.

### 7.3 `distributors` / `dealers` / `farmers` (W3–W5)

| Item | Definition |
|---|---|
| Formula | `COUNT(submitted_table) + COUNT(drafts WHERE entity_type = X)` |
| Computed by | Two server counts, **added in the browser** |
| Status filter on submitted rows | **None** (migration default `status` on distributors/dealers/farmers is `'DRAFT'`, but Dashboard does not `.eq('status', …)`) |
| Deleted records | **Not found** (no `deleted_at` filter) |
| Double count | **Ambiguous:** if a submitted row also still has a `drafts` row, both increment the KPI. Admin frontend does not delete drafts on this page. Whether mobile removes drafts on submit is **outside this screen** |

**Duplicate:** Directory pages use the same submitted+drafts union. `SEDetailSheet` KPI bar counts **only** `dealers`/`farmers`/`distributors` **for one `se_id`**, **without drafts** — **different definition**.

### 7.4 `distributorsPending` / `dealersPending` / `farmersPending`

| Item | Definition |
|---|---|
| Formula | `COUNT(drafts WHERE entity_type = X)` |
| Displayed | **No** — only stored, then summed into W6 |

### 7.5 `totalDrafts` (W6)

| Item | Definition |
|---|---|
| Formula | `distributorsPending + dealersPending + farmersPending` |
| Computed by | Frontend |
| FPO drafts | **Excluded** |
| Description | “Drafts across all directories” is **Hardcoded** and **overstated** (not all directories) |

### 7.6 Metrics **not** defined on Dashboard

Attendance %, present/absent, shift completeness, route adherence, sales vs target, expense pending amount, ranking/tie-break, % change vs prior period — **Not found**. Do not copy formulas from Attendance/Expenses pages onto this audit as Dashboard requirements.

### 7.7 Zero, null, incomplete

| Case | Behavior |
|---|---|
| Count `null` | `\|\| 0` |
| Query error | Treated as 0 |
| Empty tables | Cards show `0` (same as error) |
| Incomplete KPI batch | Remaining zeros |
| Holidays / weekly offs | Not part of these counts |

---

## 8. Charts, maps, tables, and drill-down requirements

### 8.1 KPI cards (W1–W6) — presentation only

| Aspect | Legacy | Status |
|---|---|---|
| Chart series | None | **Not found** |
| Labels | Card `title` + `description` props | **Hardcoded** strings in `Dashboard.tsx` L96–101 |
| Units | Integer, no thousands separator, no currency, no `%` | **Verified** |
| Colors | Default `accent='primary'` → `bg-primary/10 text-primary`. W6 `accent='muted'` | **Verified** `KpiCard.tsx` L16–20, L101 |
| Status mappings | None | — |
| Icons | `UserCog`, `CheckCircle2`, `Truck`, `Users`, `Wheat`, `Clock` | Decorative |
| Responsive | `grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6` | **Verified** L95 |
| Hover | If `to` set: shadow + border + pointer | **Verified** |

### 8.2 Drill-down and navigation (**Partial**)

| Card | `to` | Behavior |
|---|---|---|
| Sales Executives | `/sales-executives` | Full page navigation; **does not** pass filters (demo, incomplete, etc.) |
| SE Profiles Complete | none | Not clickable |
| Distributors | `/distributors` | Directory; not prefiltered to drafts vs submitted |
| Dealers | `/dealers` | Same |
| Farmers | `/farmers` | Same |
| Total Drafts | none | Not clickable; cannot open a unified draft queue |

There is **no** dialog listing the rows behind a count. Deep-link query params are **Not found**.

Clicking a directory card does **not** check that module’s `can_view` first.

### 8.3 Team Management table (W7)

| Aspect | Legacy |
|---|---|
| Columns | Name, Contact Details (email + mobile), Assigned Role |
| Sort | Server `created_at desc` only; no column sort UI |
| Row click | None |
| Drill-down | None |
| Role badge colors | Super Admin: `bg-purple-100 text-purple-700`; else `bg-blue-100 text-blue-700` — **Hardcoded** CSS, not an API |
| Maps / charts | None |

### 8.4 Maps, charts, leaderboards, activity

**Not found** on `/dashboard`. Recharts primitives in `src/components/ui/chart.tsx` and maps on Attendance/Farmers/Routes are **not** imported by Dashboard.

---

## 9. Refresh, caching, polling, and performance requirements

| Concern | Legacy Dashboard | V2 recommendation |
|---|---|---|
| Initial load | Auth + perms (blocking full-screen spinner) then KPIs (cards already visible at 0) | Keep shell gate; show KPI skeletons so 0 ≠ loading |
| Parallelism | 8 count queries + 2 auth/perm queries | Collapse counts to one summary; keep `GET /v2/me` separate |
| Polling | **Not found** (`setInterval` / supabase `.channel` unused in `src`) | Not required for parity |
| Real-time | **Not found** | Not required for parity |
| React Query | Provider present; Dashboard unused | Optional |
| Stale data | Until remount | `meta.calculatedAt`; optional pull-to-refresh |
| Caching | Browser HTTP cache only if CDN; anon client no extra cache | Counts are cheap; cache 15–60s if needed |
| Expensive analytics | **Not present** on this page | If V2 adds charts, **do not** block W1–W6 on them; pre-aggregate / async jobs |
| Widget isolation | One `Promise.all` for all KPIs; Team Management independent | Keep Team Management independent; optionally split draft vs submitted only if product needs |
| N+1 | Not on KPIs. Create-user: 3 sequential calls | Atomic `POST /v2/admin/users` |
| Farmer volume | Directory page chunks 1000 rows; Dashboard uses HEAD count | Keep COUNT on server |
| Token refresh | `autoRefreshToken: true`, session in `localStorage` | Standard |

**One widget failure vs whole page:** Team Management errors do not unmount KPIs (**Verified** separate component). A thrown `Promise.all` in KPI fetch would leave all cards at 0 together. V2 should return partial summary with per-metric errors rather than failing the whole Home.

---

## 10. Permissions and data-scoping rules

### 10.1 Module flag `dashboard`

| Rule | Detail | Status |
|---|---|---|
| Roles UI | Web module “Dashboard Overview”, `can_view` / `can_edit` | **Verified** `RolesPage.tsx` L15 |
| Page check | `can_view` only | **Verified** |
| `can_edit` | Never read on Dashboard (cannot be used to hide Team Management) | **Verified** |
| Sidebar | Dashboard **always** shown (`AppSidebar.tsx` L71–73), ignoring `can_view` | **Verified** |
| Super Admin / TH bypass | Full perms without `role_permissions` rows | **Verified** |
| `user_permissions` table | Used only by unused `PermissionEditor`; that editor’s module list **omits** `dashboard` | **Verified** dead path |

Access Denied copy (**Hardcoded**): “You do not have permission to view the Dashboard Overview.”

### 10.2 Super Admin vs TH (inconsistent)

| Check | Rule | Effect |
|---|---|---|
| `usePermissions` god-mode | `role === 'TH'` **OR** name Super Admin | Sees KPI page (if they pass layout) |
| Team Management + Settings nav | `role === 'Super Admin'` **only** (dynamic name) | Legacy `TH` **without** that role name **does not** see W7 |
| Layout web allow | Not Mobile and not `role === 'SE'` | TH with platform Both/Web allowed |

### 10.3 Data visibility / tenancy

| Rule | Legacy |
|---|---|
| Organization scope | **Not found** |
| Territory / team scope | **Not found** |
| RLS | Early policies allow all authenticated users full CRUD on counted tables |
| Demo SE | Included in W1 |
| Cross-module | KPI fetch does **not** require `sales_executives` / `distributors` / `dealers` / `farmers` view permission |

**Recommended V2:** enforce tenant + role scope in the API. Decide whether counts should match operational reports (`includeDemo=false`) or the SE directory (include demo).

### 10.4 Team Management AuthZ

| Action | Legacy UI gate | Server (from this repo) |
|---|---|---|
| List TH/CO | Super Admin role name | RLS open; function not used |
| Create user | Same | Edge Function; **no caller-role check in audited code** |
| Assign `role_id` | Same | Direct `profiles` update |

---

## 11. Cross-module API dependencies

| Dependency | Relationship to Dashboard | Shared endpoint candidate |
|---|---|---|
| Auth / profiles / roles | Shell + gate + W7 | `GET /v2/me`, `GET /v2/roles` |
| Sales executives directory | W1 navigation; same SE population | `GET /v2/executives` |
| `sales_executive.is_profile_complete` | W2 | include on executives resource |
| Distributors / dealers / farmers directories | W3–W5 navigation + same draft union | directory list APIs in those modules |
| `drafts` | W3–W6 | `entity_type` discriminator |
| `create-se` Edge Function | W7 create **and** SEsPage create (role `SE` vs `CO`) | `POST /v2/admin/users` vs `POST /v2/executives` — **do not** overload one function without an explicit `legacyRole` |
| Attendance / Shifts / Routes / Expenses / Retail | **No runtime dependency** from Dashboard.tsx | Optional Home widgets → those modules’ `/summary` APIs |
| FPOs | Not on Home; drafts use `entity_type='fpo'` | Optional |
| `SEDetailSheet` per-SE dealer/farmer/distributor counts | Similar names, **different** formula (no drafts, scoped `se_id`) | Do not reuse Dashboard totals |
| React Query | App-level only | Unused |

Sibling audits already proposed dashboard-oriented summaries that **this page does not call**:

- `GET /v2/attendance/summary`
- `GET /v2/shifts/summary`
- `GET /v2/expenses/summary`
- `GET /v2/inventory/summary`

---

## 12. Mocked, hardcoded, missing, or ambiguous behavior

### 12.1 Hardcoded (presentation, not API)

- Page title “Overview” and subtitle “Live command center across sales executives, distributors, dealers, and farmers.” (`Dashboard.tsx` L88–91) — “Live” is marketing copy; data is a one-shot fetch.
- KPI titles and descriptions, including “Active SEs in territory”.
- Login card: “Territory Head Dashboard Login” (`LoginPage.tsx` L53).
- Brand “Field Commander Admin”.
- Team badge color classes.
- Create-user `role: 'CO'`.
- Page size 10.
- Access Denied / Mobile App Only strings.

### 12.2 Mocked

**Not found.** KPI and team data come from live Supabase queries. No dashboard fixtures.

### 12.3 Missing vs V2 product ask

Everything in §2.4 (attendance, shifts, routes, maps, retail, expenses, performance, alerts, date filters, export, polling). Also: FPO on Home; per-entity draft cards; KPI loading/error; click-through for W2/W6; staff edit/delete; organization/team/territory scoping; `dashboard.can_edit` behavior; aligning sidebar with `can_view`.

### 12.4 Partial

- Drill-down = route change, not a list of counted entities.
- KPI fetch has no error surface.
- `role_id` update after create not verified.
- Email optional in form vs required in Edge Function for CO.
- Sidebar comment claims `user_permissions`; runtime uses `role_permissions`.

### 12.5 Ambiguous (do not invent)

- Whether submitted directory rows can coexist with `drafts` (double count).
- Whether `sales_executive` complete count can exceed SE profile count.
- Meaning of “Active” in W1 copy.
- Tenant / multi-company (no org id on queries).
- Whether TH without dynamic name Super Admin is intended to manage users (UI says no).
- Uniqueness of `profiles.mobile` for the post-create update.
- `profiles.role` allowed values: migration CHECK was `SE|TH`; UI also uses `CO` — schema drift.
- Timezone for any **future** period metrics (not used on this page).
- Ranking / tie-break / target achievement — **no code**.
- Whether V2 Home should include module summaries already specified as **New V2** on those modules.

### 12.6 Frontend-only vs backend responsibility

| Logic | Owner today | V2 |
|---|---|---|
| Add submitted + draft counts | Frontend | Prefer server `total` to keep one definition |
| Sum three draft types | Frontend | Server `drafts.total` |
| Pagination of staff | Frontend | Server pagination |
| Role badge fallback TH → “Super Admin” | Frontend | Server should return display `roleName` |
| God-mode | Frontend interpretation of TH / Super Admin | Server AuthZ |
| KPI descriptions | Frontend | Copy, not API |

---

## 13. Recommended V2 dashboard API composition

### 13.1 What the legacy frontend expects

**Hybrid, not a single mega-endpoint:**

1. **Session/profile/permissions** already loaded by the shell (`GET /v2/me`).
2. **One cheap census** for W1–W6 (today eight counts — wrap as `GET /v2/dashboard/summary`).
3. **Independent** Super Admin resources: `GET /v2/admin/users`, `GET /v2/roles`, `POST /v2/admin/users`.

There is **no** evidence the frontend expects widget-specific analytics endpoints on Home.

### 13.2 Independent vs shared

| Payload | Independent? | Shared filters? |
|---|---|---|
| `GET /v2/me` | Yes (app-wide) | n/a |
| KPI summary | One resource; all six cards share it | None today |
| Team list / create | Yes — must not block KPIs | None |
| Future attendance/shift/… widgets | **Should be independent** | Would share a **New V2** global filter bar (`from`/`to`/territory/team/executive/`includeDemo`) |

### 13.3 Failure isolation

- **Verified need:** W7 already isolated.
- **Gap:** W1–W6 fail as a group.
- **Recommend:** `200` summary with nullable metrics + `errors[]` per key, or HTTP 207-style partial. Never block Team Management or `GET /v2/me` on analytics.

### 13.4 Avoid excessive chatty calls **and** a blocking blob

```text
Parallel on Home:
  GET /v2/me                         (if not already cached)
  GET /v2/dashboard/summary          (W1–W6)
  GET /v2/admin/users?page=1         (only Super Admin)
  GET /v2/roles?platform=Web,Both    (only when create dialog needs it — can lazy-load)

Do NOT bundle:
  attendance/shifts/routes/expenses/retail analytics
  into GET /v2/dashboard/summary
```

If product later adds those widgets, each should have its own endpoint (already sketched in sibling audits) so a slow GPS/sales aggregation cannot stall directory counts.

### 13.5 Pre-aggregation

Current KPIs are simple `COUNT`s — **no** pre-aggregation required. Pre-aggregation, caching, or async jobs apply only to **New V2** analytics (trends, maps, leaderboards).

### 13.6 Suggested OpenAPI grouping

| Tag | Endpoints |
|---|---|
| Auth | `GET /v2/me` |
| Dashboard | `GET /v2/dashboard/summary` |
| Admin users | `GET/POST /v2/admin/users` |
| Roles | `GET /v2/roles` |
| Optional Home | `GET /v2/dashboard/config` (**New V2**) |
| Optional widgets | module `/summary` APIs (**New V2**, not parity) |

---

## 14. V2 API coverage checklist

Use this list against OpenAPI / Postman. Check an item only when the spec matches **legacy Home** or an explicitly accepted **New V2** delta.

### 14.1 Initialization and shell

- [ ] `GET /v2/me` returns `id`, `legacyRole`, `roleName`, `platform`
- [ ] `GET /v2/me` returns `permissions.dashboard.canView` and `canEdit`
- [ ] God-mode: `legacyRole=TH` **or** `roleName=Super Admin` grants all module flags (legacy) — **or** documented replacement
- [ ] Missing `roleId` + not god-mode ⇒ `dashboard.canView=false`
- [ ] `platform=Mobile` or `legacyRole=SE` denied on web (`403` / equivalent)
- [ ] Unauthenticated access to dashboard APIs rejected
- [ ] Session refresh behavior documented (legacy: Supabase `autoRefreshToken`)

### 14.2 Access control on Home

- [ ] `GET /v2/dashboard/summary` requires `dashboard.canView`
- [ ] Summary is **not** executed for users who fail the gate (fixes legacy leak)
- [ ] Sidebar/nav hiding of Dashboard follows `canView` (**New V2** if changing legacy always-visible nav)
- [ ] `dashboard.canEdit` semantics defined (legacy: unused) or omitted
- [ ] Team Management gated on `roleName === 'Super Admin'` **or** documented replacement (`TH` currently excluded)

### 14.3 `GET /v2/dashboard/summary` — response fields (parity)

- [ ] `salesExecutives` = `COUNT(profiles WHERE role='SE')` including demo, no territory filter
- [ ] `seProfilesComplete` = `COUNT(sales_executive WHERE is_profile_complete=true)` without role join
- [ ] `distributors.submitted` = `COUNT(distributors)` with **no** status filter
- [ ] `distributors.drafts` = `COUNT(drafts WHERE entity_type='distributor')`
- [ ] `distributors.total` = submitted + drafts (server-side preferred)
- [ ] Same triplet for `dealers` / `entity_type='dealer'`
- [ ] Same triplet for `farmers` / `entity_type='farmer'`
- [ ] `drafts.total` = distributor + dealer + farmer draft counts (**excludes FPO**)
- [ ] No required query params for parity (all-time, global)
- [ ] Integer JSON numbers (not strings); null → 0 documented
- [ ] HEAD/`COUNT` implementation (not 1000-row page loops)
- [ ] `meta.calculatedAt` (**New V2** recommended)
- [ ] Partial error object if one source table fails (**New V2** recommended)

### 14.4 KPI presentation parity (frontend contract)

- [ ] Six cards: Sales Executives, SE Profiles Complete, Distributors, Dealers, Farmers, Total Drafts
- [ ] W1 navigates to executives directory with **no** filter query
- [ ] W3/W4/W5 navigate to distributor/dealer/farmer directories with **no** filter query
- [ ] W2 and W6 not required to be links
- [ ] Pending-per-entity not required on cards (legacy hidden)
- [ ] No charts/maps/units/% on these cards
- [ ] Responsive 1/2/3 column grid acceptable
- [ ] Loading vs empty vs error distinguishable (**New V2** if improving on zeros)

### 14.5 Team Management — `GET /v2/admin/users`

- [ ] Filter `legacyRole ∈ {TH, CO}` (not SEs)
- [ ] Join/display `roleName` from roles
- [ ] Fields: `id`, `name`, `email`, `mobile`, `legacyRole`, `roleName`, `createdAt`
- [ ] Default sort `createdAt desc`
- [ ] Pagination page size 10 (or compatible)
- [ ] Empty list vs error documented
- [ ] Not returned to non–Super Admin (recommended; legacy was UI-only)

### 14.6 Roles dropdown — `GET /v2/roles`

- [ ] `platform ∈ {Web, Both}`
- [ ] Ordered by `name`
- [ ] Items expose `id` and `name`

### 14.7 Create user — `POST /v2/admin/users`

- [ ] Required: name, mobile (10 digits), password (min 6), `roleId`
- [ ] Email required for CO/admin (match Edge Function, not the optional form)
- [ ] Creates auth user with `email_confirm=true`
- [ ] Sets `profiles.role` / legacy role `CO` for web staff
- [ ] Sets `profiles.role_id` **atomically** (do not patch by mobile)
- [ ] Does not use `{mobile}@gmail.com` auth email for CO (that path is SE-only)
- [ ] Authorization: Super Admin (or explicit permission); reject others
- [ ] Error payload surfaceable as toast (`error.message`)
- [ ] No edit/delete required for **parity**

### 14.8 Filters / analytics **not** required for parity

- [ ] Date range, comparison period, timezone param — **absent** on summary (parity) **or** added as **New V2**
- [ ] Territory / team / executive filters — not required
- [ ] `includeDemo=false` — **not** legacy Dashboard behavior (would be a **breaking** change)
- [ ] Export dashboard — not required
- [ ] Polling / websocket — not required
- [ ] Widget config API — not required for parity

### 14.9 Explicitly **New V2** Home widgets (opt-in; not parity)

Check these only if product adds them to Home. Definitions live in sibling audits unless marked Ambiguous.

- [ ] Attendance summary cards + drill-down lists (`GET /v2/attendance/summary` + list)
- [ ] Leave / holiday / week-off (Ambiguous / new vs Attendance module)
- [ ] Shift active/completed/missed/incomplete (`GET /v2/shifts/summary`)
- [ ] Currently active / in-field executives
- [ ] Late punch-in / missing punch-out exceptions
- [ ] Route assigned/completed/pending/missed + adherence
- [ ] Planned vs actual visits
- [ ] Executive map markers
- [ ] Recent punched / field activity feed
- [ ] Orders / invoices / sales / collections / targets
- [ ] Retailer/outlet visit KPIs
- [ ] Product/category performance
- [ ] Stock summary + low-stock
- [ ] Stock assigned to executives
- [ ] Sales/invoice trend chart
- [ ] Expense status counts + pending amount + TA/DA
- [ ] Expense trend + drill-down
- [ ] Executive totals active/inactive
- [ ] Top/low performers + ranking/tie-break (Ambiguous — no legacy rule)
- [ ] Team/territory comparison
- [ ] Alerts + unread + acknowledge
- [ ] Audit/activity feed
- [ ] D/W/M/Q/custom range + previous-period % change
- [ ] Chart zero/missing-data policy
- [ ] Dashboard export
- [ ] FPO count / FPO drafts on Home
- [ ] Organization/company context
- [ ] Role-specific widget layout API

### 14.10 Cross-cutting contract tests

- [ ] OpenAPI documents whether demo SEs are included in `salesExecutives`
- [ ] OpenAPI documents draft+submitted addition and FPO exclusion
- [ ] OpenAPI documents that directory `status` is **not** filtered
- [ ] Postman: summary does not require date params
- [ ] Postman: independent 401/403 for summary vs admin users
- [ ] Postman: create user does not leave `role_id` null
- [ ] Spec does **not** claim charts/maps exist on legacy Home
- [ ] Spec does **not** treat Attendance/Retail/Expenses page metrics as Dashboard fields unless explicitly added

---

## 15. Questions requiring product / backend confirmation

1. **Scope of V2 Home:** Preserve the six directory KPIs only, or also mount the field-ops widgets listed in the original V2 ask? Legacy will not “lose” attendance/sales cards — they were never here.
2. **Demo SEs:** Should Home match the SE directory (include demo) or operational reports (exclude)? Changing this is a **breaking** KPI change.
3. **“Active SEs in territory”:** Implement real territory + active-employment filters, or keep global `role=SE` count and fix the copy?
4. **`seProfilesComplete`:** Count complete `sales_executive` rows, or complete flags among `role=SE` profiles (aligned with `SETable`)?
5. **Draft double-counting:** What is the source-of-truth lifecycle of `drafts` vs submitted tables? Should `total` be `COUNT(DISTINCT entity)`?
6. **Submitted `status`:** Ignore status (legacy) or exclude cancelled/deleted/DRAFT rows still sitting in main tables?
7. **FPO:** Add FPO submitted+draft counts to Home / Total Drafts?
8. **Per-entity pending:** Surface the already-fetched pending counts (W6 split) or keep a single Total Drafts card?
9. **W2/W6 drill-down:** Add filtered directory links (complete SEs; draft-only queues)?
10. **Tenancy:** Will V2 introduce organization/territory RLS? Legacy counts are global to the project.
11. **TH vs Super Admin:** Should Territory Heads see Team Management? Legacy dynamic-name check says no; RBAC god-mode still opens the KPI page.
12. **`dashboard.can_edit`:** Bind to Team Management, widget config, or drop from the matrix?
13. **Sidebar:** Keep Dashboard always visible, or hide without `can_view`?
14. **Create-user AuthZ:** Edge Function currently has no visible caller-role check in this repo — confirm server-side Super Admin enforcement.
15. **Email required:** Align UI with Edge Function (required for CO) vs allow mobile-only admin accounts.
16. **Staff lifecycle:** Need edit, disable, reset password, delete? None on legacy Home.
17. **Loading/error UX:** Accept zeros-as-empty, or require skeletons and per-metric errors?
18. **New analytics:** If added, confirm independent endpoints + shared filter bar, and that failure of those widgets must not block directory KPIs.
19. **Timezone / reporting day:** Only needed if period metrics are added; suggest `Asia/Kolkata` given other modules’ TZ hazards — **not** defined on this page.
20. **Ranking / targets / adherence formulas:** No Dashboard code exists. Confirm numerators, denominators, exclusions (holidays, weekly offs, cancelled orders, incomplete shifts) in those modules before putting them on Home.

---

*End of audit. This document describes `/dashboard` as implemented in the legacy FieldCommander Admin Dashboard frontend. Module pages that are not mounted on Home are cited only as navigation targets or as **New V2** candidates, not as existing Dashboard widgets.*
