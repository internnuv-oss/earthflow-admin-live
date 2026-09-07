# Territory Routes — V2 API Requirements Audit

**Project:** FieldCommander Admin Dashboard (legacy)  
**Module:** Territory Routes (`/routes`)  
**Audit type:** Read-only frontend → backend capability inventory  
**Date:** 2026-08-26  
**Scope rule:** Conclusions are labeled **Verified**, **Inferred**, **Mocked**, **Partially implemented**, or **New V2 requirement**. No application source files were modified for this audit.

---

## 1. Executive summary

### What the legacy module actually is

**Verified:** Territory Routes is an **SE-centric village territory assignment** module, not a GPS waypoint / beat-plan planner.

- A **route** is a named record in Supabase table `routes` with:
  - `name` (string)
  - `se_id` (FK to Sales Executive `profiles.id`)
  - `locations` (JSON array of territory blocks: `{ state, district, taluka, villages[] }`)
  - `created_by` (on insert only)
- The primary list UI groups **Sales Executives**, not flat route rows.
- “Stops” in practice are **villages inside location blocks**, stored as string names (not geo coordinates, not ordered waypoints).
- Maps in this module show **farm card / farm diary polygons**, not planned route polylines.
- Analytics are **territory performance metrics** (farmers, FSPP, land, crops, farm cards/diaries, product usage) aggregated **client-side** from Farmers / Drafts / Farm Cards / Farm Diary visits.

### What is *not* in Territory Routes UI (but related elsewhere)

| Capability | Status in Territory Routes | Where it actually appears |
|---|---|---|
| Planned route geometry (polyline) | **Not found** | — |
| Ordered waypoints / visit order | **Not found** | — |
| Stop coordinates | **Not found** | Farm polygons only |
| Followed GPS path | **Not in Routes module** | Attendance timeline (`shift_locations` + optional Google Snap-to-Roads) |
| Punched-in vs working-in route deviation | **Not in Routes module** | Attendance timeline (frontend village→route map vs `shift.assigned_route_id`) |
| Distance / odometer | **Not in Routes module** | Attendance / Shifts / Expenses |
| Assignment history / audit log | **Not found** | — |
| Bulk route actions | **Not found** | — |
| Server-side analytics aggregation | **Not found** | All analytics computed in browser |

### V2 implications (high level)

To **preserve legacy Territory Routes behavior**, V2 needs APIs for:

1. SE-grouped route listing (non-demo SEs) with nested routes + village counts  
2. Route CRUD with embedded location blocks  
3. Assign / reassign by setting `se_id`  
4. Delete (legacy “unassign” is a hard delete)  
5. Location master cascading lookups (districts → talukas → villages) + SE lookup  
6. Territory drill-down data (farmers, drafts, dealers, farm polygons, diaries/visits)  
7. Territory / product analytics payloads (or accept client aggregation with raw feeds)  
8. Module permissions (`routes`: `can_view` / `can_edit`)

To also meet the **stated V2 feature list** (waypoints, coordinates, visit order, planned vs followed geometry, adherence/deviation metrics, assignment history), V2 must add **capabilities that do not exist in the legacy Territory Routes UI**. Those are marked **New V2 requirement** below. Some adherence/distance behavior can be **shared with Attendance / Shifts**, not invented from RoutesPage alone.

### Data access pattern (legacy)

**Verified:** Direct Supabase JS client calls from React components. No dedicated REST service layer, Redux store, React Query hooks, mock API layer, or OpenAPI types for `routes` (generated `types.ts` is a stub).

---

## 2. Legacy implementation map

### 2.1 Navigation & entry

| Item | Detail | Confidence |
|---|---|---|
| Sidebar label | “Territory Routes” → `/routes`, module key `routes` | **Verified** — `AppSidebar.tsx` L38 |
| Router | `<Route path="/routes" element={guard(<RoutesPage .../>)} />` | **Verified** — `Index.tsx` L46 |
| Permission module | `getModulePerm('routes')` → `{ can_view, can_edit }` | **Verified** — `RoutesPage.tsx` L69; `usePermissions.ts` |
| Roles matrix | Module key `routes`, label “Territory Routes” | **Verified** — `RolesPage.tsx` L21; `PermissionEditor.tsx` L16 |

### 2.2 UI surface map

```
/routes  RoutesPage
├── SE table (paginated, client-side 10/page)
│   ├── View Territories → TerritoryViewSheet
│   └── Manage Routes → SERoutesSheet (edit gated)
├── Create & Assign Route → RouteBuilderDialog (create)
├── Overall Analytics → AnalyticsTable (global SE columns)
├── Product Analysis → ProductAnalyticsTable (global)
└── View Global Map → PolygonMap (all farm polygons)

SERoutesSheet
├── List routes + location blocks + village badges
├── Edit → RouteBuilderDialog (update / reassign SE)
└── Trash → delete route row (confirm)

TerritoryViewSheet (drill-down)
├── Level: routes → villages → farmers
├── Tabs at each level: List | Dealers | Analytics | Products | Map
└── Farmer click → FarmerDetailSheet (read-only)

RouteBuilderDialog
├── SE searchable select
├── Route name
└── N territory blocks: State → District → Taluka → multi Village
```

### 2.3 Source files (Territory Routes core)

| File | Role |
|---|---|
| `src/pages/RoutesPage.tsx` | Page shell, SE+routes fetch, delete, global analytics/map |
| `src/components/RouteBuilderDialog.tsx` | Create/update route + cascading location pickers |
| `src/components/SERoutesSheet.tsx` | Per-SE manage sheet |
| `src/components/TerritoryViewSheet.tsx` | Drill-down + `AnalyticsTable` + `ProductAnalyticsTable` |
| `src/components/PolygonMap.tsx` | Farm boundary map (Google Maps / Leaflet fallback) |
| `src/hooks/usePermissions.ts` | RBAC including Super Admin / TH bypass |
| `src/components/AppSidebar.tsx` | Nav visibility |
| `src/pages/RolesPage.tsx` / `PermissionEditor.tsx` | Permission module registration |

### 2.4 Shared / dependent modules (not owned by Routes UI)

