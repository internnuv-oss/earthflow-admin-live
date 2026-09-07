# Field Commander Admin — Module Inventory

> **Phase 0 discovery document.** Source of truth: this repository’s implementation.  
> Do not treat this as final business-rule extraction. Items that could not be confirmed from code are marked **UNCONFIRMED / NEEDS FURTHER INVESTIGATION**.

---

## Project Overview

### What this application appears to do

**Field Commander Admin** is a web admin dashboard for an agricultural field-operations / agri-dealer network. It lets back-office users (Territory Heads / Super Admins / configurable web roles) manage:

- Field staff (**Sales Executives / SE**)
- Channel partners (**Distributors**, **Dealers**, **FPOs**)
- End customers (**Farmers**) and related field artifacts (**Farm Cards**, **FSPP** evaluation, **Farm Diary** / crop observations)
- Territory planning (**Routes**, **Location Master**)
- Field operations (**Shifts**, **Attendance**, **Expenses**)
- Product / SOP configuration (**Farm Diary Masters**)
- Retail stock (**Item Master**, inventory ledgers, retail orders)
- Role-based access for both **Web** and companion **Mobile** platforms

The product name in the UI is **Field Commander Admin**. The repository folder name is `earthflow-admin-live`; README identifies a Lovable-origin Vite project.

### Primary users / roles

Confirmed from code:

| Actor | Evidence |
|---|---|
| **Super Admin** | Dynamic role name; bypasses RBAC; sees Settings; admin user management |
| **TH (Territory Head)** | Legacy `profiles.role`; treated as admin bypass (`usePermissions`); login copy says “Territory Head Dashboard” |
| **CO** | Listed with TH when fetching admin web users (`AdminUserManagement`) |
| **SE (Sales Executive)** | Field role; mobile-oriented; created via edge function; excluded from web admin nav as a primary persona |
| **Configurable roles** | Rows in `roles` with `platform` = `Web` / `Mobile` / `Both` and `role_permissions` |

Mobile end-users (SE using the field app) are **not implemented in this repo**; this admin app configures their roles/permissions and reviews data they submit.

### High-level business purpose

Support GLS / biofertilizer field go-to-market: onboard and score channel partners and farmers, assign SE territories, track farm plots (cards/diaries/SOP visits), approve FSPP-related farm cards, manage attendance/expenses, and operate light retail inventory for SEs.

---

## Technology & Architecture

Only what is confirmed from the repository:

| Area | Confirmed stack |
|---|---|
| **App type** | SPA (Single Page Application) admin frontend |
| **Language** | TypeScript |
| **UI framework** | React 18 |
| **Build tool** | Vite 5 (`@vitejs/plugin-react-swc`) |
| **Routing** | `react-router-dom` v6 |
| **Styling** | Tailwind CSS 3 + shadcn/ui (Radix primitives) + `class-variance-authority` / `tailwind-merge` |
| **Forms / validation** | `react-hook-form`, `zod`, `@hookform/resolvers` (present in deps; usage is page-local, not a global form layer) |
| **Server state** | Direct Supabase client calls from pages/components; `@tanstack/react-query` is wired in `App.tsx` but **most pages fetch with `useEffect` + local state** rather than query hooks |
| **Client state** | React component state + auth/permission hooks (`useAuth`, `usePermissions`) |
| **Backend / DB** | **Supabase** (Postgres + Auth + Edge Functions). Client: `@supabase/supabase-js` |
| **Auth** | Supabase Auth email/password; session in `localStorage` |
| **Edge functions** | Deno functions under `supabase/functions/`: `create-se`, `auto-translate-parameter` |
| **Maps** | Google Maps (`@react-google-maps/api`, `VITE_GOOGLE_MAPS_API_KEY`); Leaflet packages are also present |
| **File / media** | Cloudinary uploads (`VITE_CLOUDINARY_*`) |
| **Exports** | Client-side CSV / HTML print patterns; `jspdf` / `jspdf-autotable` present in deps |
| **Charts** | `recharts` present |
| **Hosting config** | `vercel.json` SPA rewrite to `index.html` |
| **Package managers** | Both `package-lock.json` (npm) and `bun.lock` / `bun.lockb` present |
| **Tests** | Vitest + Testing Library (minimal example test only) |
| **Env vars (names only)** | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_PROJECT_ID`, `VITE_GOOGLE_MAPS_API_KEY`, `VITE_CLOUDINARY_CLOUD_NAME`, `VITE_CLOUDINARY_UPLOAD_PRESET`, `GEMINI_API_KEY` |

### Architecture shape

```
Browser (React SPA)
  └── Supabase JS client
        ├── Auth
        ├── Postgres tables (via PostgREST)
        └── Edge Functions (create-se, auto-translate-parameter)
              └── Gemini (translations) / Admin Auth API (user create)