| File | Dependency |
|---|---|
| `src/pages/FarmersPage.tsx` | Loads all `routes` to map village → route name for table/export |
| `src/components/FarmerTable.tsx` | Displays “Route Name” from village mapping |
| `src/components/AttendanceTimelineSheet.tsx` | Loads SE routes; uses `shift.assigned_route_id`; compares punched-in vs working village route; GPS path |
| `src/pages/LocationMasterPage.tsx` | CRUD for `districts` / `talukas` / `villages` masters used by RouteBuilder |
| `src/pages/AttendancePage.tsx` / `ShiftsPage.tsx` / `ExpensesPage.tsx` | Distance / shift fields consumed for adherence-adjacent analytics |

### 2.5 Alternative name search results

Searched: territory, route, route plan, beat plan, journey plan, tour plan, executive route, employee route, field visit, outlet route, route adherence, route analytics, waypoint, polyline (within routes scope).

| Term | Finding |
|---|---|
| Territory Routes | **Verified** — primary module name |
| Beat / journey / tour plan | **Not found** in this codebase for admin routes |
| Outlet route | **Not found** (dealers shown by village match from `temp_dealers`) |
| Route adherence | **Partially implemented** only in Attendance timeline UI |
| Waypoints / visit order | **Not found** in Territory Routes |

---

## 3. Feature-to-API matrix

Legend for **Status**: Verified | Partially implemented | Mocked | Inferred | New V2 requirement  
Legend for **Backend today**: Supabase table/query used by frontend

| # | User action / UI feature | Status | Existing data source | Recommended V2 endpoint | Notes |
|---|---|---|---|---|---|
| F1 | View SE list with assigned route chips + village counts | **Verified** | `profiles` ⨯ `routes`; farmers/drafts for orphans | `GET /v2/territory-routes/executives` | Client pagination |
| F2 | Access denied when no `can_view` | **Verified** | `role_permissions` / admin bypass | (authZ on all routes APIs) | |
| F3 | Create route + assign to SE | **Verified** | `routes.insert` | `POST /v2/territory-routes/routes` | |
| F4 | Edit route name / locations / reassign SE | **Verified** | `routes.update` | `PUT /v2/territory-routes/routes/{routeId}` | Reassign = change `seId` |
| F5 | Delete route (“Unassign”) | **Verified** | `routes.delete` | `DELETE /v2/territory-routes/routes/{routeId}` | Hard delete, not null `se_id` |
| F6 | Soft unassign without delete | **New V2 requirement** | — | `POST .../routes/{id}/unassign` | Not in legacy |
| F7 | Assignment history | **New V2 requirement** | — | `GET .../routes/{id}/assignment-history` | Not in legacy |
| F8 | Manage Routes sheet list | **Verified** | In-memory from F1 | Covered by F1 / `GET .../routes/{id}` | |
| F9 | View Territories drill-down (routes→villages→farmers) | **Verified** | farmers, drafts, farm_cards, farm_diary, temp_dealers | `GET .../executives/{seId}/territory-view` | Prefer aggregated payload |
| F10 | Synthetic “Others (Out of Route)” | **Verified** (frontend-only) | Diff official villages vs farmer/draft villages | Include in F1/F9 or compute client-side | Not persisted |
| F11 | Dealers tab by village | **Verified** | `temp_dealers` full scan + client filter | `GET .../dealers?village=` or embed in F9 | Schema fields inconsistent |
| F12 | Per-SE / per-route / per-village analytics table | **Verified** (client agg) | farmers+drafts+cards+diaries | `GET .../analytics/territory` | |
| F13 | Product usage analytics | **Verified** (client agg) | `mandatory_base_visits.fertilizers_applied/pesticides_applied` | `GET .../analytics/products` | |
| F14 | Analytics PDF export | **Verified** (frontend print) | — | Optional `GET .../analytics/territory/export` | Legacy is browser print |
| F15 | Territory / global farm map | **Verified** | `farm_cards.boundary_polygon`, `farm_diary.diary_polygon` | `GET .../maps/farm-polygons` | |
| F16 | Cascading location lookup for builder | **Verified** | districts/talukas/villages | Location Master APIs (shared) | |
| F17 | SE lookup for builder | **Verified** | `profiles` role=SE | Shared executives API | Demo filter differs create vs list |
| F18 | Village → route name mapping (Farmers module) | **Verified** | `routes.select(name,locations)` | `GET /v2/territory-routes/village-route-index` | Shared |
| F19 | Shift punched-in route resolution | **Verified** (Attendance) | `routes` + `shifts.assigned_route_id` | Shared Attendance APIs | |
| F20 | GPS followed path + snap | **Verified** (Attendance) | `shift_locations` + Google Roads | Shared Attendance APIs | |
| F21 | Planned vs followed adherence % / deviation km | **New V2 requirement** | — | `GET .../analytics/adherence` | Not computed in Routes |
| F22 | Waypoints CRUD + visit order + coordinates | **New V2 requirement** | — | `/routes/{id}/stops` | Legacy has village names only |
| F23 | Planned route geometry | **New V2 requirement** | — | `GET .../routes/{id}/geometry/planned` | |
| F24 | Bulk create/assign/delete | **New V2 requirement** | — | `POST .../routes/bulk` | Not in UI |
| F25 | Route list search/sort server-side | **Partially implemented** | Client sort by route name; no search | Query params on F1 | |
| F26 | Date-filtered territory analytics | **New V2 requirement** (mostly) | “Last Visited” uses farmer timestamps; no date picker on Routes analytics | `from`/`to` on analytics APIs | |
| F27 | Audit log for route mutations | **New V2 requirement** | — | `GET .../routes/{id}/audit` | |

---

## 4. Detailed API contracts

> Naming uses a recommended REST style for V2. Legacy does **not** use these paths; it uses Supabase PostgREST-style table access. Each contract lists **fields the frontend actually consumes**.

### 4.1 `GET /v2/territory-routes/executives`

**Purpose:** Power RoutesPage SE table + feed Manage/View sheets.  
**Confidence:** **Verified** behavior from `RoutesPage.fetchSEsAndRoutes` (L81–188).

#### Query parameters

| Param | Type | Required | Behavior |
|---|---|---|---|
| `includeDemo` | boolean | no | Default `false`. Legacy: `.or('is_demo.eq.false,is_demo.is.null')` |
| `page` | int | no | Legacy is **client** pagination (`ITEMS_PER_PAGE = 10`). Server pagination **Inferred** as V2 improvement |
| `pageSize` | int | no | Default 10 |
| `sort` | string | no | Legacy sorts SEs by `name` ASC; routes by `name` numeric-aware |
| `search` | string | no | **Not in legacy** — **New V2 requirement** if desired |
| `includeOrphanRoute` | boolean | no | If true, backend may attach synthetic Others route (**Inferred** preference); legacy computes client-side |

#### Response (consumed fields)

```json
{
  "items": [
    {
      "id": "uuid",
      "name": "string",
      "routes": [
        {
          "id": "uuid",
          "name": "string",
          "seId": "uuid",
          "locations": [
            {
              "state": "string",
              "district": "string",
              "taluka": "string",
              "villages": ["string"],
              "otherVillages": ["string"]
            }
          ],
          "otherVillages": ["string"],
          "isCustomOthers": false,
          "createdBy": "uuid",
          "createdAt": "iso-8601",
          "updatedAt": "iso-8601"
        }
      ],
      "totalVillageCount": 0
    }
  ],
  "pagination": { "page": 1, "pageSize": 10, "total": 0 }
}
```

| Field | Required by UI | Notes |
|---|---|---|
| `id`, `name` | Yes | SE identity |
| `routes[].id`, `name`, `locations` | Yes | Chips, manage sheet, drill-down |
| `locations[].state/district/taluka/villages` | Yes | |
| `otherVillages` / `locations[].otherVillages` | Optional | Legacy reads multiple alias keys defensively (`other_villages`, `other_route_villages`, `other_route`) — **Verified** defensive reads; **Inferred** that some persisted rows may use them |
| `isCustomOthers` | Yes if included | Frontend-only today (`id: 'others-custom-route'`) |
| `totalVillageCount` | Optional | Legacy computes client-side |

#### Loading / empty / error

| Case | Legacy UI |
|---|---|
| Loading | Spinner row in table |
| Empty SE list | “No SEs found.” |
| Error | Toast: “Failed to load routes” + `err.message` |
| Permission | Full-page “Access Denied” if `!can_view` |

#### Backend responsibilities

- Authorize `routes.can_view`
- Exclude demo SEs by default
- Join routes via `routes.se_id`
- Optionally compute orphan villages (today: compare route villages vs `farmers` status=`SUBMITTED` + `drafts` entity_type=`farmer`) — **Verified** client logic L94–171

#### Orphan village algorithm (must preserve if parity required)

**Verified** (`RoutesPage` L147–171; mirrored in `TerritoryViewSheet` L543–652):

1. Collect official villages from all non-custom routes (case-insensitive), including optional `other*` fields.  
2. Collect actual villages from submitted farmers (`farmers.village`) and farmer drafts (`draft_data.village` or `personal_details.village`) for that SE.  
3. Villages in actual but not official → synthetic route `{ id: 'others-custom-route', name: 'Others (Out of Route)', is_custom_others: true, locations: [{ villages: [...] }] }`.

---

### 4.2 `GET /v2/territory-routes/routes/{routeId}`

**Purpose:** Route detail for edit dialog / deep links.  
**Confidence:** **Inferred** (legacy loads via parent SE join `routes!routes_se_id_fkey ( * )`, not a dedicated get-by-id).

#### Path

| Param | Type |
|---|---|
| `routeId` | uuid |

#### Response fields consumed on edit

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `name` | string | |
| `seId` | uuid | Prefills Assigned SE |
| `locations` | LocationBlock[] | Mapped into form; UI adds ephemeral `id: crypto.randomUUID()` per block |

---

### 4.3 `POST /v2/territory-routes/routes`

**Purpose:** Create & assign route.  
**Confidence:** **Verified** — `RouteBuilderDialog.handleSave` insert branch L145–155.

#### Request body

```json
{
  "name": "string",
  "seId": "uuid",
  "locations": [
    {
      "state": "string",
      "district": "string",
      "taluka": "string",
      "villages": ["string"]
    }
  ]
}
```

| Field | Type | Required | Validation (legacy UI) |
|---|---|---|---|
| `name` | string | yes | Non-empty after trim |
| `seId` | uuid | yes | Must select SE (“Please assign an SE.”) |
| `locations` | array | yes | Every block: state, district, taluka present; `villages.length > 0` |
| `createdBy` | uuid | set by backend | Legacy sets `created_by: session.user.id` |

#### Response

Return created route object (legacy ignores body beyond success/error). Toast: “Route created and assigned directly to SE.”

#### Backend responsibilities

- Authorize `routes.can_edit`
- Validate SE exists and `role = SE`
- Persist `locations` JSON (names, not location IDs — **Verified**)
- **Inferred:** Consider uniqueness of `(seId, name)` — not enforced in UI

---

### 4.4 `PUT /v2/territory-routes/routes/{routeId}`

**Purpose:** Update territory blocks and/or reassign SE.  
**Confidence:** **Verified** — update L132–139.

#### Request body

```json
{
  "name": "string",
  "seId": "uuid",
  "locations": [ { "state": "", "district": "", "taluka": "", "villages": [] } ]
}
```

Same validation as create. Toast: “Route has been updated successfully.”

#### Reassignment semantics

**Verified:** Changing `se_id` on update is how reassignment works. There is no separate assign endpoint and no history write.

#### Backend responsibilities

- Authorize `routes.can_edit`
- Validate route exists
- Allow SE change (reassign)
- **New V2 requirement:** Optionally write assignment history when `seId` changes

---

### 4.5 `DELETE /v2/territory-routes/routes/{routeId}`

**Purpose:** Remove route from SE (legacy labels this unassign).  
**Confidence:** **Verified** — `handleUnassignRoute` L354–361 deletes the row.

#### Behavior

- Browser `confirm('Are you sure you want to remove this route from the SE?')`
- Success toast: “Route Removed” / “The territory has been deleted successfully.”
- Gated by `can_edit`

#### Ambiguity

**Verified:** UI copy says “remove/unassign” but implementation is **hard delete**. Soft-unassign is **New V2 requirement** if product wants retention.

#### Risk

**Partially implemented / ambiguous:** `SERoutesSheet` also renders Edit/Delete for synthetic `others-custom-route` if present in `se.routes` (Manage sheet uses same list as page). Deleting id `others-custom-route` would fail or be meaningless — **Verified** risk; product should hide actions when `isCustomOthers`.

---

### 4.6 Stops / waypoints APIs

#### Legacy reality