```

- **No separate Node/Express API** in this repo.
- **Business logic lives primarily in page/component TypeScript**, with some rules in edge functions and (likely) more on the mobile app / DB that are **not fully present here**.
- Generated Supabase `types.ts` in-repo is a **broken stub** (“Need to install…”) — full typed schema is **UNCONFIRMED** from that file. Schema must be inferred from `.from('…')` usage, the single checked-in migration, and UI payloads.
- Only **one** SQL migration is checked in (`profiles`, `sales_executive`, `distributors`, `dealers`, `farmers` + RLS). Many tables used by the app are **not defined in local migrations** → schema evolution likely managed remotely in Supabase (**NEEDS FURTHER INVESTIGATION** for complete DDL).

### Important entry points

| Path | Role |
|---|---|
| `src/main.tsx` | React bootstrap |
| `src/App.tsx` | Providers + top-level routes (`/login`, `/*`) |
| `src/pages/Index.tsx` | Authenticated route table for all modules |
| `src/components/AppSidebar.tsx` | Nav + module permission keys |
| `src/hooks/useAuth.ts` | Session + role resolution |
| `src/hooks/usePermissions.ts` | Module `can_view` / `can_edit` |
| `src/integrations/supabase/client.ts` | Supabase client |
| `supabase/functions/*` | Server-side privileged workflows |

### Folder structure (high level)

```
src/
  pages/           # Feature screens (primary business UI)
  components/      # Feature sheets/tables + shared UI
  components/ui/   # shadcn primitives
  hooks/           # useAuth, usePermissions, toast, mobile
  integrations/supabase/
  lib/             # utils, jsonViewer
supabase/
  functions/       # Edge functions
  migrations/      # Partial schema only
```

### Mock data

No dedicated mock-data layer found. Some **hardcoded defaults** exist (e.g. scoring tier copy in Settings/Dealer sheets, application type list in Farm Diary Masters). Live data is loaded from Supabase.

---

## Module Inventory

Modules below are derived from **routes + permission keys + data entities + workflows**, not sidebar labels alone. Mobile permission modules are listed separately because this repo does not contain the mobile app implementation.

### Web / Admin modules (implemented in this repo)

| # | Module | Purpose | Main Screens | Main Entities | Dependencies |
|---|---|---|---|---|---|
| 1 | **Dashboard & Admin Users** | KPI overview of SE / distributor / dealer / farmer counts; Super Admin can create web users | `Dashboard.tsx`, `AdminUserManagement.tsx` | `profiles`, `sales_executive`, `distributors`, `dealers`, `farmers`, `drafts`, `roles` | Roles, Sales Executives, channel & farmer directories |
| 2 | **Roles & Access** | Define roles, platform (Web/Mobile/Both), and per-module view/edit permissions | `RolesPage.tsx`, `PermissionEditor.tsx` | `roles`, `role_permissions`, `user_permissions` | All modules (gates access) |
| 3 | **Sales Executives** | Create/list SE accounts; view profile completeness; demo flag; link to counts of dealers/farmers/distributors | `SEsPage.tsx`, `SETable.tsx`, `SEDetailSheet.tsx` | `profiles` (role=`SE`), `sales_executive`, `roles` | Auth edge function `create-se`; feeds nearly all field modules |
| 4 | **Distributors** | Directory of distributor onboardings (submitted + drafts); detail view/export | `DistributorsPage.tsx`, `DistributorTable.tsx`, `DistributorDetailSheet.tsx` | `distributors`, `drafts` (`entity_type=distributor`), `profiles` | SE; Settings scoring templates (UI) |
| 5 | **Dealers** | Directory of dealer onboardings; scoring/category; admin edit of draft/submitted; document upload | `DealersPage.tsx`, `DealerTable.tsx`, `DealerDetailSheet.tsx` | `dealers`, `drafts`, scoring/commitments JSON | SE; Farmers (optional links); Settings dealer template |
| 6 | **Farmers** | Farmer directory (table + map); admin profile edit; view FSPP, Farm Cards, Farm Diaries | `FarmersPage.tsx`, `FarmerTable.tsx`, `FarmerDetailSheet.tsx`, `FarmerMapView.tsx` | `farmers`, `drafts`, `farm_cards`, `farm_diary`, `crop_observation_sessions`, `routes` | SE; Dealers; Location/Routes; FSPP; Farm Diary Masters |
| 7 | **FPOs** | FPO directory (submitted + drafts); detail edit | `FposPage.tsx`, `FpoTable.tsx`, `FpoDetailSheet.tsx` | `fpos`, `drafts` | SE |
| 8 | **Territory Routes** | Assign geographic routes (district/taluka/village) to SEs; territory analytics; polygon map of farm cards/diaries | `RoutesPage.tsx`, `RouteBuilderDialog.tsx`, `TerritoryViewSheet.tsx`, `SERoutesSheet.tsx`, `PolygonMap.tsx` | `routes`, `profiles`, `farmers`, `drafts`, `farm_cards`, `farm_diary`, `temp_dealers`, `mandatory_base_visits` | Location Master; SE; Farmers; Farm Cards/Diaries |
| 9 | **Attendance** | Weekly attendance grid from shifts; status rules; timeline map of SE day activity | `AttendancePage.tsx`, `AttendanceTimelineSheet.tsx` | `shifts`, `shift_locations`, `routes`, `farmers`, `farm_cards` | Shifts; SE; Routes; Farmers |
| 10 | **Expenses** | Review/approve SE expenses; TA/DA recalculation; CSV & payout exports | `ExpensesPage.tsx`, `ExpenseActionSheet.tsx` | `expenses`, `shifts`, `profiles` | Shifts; SE |
| 11 | **Location Master** | CRUD hierarchy: District → Taluka → Village | `LocationMasterPage.tsx` | `districts`, `talukas`, `villages` | Used by Routes, Farmers, Route Builder |
| 12 | **Shifts** | View/create/edit SE shifts (times, odometer, vehicle type, status) | `ShiftsPage.tsx` | `shifts`, `profiles` | SE; feeds Attendance & Expenses |
| 13 | **Farm Diary Masters** | Configure crops, stages, UOMs, parameters, GLS products, SOP groups, stage applications & observation parameters | `FarmDiaryMasters.tsx` | `master_*`, `sop_*`, `parameter_uom_mapping`, `dynamic_translations` (via edge fn) | Consumed by Farm Diary operations & farmer detail observations |
| 14 | **FSPP Approvals** | Approve/reject Farm Cards’ `fspp_approval_status` using farmer FSPP category/land filters | `FsppApprovals.tsx` (+ opens `FarmerDetailSheet`) | `farm_cards`, `farmers` (`fspp_details`), `profiles` | Farmers; Farm Cards |
| 15 | **Farm Diary (operations)** | Browse farm diaries; forecast upcoming SOP stages; inspect observation sessions | `FarmDiaryPage.tsx` | `farm_diary`, `crop_observation_sessions`, `plant_sample_sets`, `sample_parameter_values`, SOP masters | Farm Diary Masters; Farmers; SE |
| 16 | **Retail & Inventory** | Item master CRUD; stock transfer IN to SE; ledger; retail order audit | `RetailAdminPage.tsx` | `item_master`, `inventory_transactions`, `retail_orders`, `profiles` | SE |
| 17 | **Onboarding Settings (Templates)** | Configure scoring tiers, commitments, annexures for dealer/farmer/distributor onboarding (**Super Admin only** in nav) | `SettingsTemplatePage.tsx`, legacy `SettingsPage.tsx` | Intended `form_templates` — **persist TODO in code** | Dealers / Farmers / Distributors scoring UX |

### Mobile permission modules (referenced only)

Configured in `RolesPage` `MOBILE_MODULES` for the companion mobile app. **Implementation of these modules is not in this repository.**

| Key | Label (from code) |
|---|---|
| `mobile_distributor` | Distributor Module |
| `mobile_dealer` | Dealer Module |
| `mobile_farmer` | Farmer Module (Includes Farm Card, Diary, FSPP, etc.) |
| `mobile_farmer_onboard` | Farmer Onboarding (Profiles & General Visits Only) |
| `mobile_fpo` | FPO Module |
| `mobile_travel_activity` | Executive Travel Activity (Attendance, Reports, Expenses) |
| `mobile_retail` | Retail & Inventory |

### Permission / route keys (web)

From `AppSidebar` / `RolesPage` / `PermissionEditor`:

`dashboard`, `role_management` (sidebar only — **not** in `WEB_MODULES` list), `sales_executives`, `distributors`, `dealers`, `farmers`, `fpos`, `routes`, `attendance`, `expenses`, `locations`, `shifts`, `farm_diary_masters`, `fspp_approvals`, `retail`, `farm_diary_approvals`

**Note:** `FarmDiaryPage` currently checks permission key `farm_diary_masters` while the nav module key is `farm_diary_approvals` — inconsistency **NEEDS FURTHER INVESTIGATION**.

---

## Module Relationships

Relationships supported by code (FKs, joins, or explicit UI navigation):

### Channel & farmer hierarchy

```
Sales Executive (profiles role=SE)
├── Distributors (distributors.se_id / drafts)
├── Dealers (dealers.se_id / drafts)
│     └── Farmers (farmers.dealer_id) [optional link]
├── Farmers (farmers.se_id / drafts)
│     ├── FSPP details (farmers.fspp_details JSON)
│     ├── Farm Cards (farm_cards.farmer_id, se_id)
│     │     └── FSPP approval status (farm_cards.fspp_approval_status)
│     └── Farm Diaries (farm_diary.farmer_id)
│           ├── Mandatory base visits (mandatory_base_visits)
│           └── Crop observation sessions
│                 ├── Plant sample sets
│                 └── Sample parameter values → master_parameters / master_uom
└── FPOs (fpos / drafts)
```

### Territory geography

```
Location Master
  District → Taluka → Village
        ↓
Territory Routes (routes.locations JSON with villages)
        ↓
SE assignment (routes.se_id)
        ↓
Farmer village ↔ route name mapping (FarmersPage)
Attendance timeline / territory analytics (villages, polygons)
```

### Field day operations

```
Shifts (SE punch in/out, odometer, vehicle)
├── Attendance (derived status rules from shift duration / logout time)
├── Expenses (often linked via shift_id; TA/DA uses distance × rate)
└── shift_locations (GPS trail for timeline)
```

### Farm Diary configuration → execution

```
Farm Diary Masters
  master_crops / stages / uom / parameters / gls_products
  sop_groups → sop_crop_stages → sop_applications + sop_parameters
        ↓
Farm Diary operations + FarmerDetailSheet observations
  (upcoming stage forecast uses sowing_date + DAS from SOP applications)
```

### Retail

```
item_master
  └── inventory_transactions (IN to SE / OUT sold)
retail_orders (sales to farmers, audited in admin)
```

### Auth / access

```
Supabase Auth user
  └── profiles (legacy role SE|TH|CO + role_id)
        ├── roles (name, platform)
        ├── role_permissions (module can_view/can_edit)
        └── user_permissions (per-user overrides — UI exists; runtime path primarily role_permissions)
```

---

## User Roles

### Legacy profile roles (`profiles.role`)

Confirmed check / usage:

| Value | Usage |
|---|---|
| `SE` | Sales Executive; mobile field user; filtered throughout admin lists |
| `TH` | Territory Head; admin bypass in `usePermissions`; login persona |
| `CO` | Fetched with TH in Admin User Management as web staff |

Migration originally constrained `role IN ('SE','TH')`; `CO` appears in later app code → full DB constraint state **NEEDS FURTHER INVESTIGATION**.

### Dynamic roles (`roles` table)

- Free-form `name` (e.g. **Super Admin** referenced in code)
- `platform`: `Web` | `Mobile` | `Both`
- Permissions via `role_permissions`

### Permission model

- **`can_view` / `can_edit`** per module
- **Bypass:** `profiles.role === 'TH'` **or** linked role name `Super Admin` → full access
- **Settings** nav: only if `role === 'Super Admin'`
- **Dashboard** nav item always shown in sidebar filter (but page still checks `dashboard` permission)

### Dual permission tables

- Runtime gating: `role_permissions` (`usePermissions`)
- `PermissionEditor` still upserts `user_permissions`
- Sidebar comment mentions `user_permissions` but hook uses role-based perms → **NEEDS FURTHER INVESTIGATION** which table is authoritative in production

---

## Shared Infrastructure

| Concern | Implementation in this repo |
|---|---|
| **Authentication** | Supabase Auth email/password (`LoginPage`); SE synthetic email `{mobile}@gmail.com` via `create-se`; session persistence |
| **Authorization** | `usePermissions` + per-page guards; Super Admin / TH bypass |
| **User provisioning** | Edge function `create-se` (also used for admin users); AdminUserManagement / SEsPage |
| **Notifications** | Toast / Sonner only (no push/email notification module found) |
| **File / documents** | Cloudinary upload (dealer docs, GLS product images); some `pdf_url` fields on entities |
| **Maps** | Google Maps for polygons, farmer map, attendance timeline reverse-geocode |
| **Exports** | CSV / printable HTML on Farmers, Dealers, Distributors, FPOs, Expenses, Attendance |
| **Reporting / analytics** | Territory analytics in `TerritoryViewSheet` / RoutesPage (village counts, FSPP, farm cards/diaries, product visits) |
| **Audit / history** | `update_history` arrays on farmer/dealer/FPO edits; retail “Audit Actions”; not a full audit log service |
| **Search / filtering** | Local table filters (`DataTable`, page-level filters, date ranges) |
| **Drafts workflow** | Shared `drafts` table with `entity_type` for incomplete onboardings |
| **Translations** | Edge function `auto-translate-parameter` → `dynamic_translations` (Hindi/Gujarati via Gemini) |
| **Design system** | shadcn/ui + Tailwind; shared `AppLayout` / `DataTable` / sheets |

---

## Business-Critical Areas

Ranking by concentration of validation, calculations, workflows, and cross-entity rules in **this** codebase:

| Priority | Module | Why |
|---|---|---|
| **High** | Farmers (+ Farm Cards / FSPP / Diary views) | Core domain entity; status DRAFT/SUBMITTED; FSPP JSON; farm cards; diaries; drafts merge; route mapping |
| **High** | Farm Diary Masters | Large SOP configuration engine; cloning; group intersection; parameter/UOM mapping; Cloudinary products |
| **High** | Farm Diary (operations) | Upcoming-stage forecast algorithm (DAS + sequence); observation deep model |
| **High** | FSPP Approvals | Explicit approval workflow PENDING/APPROVED/REJECTED on farm cards |
| **High** | Expenses | TA/DA rate rules (₹4/₹8 per km, DA ₹150 if distance > 60 km); status Pending/Queried/Approved/Rejected |
| **High** | Territory Routes | Route geography model; SE assignment; territory KPIs; polygon aggregation |
| **High** | Roles & Access | Gates every module; Web vs Mobile permission matrices |
| **Medium** | Dealers | Multi-dimension scoring/category logic embedded in detail sheet; draft vs submitted update paths |
| **Medium** | Attendance | Explicit hour/logout attendance rule engine |
| **Medium** | Shifts | Source of truth for attendance/expenses distance & time |
| **Medium** | Sales Executives | Auth provisioning rules (synthetic email); demo SE filtering |
| **Medium** | Retail & Inventory | Stock IN/OUT + orders; FK protection on delete |
| **Medium** | Location Master | Geographic foundation for routes/farmers |
| **Medium** | Distributors | Scoring/band + draft workflow (lighter UI than dealers) |
| **Low** | Dashboard | Mostly counts aggregation |
| **Low** | FPOs | Similar directory pattern; fewer nested workflows in admin |
| **Low** | Onboarding Settings | Important conceptually, but **DB persist is TODO** — rules may still live hard-coded / mobile-side |

---

## Business Rule Discovery Map

*Where to investigate later — not the rules themselves.*

### 1. Dashboard & Admin Users
- KPI count logic (submitted tables + `drafts`)
- Admin user create via `create-se` with Web roles
- Super Admin–only management UI

### 2. Roles & Access
- `WEB_MODULES` / `MOBILE_MODULES` catalogs
- View/edit coupling (edit implies view; clearing view clears edit)
- Admin bypass rules (TH / Super Admin)
- `role_permissions` vs `user_permissions`

### 3. Sales Executives
- Edge function `create-se` auth email rules (SE → `{mobile}@gmail.com`)
- Profile completeness (`sales_executive.is_profile_complete` + JSON sections)
- Demo SE flag filtering across modules
- Mobile role assignment on create

### 4. Distributors
- Status values (DRAFT / SUBMITTED / APPROVED / REJECTED observed in UI)
- Scoring / band fields
- Draft vs main table merge on list pages
- Detail edit / export

### 5. Dealers
- Scoring dimensions & tier labels (`DealerDetailSheet`)
- Category derivation from scores
- Commitments / annexures / documents
- Draft update vs submitted `dealers` update + `update_history`
- Distributor links / demo farmers JSON structures

### 6. Farmers
- Status DRAFT vs SUBMITTED; drafts table merge
- `personal_details` / `farm_details` / `history_details` / `fspp_details` schemas
- Village → route name mapping
- Farm card & diary nested views
- Admin edit validation paths

### 7. FPOs
- Draft/submitted merge
- Detail field set & update_history
- Status handling

### 8. Territory Routes
- `routes.locations` JSON shape (district/taluka/villages/otherVillages)
- Assign / unassign / delete route rules
- Territory analytics aggregations (FSPP, land, crops, soils, farm cards/diaries, product visits)
- Global polygon map (farm_cards.boundary_polygon, farm_diary.diary_polygon)
- `temp_dealers` usage

### 9. Attendance
- Rule engine: Absent / Active / Full Day (>7.5h) / Half Day (logout 13:00–14:30) / hours display
- Timeline construction from `shift_locations` + farmer/farm card events
- Export month CSV

### 10. Expenses
- Status: Pending / Queried / Approved / Rejected
- TA/DA calculation: distance source (odo vs total_distance); rates 4 vs 8; DA threshold 60 km → ₹150
- Approval blocked if TA/DA total ₹0
- Remarks encoding of adjusted TA/DA; `admin_comments`
- Payout consolidation export of Approved expenses

### 11. Location Master
- District → Taluka → Village CRUD constraints
- Cascading selection

### 12. Shifts
- Status ACTIVE vs COMPLETED (derived from end_time)
- Vehicle type / personal vehicle / odometer fields
- Admin create/edit of shifts

### 13. Farm Diary Masters
- Master CRUD for crops/stages/uom/parameters/GLS products
- Parameter UI types & options; UOM mapping defaults
- SOP group crop-set intersection / merge / delete rules
- Stage sequence; applications (DAS, product, dosage type); observation parameters per stage
- SOP clone across crops
- Cloudinary image upload for products
- Auto-translate edge function triggers (**DB trigger wiring UNCONFIRMED in local migrations**)

### 14. FSPP Approvals
- `fspp_approval_status` PENDING/APPROVED/REJECTED
- Filters on FSPP category, committed land + unit, SE, date range
- Relationship between farmer `fspp_details` and farm card approval

### 15. Farm Diary (operations)
- Permission key mismatch (`farm_diary_masters` vs `farm_diary_approvals`)
- Upcoming stage algorithm (visits present vs calendar DAS)
- Overdue detection; forecast date filters
- Observation session / sample / parameter value model
- `is_sowing_done` / `sowing_date` / land & soil fields

### 16. Retail & Inventory
- Item active flag; MRP; UOM
- Stock transfer IN to SE (batch_number)
- Ledger txn_type IN/OUT
- Retail orders payment modes (CASH/UPI); farmer fields
- Delete protection when ledger references exist

### 17. Onboarding Settings
- Hard-coded default scoring schemas for dealer/farmer/distributor
- Commitments / annexures / terms editors
- Persist to `form_templates` is **TODO** — confirm where mobile/runtime reads scoring config

### Cross-cutting / infrastructure
- Auth session & platform field on roles
- RLS policies (migration shows permissive authenticated ALL — may have changed remotely)
- Drafts entity_type contract
- Export formatting conventions

---

## Module Dependency Map

```
Roles & Access
  └── (gates) all Web modules

Location Master
  └── Territory Routes
        ├── Sales Executives
        ├── Farmers (village ↔ route)
        └── Attendance timeline / territory analytics

Sales Executives
  ├── Distributors
  ├── Dealers
  │     └── Farmers (optional dealer_id)
  ├── Farmers
  │     ├── FSPP (farmer.fspp_details)
  │     ├── Farm Cards
  │     │     └── FSPP Approvals
  │     └── Farm Diaries
  │           └── Observations (→ Farm Diary Masters)
  ├── FPOs
  ├── Shifts
  │     ├── Attendance
  │     └── Expenses
  └── Retail & Inventory

Farm Diary Masters
  └── Farm Diary (operations) / Farmer diary views

Onboarding Settings (templates)
  └── Dealer / Farmer / Distributor scoring UX
      (persistence path NEEDS FURTHER INVESTIGATION)
```

ASCII compact view:

```
Location Master
  ↓
Territory Routes ←→ Sales Executives
                      ↓
        Distributors / Dealers / FPOs / Farmers
                              ↓
                    FSPP → Farm Cards → FSPP Approvals
                              ↓
                         Farm Diaries ← Farm Diary Masters

Sales Executives → Shifts → Attendance
                         ↘ Expenses

Sales Executives → Retail & Inventory
```

---

## Confirmed Database / API Surface (from code usage)

### Tables referenced by the SPA

`profiles`, `roles`, `role_permissions`, `user_permissions`, `sales_executive`, `distributors`, `dealers`, `farmers`, `fpos`, `drafts`, `routes`, `districts`, `talukas`, `villages`, `shifts`, `shift_locations`, `expenses`, `farm_cards`, `farm_diary`, `mandatory_base_visits`, `crop_observation_sessions`, `plant_sample_sets`, `sample_parameter_values`, `master_crops`, `master_crop_stages`, `master_uom`, `master_parameters`, `master_gls_products`, `parameter_uom_mapping`, `sop_groups`, `sop_crop_stages`, `sop_applications`, `sop_parameters`, `item_master`, `inventory_transactions`, `retail_orders`, `temp_dealers`, `dynamic_translations` (edge function)

### Edge functions

| Function | Purpose |
|---|---|
| `create-se` | Admin Auth user create + profile email fix for SE |
| `auto-translate-parameter` | Translate master strings to hi/gu via Gemini into `dynamic_translations` |

### Routes (authenticated)

`/dashboard`, `/roles`, `/sales-executives`, `/distributors`, `/dealers`, `/farmers`, `/fpos`, `/routes`, `/attendance`, `/expenses`, `/locations`, `/shifts`, `/farm-diary-masters`, `/fspp-approvals`, `/retail`, `/farm-diary-approvals`, `/settings/dealer|farmer|distributor`, `/settings/legacy`

Orphan / unused in router: `RegisterPage.tsx` exists but is **not** mounted in `Index.tsx`.

---

## Areas That Need Further Investigation

1. **Complete Postgres schema / RLS** — most tables absent from local migrations; remote Supabase is likely source of truth.
2. **Broken `src/integrations/supabase/types.ts`** — regenerate for typed models.
3. **Mobile app business rules** — creation/submission of farmers, farm cards, diaries, expenses, shifts, FSPP scoring likely occurs on mobile; admin mostly reviews/configures.
4. **`form_templates` persistence** — Settings UI does not save; confirm actual scoring source for mobile onboarding.
5. **`user_permissions` vs `role_permissions`** — dual systems; confirm production behavior.
6. **`role_management` permission** — sidebar key not in `WEB_MODULES` list.
7. **Farm Diary page permission key** mismatch (`farm_diary_masters` vs `farm_diary_approvals`).
8. **FSPP scoring algorithm** — admin displays `fspp_details`; computation logic not found in this repo.
9. **Dealer/distributor band & category computation** — partial UI logic present; full submit-time rules may be mobile-side.
10. **`temp_dealers` purpose and lifecycle**.
11. **DB triggers** for auto-translate and profile creation on auth signup.
12. **CO role** semantics and constraints vs migration CHECK.
13. Whether **React Query** is intended for future use or leftover scaffolding.

---

## Recommended Order for Business-Rule Extraction

Suggested sequence for Phase 1+ (highest leverage / dependency-first):

1. **Roles & Access** (security boundary for everything else)
2. **Sales Executives** + **Auth provisioning** (`create-se`)
3. **Location Master**
4. **Territory Routes**
5. **Farmers** (profile, drafts, status, location linkage)
6. **FSPP** (farmer evaluation fields + **FSPP Approvals** / Farm Cards)
7. **Farm Diary Masters** (SOP configuration)
8. **Farm Diary operations** (observations + upcoming stage rules)
9. **Dealers** (scoring / category / commitments)
10. **Distributors**
11. **Shifts** → **Attendance** → **Expenses** (operational chain)
12. **Retail & Inventory**
13. **FPOs**
14. **Onboarding Settings** (after confirming persistence source)
15. **Dashboard** (aggregations last)

---

## Phase 0 Summary Checklist

| Item | Result |
|---|---|
| Detected technology stack | React 18 + TypeScript + Vite + Tailwind/shadcn + Supabase (+ Edge Functions) |
| Detected architecture | SPA talking directly to Supabase; business logic mostly in pages/components |
| Total web modules (implemented) | **17** |
| Mobile modules (permission keys only) | **7** |
| Major relationships | SE → channel partners/farmers → Farm Cards/FSPP/Diaries; Location → Routes; Shifts → Attendance/Expenses; Masters → Diary ops |
| Major user roles | Super Admin, TH, CO, SE, plus configurable `roles` |
| Business-critical | Farmers/FSPP/Farm Cards/Diary Masters/Diary Ops/Expenses/Routes/RBAC |
| Next phase | Module-by-module business-rule extraction Markdown docs |

---

*End of Phase 0 — Module Inventory. No application code was modified beyond creating this document.*