**Verified:** No stops table, no visit order, no stop coordinates in RouteBuilder. Territory “coverage” is unordered village string arrays inside location blocks. Block order in the `locations` array is UI order only; village multi-select order is Set-iteration order, not a planned visit sequence.

#### Recommended if V2 requires stop management (**New V2 requirement**)

| Endpoint | Method | Purpose |
|---|---|---|
| `GET /v2/territory-routes/routes/{routeId}/stops` | GET | List ordered stops |
| `PUT /v2/territory-routes/routes/{routeId}/stops` | PUT | Replace full ordered stop list |
| `POST /v2/territory-routes/routes/{routeId}/stops` | POST | Add stop |
| `PATCH /v2/territory-routes/routes/{routeId}/stops/{stopId}` | PATCH | Update coords / outlet / notes |
| `DELETE /v2/territory-routes/routes/{routeId}/stops/{stopId}` | DELETE | Remove stop |
| `POST /v2/territory-routes/routes/{routeId}/stops/reorder` | POST | `{ orderedStopIds: uuid[] }` |

##### Suggested stop model (not legacy)

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | uuid | yes | |
| `sequence` | int | yes | Visit order (1-based) |
| `name` | string | yes | Village / outlet label |
| `latitude` | number | optional* | *Required if geometry/adherence needed |
| `longitude` | number | optional* | |
| `villageName` | string | optional | Bridge to legacy village matching |
| `outletId` | uuid | optional | If outlets become first-class |
| `district` / `taluka` / `state` | string | optional | |

**For parity with legacy only:** embed location blocks on the route resource; dedicated stops APIs are additive for V2.

---

### 4.7 Assignment / reassignment / unassignment / history

| Operation | Legacy | V2 recommendation |
|---|---|---|
| Assign on create | `se_id` in insert | `POST /routes` with `seId` |
| Reassign | `se_id` in update | `PUT /routes/{id}` or `POST /routes/{id}/assign` `{ seId }` |
| Unassign | Hard delete | Prefer `POST /routes/{id}/unassign` + keep `DELETE` for destroy — product confirm |
| History | None | `GET /routes/{id}/assignment-history` → `{ assignedTo, assignedBy, assignedAt, action }` |

---

### 4.8 Executive lookup

**Endpoint:** `GET /v2/executives?role=SE&includeDemo=false` (shared)  
**Confidence:** **Verified** usages:

| Caller | Query | Demo filter |
|---|---|---|
| RoutesPage list | `profiles` role SE + join routes | exclude demo / null |
| RouteBuilderDialog | `profiles` id,name role SE | **No demo filter** (**Verified** L88) |

V2 should document whether create-assign may target demo SEs (legacy allows it).

---

### 4.9 Location master lookups (shared with Location Master module)

| Endpoint | Legacy query | Consumed fields |
|---|---|---|
| `GET /v2/locations/districts` | `districts.select('*').order('name')` | `id`, `name` |
| `GET /v2/locations/talukas?districtId=` | `talukas.eq('district_id')` | `id`, `name`, `district_id` |
| `GET /v2/locations/villages?talukaId=` | `villages.eq('taluka_id')` | `id`, `name`, `taluka_id` |

**States:** Hardcoded frontend list `INDIAN_STATES` — **Verified** `RouteBuilderDialog.tsx` L14. Not from API. Default new block state = `"Gujarat"`.

**Important:** Route storage persists **names** (`district`, `taluka`, village strings), not foreign keys — **Verified**. Renaming a district in Location Master can orphan route JSON references (**Inferred** risk).

---

### 4.10 `GET /v2/territory-routes/executives/{seId}/territory-view`

**Purpose:** Replace multi-query client fan-out in `TerritoryViewSheet.fetchAllFarmersInTerritory` (L539–655).  
**Confidence:** **Verified** data needs; endpoint shape **Inferred**.

#### Response (fields consumed)

```json
{
  "executive": { "id": "", "name": "" },
  "routes": [ /* same as list; may include synthetic others */ ],
  "farmers": [
    {
      "id": "",
      "fullName": "",
      "mobile": "",
      "village": "",
      "status": "SUBMITTED|DRAFT",
      "isDraft": false,
      "createdAt": "",
      "updatedAt": "",
      "fsppDetails": {},
      "farmDetails": { "totalLand": 0, "majorCrops": [], "soilType": [], "biofertilizer": "" },
      "personalDetails": {},
      "hasFarmCard": false,
      "hasFarmDiary": false
    }
  ],
  "farmCards": [
    { "id": "", "farmerId": "", "boundaryPolygon": [], "status": "DRAFT|..." }
  ],
  "farmDiaries": [
    {
      "id": "",
      "farmerId": "",
      "farmName": "",
      "diaryPolygon": [],
      "visits": [
        {
          "id": "",
          "fertilizersApplied": [ { "name": "", "unit": "", "quantity": "0" } ],
          "pesticidesApplied": [ { "name": "", "unit": "", "quantity": "0" } ]
        }
      ]
    }
  ],
  "dealers": [ /* temp_dealers rows; see §5 */ ]
}
```

#### Legacy queries replaced

1. `farmers` where `se_id` + `status=SUBMITTED` (+ `profiles:se_id(name)`)  
2. `drafts` where `se_id` + `entity_type=farmer`  
3. `farm_cards` where `se_id` (`id, farmer_id, boundary_polygon, status`)  
4. `farm_diary` for farmer ids (`diary_polygon`, nested `mandatory_base_visits`)  
5. `temp_dealers` select `*` (all rows; filtered client-side by village)

#### UI behaviors fed by this payload

- Route cards: village count, farmer count  
- Village list → farmer list with `StageProgressBar` (`Onboarding` | `FSPP` | `Farm Card`)  
- Dealers grouped by route/village  
- Analytics / Products / Map tabs  

---

### 4.11 Analytics — territory performance

#### `GET /v2/territory-routes/analytics/territory`

**Confidence:** Metrics **Verified** in `AnalyticsTable.computeMetrics` (L173–315); aggregation locus today is **frontend**.

##### Query parameters

| Param | Type | Notes |
|---|---|---|
| `scope` | `global` \| `executive` \| `route` \| `village` | Maps to Overall Analytics vs TerritoryViewSheet levels |
| `seId` | uuid | when scope ≠ global |
| `routeId` | uuid | optional |
| `village` | string | optional |
| `from` / `to` | date | **New V2 requirement** — legacy has no date filter on this table |

##### Metrics columns (must preserve)

| Metric key | Display label | Computation (Verified) |
|---|---|---|
| `villageCount` | Number of Villages | Count of villages in entity |
| `totalFarmers` | Number of Farmers | Submitted + drafts |
| `completed` | Completed Profile Farmer | `!is_draft` |
| `drafts` | Draft Farmer | `is_draft` |
| `fsppCount` | FSPP Enrolled Farmer | Farmers with non-empty `fspp_details`; breakdown Category A–D |
| `avgScore` | Average Score | Mean `fspp_details.score` |
| `totalLand` | Total Land (Acres) | Sum `farm_details.totalLand` where > 0 |
| `committedLand` | Committed Land for Bio | Sum `fspp_details.committedLand` |
| `avgLand` | Average Land/Farmer (Acres) | totalLand / farmersWithLand |
| `farmCardCount` | Farm Card Built | `total (Draft: x, Completed: y)` from `farm_cards.status` |
| `farmDiaryCount` | Farm Diary Built | Count diaries |
| `topCrops` | Major Crops | % share; crops ≤5% rolled into Other |
| `topSoils` | Soil Type & % | Top 2 soils |
| `primaryStage` | Biofertilizer Stage | Distribution of `farm_details.biofertilizer` or `fspp_details.statusLabel` |
| `lastVisited` | Last Visited on | Max of `updated_at`/`created_at` → `en-IN` date |

Always includes a synthetic **TOTAL (ALL)** column aggregating entities — **Verified** L339–348.

##### Export

- Legacy: client `window.open` print-to-PDF — **Verified** L370–420  
- V2 optional: `GET .../export?format=pdf|csv` — **New V2 requirement**

---

### 4.12 Analytics — product usage

#### `GET /v2/territory-routes/analytics/products`

**Confidence:** **Verified** — `ProductAnalyticsTable` L27–166; data from `mandatory_base_visits`.

##### Response shape consumed

For each entity column (TOTAL + SE/route/village/farmer):

| Field | Type |
|---|---|
| `productName` | string |
| `unit` | string |
| `useCount` | number |
| `totalQuantity` | number |
| `percentageOfEntityUses` | number | `(count / entityTotalUses)*100` — hidden for TOTAL column |

Product key = `name|||unit` from fertilizers + pesticides arrays (JSON or already-parsed).

---

### 4.13 Maps — farm polygons

#### `GET /v2/territory-routes/maps/farm-polygons`

**Confidence:** **Verified**.

| Query | Behavior |
|---|---|
| (none) / `scope=global` | All `farm_cards` + `farm_diary` with polygons (RoutesPage L190–228) |
| `seId` | Filter to SE farmers’ cards/diaries |
| `routeId` / `village` | Filter by farmers in that territory |

##### Feature fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | e.g. `fc-{id}` / `fd-{id}` |
| `title` | string | Farmer name + type / farm name |
| `type` | enum `Farm Card` \| `Farm Diary` | Colors: green / blue |
| `coords` | array | Flexible formats normalized client-side (see §5) |

Empty UI: “No farm boundaries mapped in this area yet.”

**Not present:** planned route polyline, followed GPS polyline inside Routes module.

---

### 4.14 Planned / followed geometry & adherence (**mostly New V2 + shared Attendance**)

#### Legacy followed path (Attendance — shared dependency)

| Data | Source | Confidence |
|---|---|---|
| Raw GPS | `shift_locations(lat,lng)` ordered by `timestamp` | **Verified** |
| Snapped path | Google Roads API `snapToRoads` (client, chunks of 100) | **Verified** |
| Fallback path | Shift event `location.lat/lng` | **Verified** |
| Distance | `shifts.total_distance`; odo from `start_km`/`end_km` | **Verified** |
| Punched-in route | `shifts.assigned_route_id` → `routes.name` | **Verified** |
| Working-in route | Village from event location → village→route map; else `Others` | **Verified** frontend |
| Deviation UI | Badge “Punched in: X” vs “Working in: Y” when mismatch | **Verified** — qualitative, not % |

#### Recommended V2 endpoints

| Endpoint | Method | Status |
|---|---|---|
| `GET /v2/attendance/shifts/{shiftId}/gps-path` | GET | **Inferred** wrap of existing data |
| `GET /v2/attendance/shifts/{shiftId}/route-context` | GET | punched-in route + village map + event classifications |
| `GET /v2/territory-routes/routes/{routeId}/geometry/planned` | GET | **New V2 requirement** |
| `GET /v2/territory-routes/analytics/adherence` | GET | **New V2 requirement** — define metrics with product |

##### Suggested adherence query (**needs product confirmation**)

| Param | Type |
|---|---|
| `seId` | uuid |
| `from` / `to` | date |
| `routeId` | uuid optional |

##### Suggested metrics (**New V2** — not computed in legacy Routes)

| Metric | Suggested meaning |
|---|---|
| `plannedVillageCount` | Villages on assigned route |
| `visitedInRouteCount` | Visits whose village ∈ planned |
| `visitedOutOfRouteCount` | Visits mapped to Others / other routes |
| `adherenceRate` | in-route / total visits |
| `gpsDistanceKm` | from shift |
| `odoDistanceKm` | end_km − start_km |
| `deviationEvents` | count of punched-in ≠ working-in |

---

### 4.15 Village → route index (shared Farmers export/table)

#### `GET /v2/territory-routes/village-route-index`

**Confidence:** **Verified** — `FarmersPage.fetchVillageMapping` L33–47.

Response:

```json
{ "mappings": { "village-name-lower": "Route Name" } }
```

Ambiguity: if two routes claim same village, last write wins in a plain object — **Inferred** conflict behavior.

---

### 4.16 Permissions

No dedicated permissions HTTP API in Routes; uses:

1. `profiles` (+ nested `roles`) for user  
2. `role_permissions` for `module_name='routes'`  

**Verified** bypass: `role === 'TH'` OR role name `Super Admin` → full access (`usePermissions.ts` L33–37).

V2 should enforce equivalent checks server-side on every territory-routes endpoint.

---

## 5. Data models and enums

### 5.1 Route (persisted — inferred from writes/reads)

| Field | Type | Required | Source confidence |
|---|---|---|---|
| `id` | uuid | yes | **Verified** |
| `name` | text | yes | **Verified** |
| `se_id` | uuid FK → profiles | yes on create/update in UI | **Verified** |
| `locations` | jsonb | yes | **Verified** |
| `created_by` | uuid | on create | **Verified** |
| `created_at` / `updated_at` | timestamptz | unknown | **Inferred** (select `*`) |
| `other_villages` / aliases | jsonb/text | optional | **Partially implemented** defensive reads only |

> Note: Checked-in `src/integrations/supabase/types.ts` is a stub (~120 bytes) and does **not** document `routes`. Schema is reconstructed from frontend usage. Initial migration SQL also lacks `routes` (added later outside this repo snapshot) — **Verified** absence in `supabase/migrations/20260511052322_*.sql`.

### 5.2 LocationBlock (JSON element)

| Field | Type | Required |
|---|---|---|
| `state` | string | yes |
| `district` | string | yes (name, not id) |
| `taluka` | string | yes (name) |
| `villages` | string[] | yes, min 1 |
| `otherVillages` / snake variants | string[] or CSV string | optional, read-only defensive |

### 5.3 Synthetic Others route (frontend-only)

| Field | Value |
|---|---|
| `id` | `'others-custom-route'` |
| `name` | `'Others (Out of Route)'` |
| `is_custom_others` | `true` |
| `locations` | `[{ villages: string[] }]` |

### 5.4 Enumerations / status values used by Routes analytics UI

| Enum | Values | Confidence |
|---|---|---|
| Farmer status (submitted) | `SUBMITTED` filter on farmers list | **Verified** |
| Draft marker | `status: 'DRAFT'`, `is_draft: true` | **Verified** |
| Farm card status | `DRAFT` vs non-`DRAFT` (= completed in UI) | **Verified** |
| FSPP category | `Category A` … `Category D` | **Verified** |
| Farmer journey stage (list) | `Onboarding`, `FSPP`, `Farm Card` | **Verified** `getFarmerStage` |
| Map polygon type | `Farm Card`, `Farm Diary` | **Verified** |
| Profile role | `SE`, `TH` | **Verified** |
| Permission module | `routes` | **Verified** |
| Hardcoded states | Gujarat, Maharashtra, Rajasthan, Madhya Pradesh, Karnataka, Punjab, Haryana | **Verified** |

### 5.5 Coordinate formats (polygons)

**Verified** normalizer in `PolygonMap.tsx` L15–26 accepts:

1. `{ lat, lng }`  
2. `{ latitude, longitude }`  
3. `[lat, lng]` array  
4. Fallback Gujarat center `22.2587, 71.1924` if unparseable  

Polygons rendered only if `coords.length > 2`.

### 5.6 Temp dealer fields (inconsistent)

**Verified** `WebDealerCard` accepts multiple casings:

`dealer_name` | `Dealer Name` | `Dealer_Name`, `village`/`Village`/`VILLAGE`, `contact_person`, `mobile`, `address`, `taluka`, `district`.

### 5.7 Visit product line item

| Field | Type |
|---|---|
| `name` | string |
| `unit` | string |
| `quantity` | number/string parsed with `parseFloat` |

---

## 6. Backend business rules

| Rule | Confidence | Detail |
|---|---|---|
| Routes belong to one SE via `se_id` | **Verified** | |
| Create always assigns an SE | **Verified** | UI blocks save without SE |
| Update may change SE (reassign) | **Verified** | |
| Unassign = delete | **Verified** | |
| Demo SEs hidden from list | **Verified** | |
| Demo SEs still selectable in builder | **Verified** | Inconsistency |
| Location cascade clears children | **Verified** | Frontend only |
| Village matching is case-insensitive trim | **Verified** | Orphans, dealers, analytics |
| Official villages include optional `other*` aliases | **Verified** | Defensive |
| Analytics exclude no date window | **Verified** | Full history pull with 1000-row paging |
| Global analytics pages farmers/drafts/cards/diaries in steps of 1000 | **Verified** | `RoutesPage` L241–280 |
| No geospatial calc in Routes module | **Verified** | |
| Attendance route deviation is string equality of route names | **Verified** | Not distance-based |
| Google Snap-to-Roads is client-side with Maps API key | **Verified** | Not a backend responsibility today |
| RLS historically open for authenticated (`USING true`) on early tables | **Verified** in old migration for other tables; routes RLS **unknown** in repo | Prefer real authZ in V2 |
| Audit history | **Not found** | |
| Prevent overlapping villages across SEs | **Not found** | No UI validation |

---

## 7. Permissions and validation

### 7.1 Permission matrix

| Action | `can_view` | `can_edit` | Legacy gate |
|---|---|---|---|
| See page / SE table | required | | L76–79, L379–387 |
| View Territories | required | | Button always if row visible |
| Overall Analytics / Product / Global Map | required | | No extra check |
| Create & Assign | | required | L415–418 |
| Manage Routes | | required | L500–504 |
| Edit / Delete in sheet | | required | `SERoutesSheet` `canEdit` |
| Super Admin / TH | both true | | `usePermissions` |

### 7.2 Client validation (create/update)

| Rule | Message |
|---|---|
| Missing SE | “Please assign an SE.” |
| Empty name | “Please enter a route name.” |
| Incomplete location block | “Complete all location fields and select villages.” |

### 7.3 Error handling

| Operation | Behavior |
|---|---|
| Load failure | Destructive toast with message |
| Save failure | “Error saving route” + message |
| Delete failure | “Error deleting route” + message |
| Analytics failure | “Analytics Error” + message |
| Map polygon fetch failure | `console.error` only (**Verified** L225–227) — silent empty possible |

### 7.4 Server validation V2 should add (**Inferred** / **New**)

- AuthN + module authZ  
- SE role check  
- Non-empty locations  
- Reject mutate of synthetic others id  
- Optional: village existence against location master  
- Optional: assignment conflict policy  

---

## 8. Export / analytics requirements

| Export | Module | Mechanism | Backend needed? |
|---|---|---|---|
| Territory Analytics PDF | Routes | Browser print HTML | No for parity; optional V2 |
| Product analytics | Routes | On-screen only | No export button |
| Farmers CSV/PDF with Route Name | Farmers | Client CSV using village→route index | Index API sufficient |
| Attendance monthly CSV | Attendance | Client | Out of Routes scope |
| GPS path export | — | **Not found** | |

### Analytics cards / charts

**Verified:** No KPI cards or chart library on RoutesPage. “Analytics” = metric **tables**. No drill-down API beyond opening TerritoryViewSheet levels.

Dashboard KPI “Active SEs in territory” (`Dashboard.tsx`) is a count of SEs linking to `/sales-executives`, not Routes analytics — shared dependency only by naming.

---

## 9. Missing, mocked, or ambiguous behavior

| Item | Label | Notes |
|---|---|---|
| Typed Supabase schema for `routes` | **Missing** | `types.ts` stub |
| SQL migration for `routes` in repo | **Missing** | Table used at runtime |
| Mock route data / MSW | **Not found** | Live Supabase only |
| Waypoints / visit order / stop coords | **Missing** in legacy Routes | **New V2 requirement** |
| Planned route geometry | **Missing** | **New V2 requirement** |
| Followed geometry in Routes UI | **Missing** | Exists in Attendance |
| Quantitative adherence % / deviation km | **Missing** | Qualitative mismatch badges in Attendance only |
| Assignment history | **Missing** | |
| Soft unassign | **Missing** | Delete used instead |
| Bulk actions | **Missing** | |
| Server search/filter on SE table | **Missing** | Client page only |
| Date filters on Routes analytics | **Missing** | |
| Route-level audit log | **Missing** | |
| `other_villages` write path | **Ambiguous** | Read aliases exist; builder does not write them |
| Manage sheet actions on Others route | **Ambiguous / bug risk** | Edit/Delete shown |
| Demo SE in builder vs list | **Ambiguous** | Inconsistent filters |
| District list not filtered by selected state | **Verified** UI quirk | All districts loaded regardless of state |
| `temp_dealers` not scoped by SE | **Verified** | Global table filtered by village name |
| Overlapping village ownership | **Ambiguous** | No enforcement |
| Whether mobile app stores `assigned_route_id` on punch-in | **Inferred** | Admin only reads it |

---

## 10. V2 API coverage checklist

Use this checklist endpoint-by-endpoint and field-by-field against OpenAPI/Postman.

### A. Core route resources

- [ ] `GET /v2/territory-routes/executives`
  - [ ] Query: `includeDemo`, `page`, `pageSize`, `sort`, `search?`, `includeOrphanRoute?`
  - [ ] Item fields: `id`, `name`, `routes[]`, `totalVillageCount?`
  - [ ] Route fields: `id`, `name`, `seId`, `locations[]`, `otherVillages?`, `isCustomOthers?`, `createdBy?`, timestamps?
  - [ ] LocationBlock: `state`, `district`, `taluka`, `villages[]`, `otherVillages?`
  - [ ] Auth: `routes.can_view`
  - [ ] Empty / error parity
- [ ] `GET /v2/territory-routes/routes/{routeId}`
  - [ ] 404 handling
  - [ ] Same route field set as above
- [ ] `POST /v2/territory-routes/routes`
  - [ ] Body: `name`, `seId`, `locations[]`
  - [ ] Validation errors for missing SE/name/incomplete blocks
  - [ ] Sets `createdBy` from auth
  - [ ] Auth: `routes.can_edit`
- [ ] `PUT /v2/territory-routes/routes/{routeId}`
  - [ ] Body: `name`, `seId`, `locations[]`
  - [ ] Reassign changes `seId`
  - [ ] Auth: `routes.can_edit`
- [ ] `DELETE /v2/territory-routes/routes/{routeId}`
  - [ ] Hard delete parity
  - [ ] Auth: `routes.can_edit`
  - [ ] Reject synthetic others id

### B. Assignment extensions (confirm with product)

- [ ] `POST /v2/territory-routes/routes/{routeId}/assign` body `{ seId }`
- [ ] `POST /v2/territory-routes/routes/{routeId}/unassign` (soft)
- [ ] `GET /v2/territory-routes/routes/{routeId}/assignment-history`
  - [ ] Fields: `action`, `fromSeId`, `toSeId`, `changedBy`, `changedAt`
- [ ] `GET /v2/territory-routes/routes/{routeId}/audit`

### C. Stops / waypoints (**New V2** — only if in scope)

- [ ] `GET/PUT/POST/PATCH/DELETE .../stops`
- [ ] `POST .../stops/reorder` with `orderedStopIds`
- [ ] Stop fields: `id`, `sequence`, `name`, `latitude`, `longitude`, `villageName?`, `outletId?`

### D. Lookups (shared)

- [ ] `GET /v2/executives?role=SE&includeDemo=`
- [ ] `GET /v2/locations/districts` → `id`,`name`
- [ ] `GET /v2/locations/talukas?districtId=` → `id`,`name`,`districtId`
- [ ] `GET /v2/locations/villages?talukaId=` → `id`,`name`,`talukaId`
- [ ] States: document hardcoded list vs master API

### E. Territory view aggregate

- [ ] `GET /v2/territory-routes/executives/{seId}/territory-view`
  - [ ] `routes` (+ optional others)
  - [ ] `farmers[]` with draft/submitted + FSPP/farm details + flags
  - [ ] `farmCards[]` polygons + status
  - [ ] `farmDiaries[]` polygons + visits products
  - [ ] `dealers[]` normalized fields

### F. Analytics

- [ ] `GET /v2/territory-routes/analytics/territory`
  - [ ] Scopes: global / executive / route / village
  - [ ] All metric keys in §4.11
  - [ ] TOTAL column semantics
  - [ ] Optional `from`/`to`
- [ ] `GET /v2/territory-routes/analytics/products`
  - [ ] Product+unit rows; count; qty; %; TOTAL column
- [ ] `GET /v2/territory-routes/analytics/territory/export?format=pdf|csv` (optional)
- [ ] `GET /v2/territory-routes/analytics/adherence` (**New V2**)
  - [ ] Documented metric definitions

### G. Maps / geometry

- [ ] `GET /v2/territory-routes/maps/farm-polygons`
  - [ ] Filters: global / seId / routeId / village
  - [ ] Feature: `id`,`title`,`type`,`coords`
  - [ ] Coord format contract documented
- [ ] `GET /v2/territory-routes/routes/{routeId}/geometry/planned` (**New V2**)
- [ ] Shared: `GET /v2/attendance/shifts/{shiftId}/gps-path`
- [ ] Shared: `GET /v2/attendance/shifts/{shiftId}/route-context`

### H. Cross-module index

- [ ] `GET /v2/territory-routes/village-route-index`
  - [ ] Lowercased village keys → route name
  - [ ] Conflict policy documented

### I. Permissions

- [ ] Server enforces `routes.can_view` / `can_edit`
- [ ] TH / Super Admin bypass parity
- [ ] 403 vs empty-state behavior documented

### J. Non-goals / explicitly out of legacy Routes parity

- [ ] Confirm beat/journey/tour plan APIs are **out of scope** unless newly specified
- [ ] Confirm bulk APIs are optional
- [ ] Confirm quantitative adherence is new scope, not regression of RoutesPage

---

## 11. Questions requiring product / backend confirmation

1. **Domain model:** Should V2 keep routes as **village territory packs**, or evolve into **ordered GPS stop plans**? Legacy only implements the former.  
2. **Unassign vs delete:** Keep hard delete, or introduce soft unassign + retain history?  
3. **Assignment history / audit:** Required for V2 compliance, or out of scope?  
4. **Stops & coordinates:** Are outlet/village lat-long and visit order in V2 MVP? If yes, what is the source of truth (manual pin, geocode, outlet master)?  
5. **Planned geometry:** Derived from stop order, or separately drawn polygons/polylines?  
6. **Adherence metrics:** Exact formulas for followed-vs-planned, deviation, visit completion, distance — Attendance qualitative badges are the only legacy reference.  
7. **Orphan “Others” route:** Compute on backend, frontend, or both? Should Manage UI hide edit/delete for it?  
8. **Demo SEs:** Allow assignment in builder while hidden from list (legacy), or unify?  
9. **Village uniqueness:** Can two SEs / routes share the same village name? What should village→route index return?  
10. **Location identity:** Continue storing names in JSON, or switch to `districtId`/`talukaId`/`villageId` FKs?  
11. **States master:** Keep hardcoded 7 states or serve from API / Location Master?  
12. **Analytics performance:** Replace client 1000-row paging fan-out with server aggregates? Required SLAs?  
13. **Date filters on territory/product analytics:** Needed for V2?  
14. **`temp_dealers`:** Formalize schema and SE scoping, or replace with real dealers module?  
15. **`other_villages` fields:** Are they still written by mobile apps? Should V2 write/read a single canonical field?  
16. **PDF export:** Server-generated vs keep browser print?  
17. **Google Snap-to-Roads:** Move server-side (key protection) for shared GPS path API?  
18. **Permissions:** Will V2 keep binary `can_view`/`can_edit`, or finer actions (export, analytics-only, assign-only)?  

---

## Appendix A — Legacy Supabase call inventory (Territory Routes + direct dependents)

| # | Call | File:lines | Used for |
|---|---|---|---|
| 1 | `profiles.select(id,name,is_demo, routes!routes_se_id_fkey(*)).eq(role,SE).or(is_demo...).order(name)` | `RoutesPage.tsx` 85–90 | SE+routes list |
| 2 | `farmers.select(se_id,village).eq(status,SUBMITTED)` paged | `RoutesPage.tsx` 99–110 | Orphan villages |
| 3 | `drafts.select(se_id,draft_data).eq(entity_type,farmer)` paged | `RoutesPage.tsx` 113–124 | Orphan villages |
| 4 | `farm_cards.select(id,boundary_polygon,farmers!inner(full_name))` | `RoutesPage.tsx` 196 | Global map |
| 5 | `farm_diary.select(id,diary_polygon,farm_name,farmers!inner(full_name))` | `RoutesPage.tsx` 197 | Global map |
| 6 | `farmers.select(*)` paged | `RoutesPage.tsx` 245–251 | Global analytics |
| 7 | `drafts.select(*).eq(entity_type,farmer)` paged | `RoutesPage.tsx` 254–261 | Global analytics |
| 8 | `farm_cards.select(id,se_id,status)` paged | `RoutesPage.tsx` 264–271 | Global analytics |
| 9 | `farm_diary.select(id,farmer_id,mandatory_base_visits(...))` paged | `RoutesPage.tsx` 274–280 | Global products |
| 10 | `routes.delete().eq(id)` | `RoutesPage.tsx` 356 | Unassign/delete |
| 11 | `profiles.select(id,name).eq(role,SE)` | `RouteBuilderDialog.tsx` 88 | SE options |
| 12 | `routes.update({name,locations,se_id})` | `RouteBuilderDialog.tsx` 132–139 | Edit/reassign |
| 13 | `routes.insert({name,locations,se_id,created_by})` | `RouteBuilderDialog.tsx` 145–152 | Create |
| 14 | `districts.select(*)` | `RouteBuilderDialog.tsx` 235 | Cascading UI |
| 15 | `talukas.select(*).eq(district_id)` | `RouteBuilderDialog.tsx` 248 | Cascading UI |
| 16 | `villages.select(*).eq(taluka_id)` | `RouteBuilderDialog.tsx` 260 | Cascading UI |
| 17 | `farmers` / `drafts` / `farm_cards` / `temp_dealers` / `farm_diary+visits` | `TerritoryViewSheet.tsx` 570–588 | Drill-down |
| 18 | `routes.select(name,locations)` | `FarmersPage.tsx` 34 | Village→route |
| 19 | `routes.select(id,name,locations).eq(se_id)` | `AttendanceTimelineSheet.tsx` 168–171 | Punch-in / working route |
| 20 | `shift_locations.select(lat,lng).eq(shift_id)` | `AttendanceTimelineSheet.tsx` 124–128 | Followed path |
| 21 | External `roads.googleapis.com/v1/snapToRoads` | `AttendanceTimelineSheet.tsx` 146 | Snapped geometry |

---

## Appendix B — Label quick reference

| Label | Meaning |
|---|---|
| **Verified** | Observed directly in legacy source behavior |
| **Inferred** | Reasonable API packaging of verified behavior; path/shape not in legacy |
| **Mocked** | Would mean fake/hardcoded API data — **none found** for routes CRUD |
| **Partially implemented** | UI hint or incomplete handling (e.g. delete labeled unassign; Others edit risk) |
| **New V2 requirement** | Asked for V2 / needed for stated goals but **not** present as Territory Routes legacy behavior |

---

*End of audit.*
