# WEB Test Scenarios — territory-routes

**Module ID**: `territory-routes`  
**Layer**: WEB  
**Primary sources analyzed**:
- `src/pages/RoutesPage.tsx`
- `src/components/RouteBuilderDialog.tsx` (+ `LocationRow`)
- `src/components/SERoutesSheet.tsx`
- `src/components/TerritoryViewSheet.tsx` (`AnalyticsTable`, `ProductAnalyticsTable`)
- `src/components/PolygonMap.tsx`
- `src/hooks/useAuth.ts` / `src/hooks/usePermissions.ts`

**UI Entry**: `/routes`  
**Permission module key**: `routes`

**Code notes**:
- List excludes demo SEs: `is_demo.eq.false` OR `is_demo.is.null`.
- Synthetic route `Others (Out of Route)` (`is_custom_others: true`, id `others-custom-route`) is UI-only; not a DB row.
- Global Map / Overall Analytics / Product Analysis buttons are **not** gated by `can_edit` (only Create & Assign + Manage Routes are).
- `FarmerDetailSheet` from territory view opens with `canEdit={false}`.

---

# Test Scenario: Territory Routes — Access Gate

## Operation Overview
- **Module ID**: territory-routes
- **UI Entry**: `/routes`
- **Primary files**: `src/pages/RoutesPage.tsx`
- **Handler / function**: `getModulePerm('routes')`
- **API / data ops**: via `usePermissions`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. `authLoading || permLoading` → full-screen spinner
2. `!routesAccess.can_view` → Access Denied (title only)
3. `fetchSEsAndRoutes` only when `can_view`
4. Create & Assign / Manage Routes require `can_edit`

## Test Cases

### Success Scenarios

#### WEB-TC-001: User with routes.can_view sees Territory Routes
- **Code Path**: permission check → main UI → `fetchSEsAndRoutes`
- **Based On**: `RoutesPage.tsx`
- **Preconditions**: `routesAccess.can_view === true`
- **Expected UI behavior**: Heading "Territory Routes"; table and global action buttons

### Business Logic Failure / Branch Scenarios

#### WEB-TC-002: Auth/perm loading shows spinner
- **Condition**: `authLoading || permLoading`
- **Expected UI behavior**: Centered spinner

#### WEB-TC-003: Missing can_view shows Access Denied
- **Condition**: `!routesAccess.can_view`
- **Expected UI behavior**: Access Denied; list fetch not started by can_view effect

#### WEB-TC-004: can_edit false hides Create and Manage Routes
- **Condition**: `can_view` true, `can_edit` false
- **Expected UI behavior**: No "Create & Assign Route"; no "Manage Routes" per row; "View Territories" still available

#### WEB-TC-005: can_edit true shows Create & Assign and Manage Routes
- **Condition**: `routesAccess.can_edit`
- **Expected UI behavior**: Both create and manage controls visible

---

# Test Scenario: Territory Routes — List SEs and Routes

## Operation Overview
- **Module ID**: territory-routes
- **UI Entry**: Main table after `can_view`
- **Primary files**: `src/pages/RoutesPage.tsx`
- **Handler / function**: `fetchSEsAndRoutes`
- **API / data ops**:
  - `profiles.select('id, name, is_demo, routes!routes_se_id_fkey(*)').eq('role','SE').or('is_demo.eq.false,is_demo.is.null').order('name')`
  - Paginated `farmers` (`status=SUBMITTED`, `se_id,village`) in ranges of 1000
  - Paginated `drafts` (`entity_type=farmer`) for orphan village detection
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Routes per SE sorted by name (numeric-aware)
2. Official villages from `extractAllRouteVillages` (locations.villages + otherVillages variants)
3. Orphan farmer/draft villages (case-insensitive) → append synthetic `Others (Out of Route)`
4. Empty: `No SEs found.`
5. Total Villages column: sum of `loc.villages.length` (Others uses first location villages length)
6. Pagination `ITEMS_PER_PAGE = 10`; resets to page 1 on fetch
7. Refresh keeps `selectedSheetSE` in sync if still present

### Error / Edge Paths Handled in UI
1. Catch → toast `Failed to load routes` / `err.message`
2. Farmer/draft range loops `break` on error (no toast for those partial failures)

## Test Cases

### Success Scenarios

#### WEB-TC-006: Load non-demo SEs with assigned routes
- **Code Path**: `fetchSEsAndRoutes` → table
- **Based On**: `RoutesPage.tsx`
- **Preconditions**: `can_view`
- **Expected UI behavior**: SE rows with route chips; "No routes assigned" when empty routes
- **Expected API call**: profiles SE query excluding demo + paginated farmers/drafts

#### WEB-TC-007: Orphan villages appear as Others (Out of Route)
- **Condition**: farmer/draft village not in official route villages (case-insensitive)
- **Expected UI behavior**: Amber-styled chip `Others (Out of Route)` appended to that SE’s routes

#### WEB-TC-008: Empty SE list message
- **Condition**: `seList.length === 0`
- **Expected UI behavior**: `No SEs found.`

#### WEB-TC-009: Pagination previous/next with 10 per page
- **Based On**: `ITEMS_PER_PAGE = 10`
- **Preconditions**: more than 10 SEs
- **Expected UI behavior**: Prev disabled on page 1; Next disabled on last; showing X–Y of Z

### Business Logic Failure / Branch Scenarios

#### WEB-TC-010: Load failure toast
- **Condition**: profiles query throws / profilesError
- **Expected UI behavior**: Toast `Failed to load routes`

---

# Test Scenario: Territory Routes — Create Route (RouteBuilderDialog)

## Operation Overview
- **Module ID**: territory-routes
- **UI Entry**: Create & Assign Route
- **Primary files**: `src/components/RouteBuilderDialog.tsx`
- **Handler / function**: `handleSave` (insert branch)
- **API / data ops**:
  - On open: `profiles.select('id,name').eq('role','SE').order('name')`
  - LocationRow: `districts`, `talukas` by district_id, `villages` by taluka_id
  - Insert: `routes.insert({ name, locations, se_id, created_by: session.user.id })`
- **Layer**: WEB

## Code Analysis

### Validations Found in Code
1. `!selectedSe` → toast `Please assign an SE.`
2. `!routeName.trim()` → toast `Please enter a route name.`
3. Every location must have `state && district && taluka && villages.length > 0` → `Complete all location fields and select villages.`
4. Route Name Input also has HTML `required`

### Business Logic Found in Code
1. Create default: one block with `state: 'Gujarat'`, empty district/taluka/villages
2. State/district/taluka changes cascade-clear children
3. Can add multiple blocks; remove only if `locations.length > 1`
4. Villages multi-select + Select All
5. District select disabled until state / while districts loading
6. Taluka disabled until district; villages until taluka
7. Success toast: `Success!` / `Route created and assigned directly to SE.`; `onSuccess` + close
8. Clean payload strips block `id`: `{ state, district, taluka, villages }`

## Test Cases

### Success Scenarios

#### WEB-TC-011: Open create dialog loads SE options and default Gujarat block
- **Code Path**: Create → dialog open effect
- **Based On**: `RouteBuilderDialog` useEffect when `!editData`
- **Preconditions**: `can_edit`
- **Expected UI behavior**: Title "Build & Assign Route"; empty name; one territory block state Gujarat
- **Expected API call**: SE profiles list; districts load in LocationRow

#### WEB-TC-012: Cascading district → taluka → villages from Location Master tables
- **Based On**: `LocationRow` effects
- **User steps**: Pick state → district → taluka → villages
- **Expected API call**: `talukas.eq('district_id', match.id)`; `villages.eq('taluka_id', match.id)`
- **Expected UI behavior**: Child fields reset when parent changes; village picker disabled until taluka

#### WEB-TC-013: Create valid route inserts and refreshes list
- **Code Path**: Save → insert → onSuccess
- **Preconditions**: SE, name, all blocks complete with ≥1 village
- **Expected UI behavior**: Toast `Route created and assigned directly to SE.`; dialog closes; list refreshes
- **Expected API call**: `routes.insert({ name: trim, locations: cleanLocations, se_id, created_by })`

#### WEB-TC-014: Add/remove territory blocks
- **Condition**: add always; remove only if `canRemove` (`locations.length > 1`)
- **Expected UI behavior**: Second block can be removed; last remaining block has no remove control

#### WEB-TC-015: Select All villages checks all for taluka
- **Based On**: Checkbox Select All
- **Expected UI behavior**: Checked → all `dbVillages` names; unchecked → `[]`

### Validation Failure Scenarios

#### WEB-TC-016: Missing SE assignment blocked
- **Validation Rule**: `!selectedSe`
- **Expected UI behavior**: Toast `Validation Error` / `Please assign an SE.`

#### WEB-TC-017: Missing route name blocked
- **Validation Rule**: `!routeName.trim()`
- **Expected UI behavior**: Toast `Please enter a route name.`

#### WEB-TC-018: Incomplete location block blocked
- **Validation Rule**: not every block has state/district/taluka/villages.length>0
- **Expected UI behavior**: Toast `Complete all location fields and select villages.`

### Business Logic Failure / Branch Scenarios

#### WEB-TC-019: Insert error toast
- **Condition**: insert throws
- **Expected UI behavior**: Toast `Error saving route` / `err.message`

#### WEB-TC-020: Cancel closes without save
- **User steps**: Cancel
- **Expected UI behavior**: Dialog closes via `onOpenChange(false)`; no insert from cancel

---

# Test Scenario: Territory Routes — Edit Route

## Operation Overview
- **Module ID**: territory-routes
- **UI Entry**: Manage Routes → Edit → Save Changes
- **Primary files**: `RoutesPage.openEditDialog`, `RouteBuilderDialog` update branch
- **Handler / function**: `handleSave` when `editData` set
- **API / data ops**: `routes.update({ name, locations, se_id }).eq('id', editData.id)`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. `openEditDialog` sets editData from route, clears `selectedSheetSE`, opens builder
2. Prefills name, SE, locations (new UUIDs per block)
3. Success toast: `Updated!` / `Route has been updated successfully.`

## Test Cases

### Success Scenarios

#### WEB-TC-021: Edit route updates name/locations/SE
- **Code Path**: Manage → Edit → Save Changes
- **Based On**: update branch in `handleSave`
- **Preconditions**: `can_edit`; valid form
- **Expected UI behavior**: Toast Updated; dialog closes; list refresh
- **Expected API call**: `routes.update({ name, locations, se_id }).eq('id', editData.id)`

---

# Test Scenario: Territory Routes — Manage / Unassign Route

## Operation Overview
- **Module ID**: territory-routes
- **UI Entry**: Manage Routes sheet
- **Primary files**: `src/components/SERoutesSheet.tsx`, `RoutesPage.handleUnassignRoute`
- **Handler / function**: `onUnassignRoute` → `routes.delete`
- **API / data ops**: `from('routes').delete().eq('id', routeId)`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Sheet shows SE name + route count; lists location blocks with village badges
2. Empty: `No routes assigned.`
3. Edit/Trash icons only if `canEdit`
4. Delete confirm: `Are you sure you want to remove this route from the SE?`
5. Success: toast `Route Removed` / `The territory has been deleted successfully.` + refetch
6. Error: toast `Error deleting route`

### Permissions / Visibility
1. Manage Routes button gated by page `can_edit`; icons also check `canEdit` prop

## Test Cases

### Success Scenarios

#### WEB-TC-022: Manage Routes opens SERoutesSheet
- **User steps**: Click Manage Routes
- **Expected UI behavior**: Sheet `{se.name}'s Territories` with routes/locations/villages

#### WEB-TC-023: Confirm unassign deletes route
- **Code Path**: Trash → confirm → delete → fetch
- **Based On**: `handleUnassignRoute`
- **Preconditions**: confirm OK
- **Expected UI behavior**: Toast `Route Removed`; list refreshes
- **Expected API call**: `routes.delete().eq('id', routeId)`

### Business Logic Failure / Branch Scenarios

#### WEB-TC-024: Cancel unassign confirm does not delete
- **Condition**: `confirm` false
- **Expected UI behavior**: No delete call

#### WEB-TC-025: Delete error toast
- **Condition**: delete returns error
- **Expected UI behavior**: Toast `Error deleting route` / `error.message`

#### WEB-TC-026: Without canEdit hide edit/delete icons in sheet
- **Condition**: `canEdit` false (if sheet opened)
- **Expected UI behavior**: Route cards without Edit/Trash

---

# Test Scenario: Territory Routes — View Territories Drill-Down

## Operation Overview
- **Module ID**: territory-routes
- **UI Entry**: View Territories
- **Primary files**: `src/components/TerritoryViewSheet.tsx`
- **Handler / function**: `fetchAllFarmersInTerritory` + level navigation
- **API / data ops** (on open):
  - `farmers` submitted for `se_id`
  - `drafts` farmer for `se_id`
  - `farm_cards` for `se_id`
  - `temp_dealers` select `*`
  - `farm_diary` with `mandatory_base_visits` for farmer ids
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Levels: `routes` → `villages` → `farmers` with back button
2. Rebuilds Others route from orphan villages among combined farmers
3. Per level tabs: list/dealers/analytics/products/map
4. Dealers matched from `temp_dealers` by village name (case-insensitive; flexible field names)
5. Farmer click opens `FarmerDetailSheet` with `canEdit={false}`
6. Map polygons from farm_cards.boundary_polygon / farm_diary.diary_polygon length > 2
7. Empty dealers messages at route/village/farmer levels as coded

## Test Cases

### Success Scenarios

#### WEB-TC-027: Open View Territories loads SE territory data
- **Code Path**: View Territories → sheet open → fetch
- **Based On**: `TerritoryViewSheet` useEffect
- **Expected UI behavior**: Loading then routes list for SE; title shows SE name
- **Expected API call**: farmers/drafts/farm_cards/temp_dealers (+ farm_diary if farmer ids)

#### WEB-TC-028: Drill route → villages → farmers
- **User steps**: Click route → click village
- **Expected UI behavior**: Level changes; back navigates farmers→villages→routes; titles update

#### WEB-TC-029: Route/village dealers tabs filter temp_dealers by village
- **Based On**: `getDealersForVillage` / `getDealersForRoute`
- **Expected UI behavior**: Cards when matches exist; else empty messages coded for that level

#### WEB-TC-030: Analytics / Products tabs render tables for current scope
- **Based On**: `AnalyticsTable` / `ProductAnalyticsTable` entity builders
- **Expected UI behavior**: Metrics/product usage for routes (or villages/farmers at deeper levels); empty product copy `No product data found in visit logs.` when no rows

#### WEB-TC-031: Map tab shows polygons for scoped farmers
- **Based On**: `getPolygonsForFarmers` + `PolygonMap`
- **Expected UI behavior**: Farm Card (green) / Farm Diary (blue) polygons when coords length > 2; else PolygonMap empty state

#### WEB-TC-032: Click farmer opens FarmerDetailSheet read-only
- **Expected UI behavior**: Detail sheet open; `canEdit={false}`

#### WEB-TC-033: AnalyticsTable Download PDF opens print window
- **Based On**: `exportToPDF` in `AnalyticsTable`
- **User steps**: Click Download PDF (when table rendered)
- **Expected UI behavior**: Print window with Territory Analytics Export (silent return if popup blocked)

---

# Test Scenario: Territory Routes — Global Map

## Operation Overview
- **Module ID**: territory-routes
- **UI Entry**: View Global Map
- **Primary files**: `RoutesPage.handleOpenGlobalMap`, `PolygonMap`
- **Handler / function**: `handleOpenGlobalMap`
- **API / data ops**: parallel `farm_cards` (boundary_polygon + farmers.full_name), `farm_diary` (diary_polygon, farm_name, farmers.full_name)
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Include polygon only if array length > 2
2. Loading copy: `Plotting global farm data...`
3. Fetch errors only `console.error` (no toast)
4. Renders `PolygonMap` with collected features

## Test Cases

### Success Scenarios

#### WEB-TC-034: Global map loads qualifying farm card/diary polygons
- **Code Path**: button → fetch → PolygonMap
- **Based On**: `handleOpenGlobalMap`
- **Expected UI behavior**: Dialog "Global Territory Map"; spinner then map
- **Expected API call**: farm_cards + farm_diary selects as coded

#### WEB-TC-035: No polygons shows empty map message
- **Condition**: `polygons.length === 0` in `PolygonMap`
- **Expected UI behavior**: `No farm boundaries mapped in this area yet.`

---

# Test Scenario: Territory Routes — Overall Analytics & Product Analysis

## Operation Overview
- **Module ID**: territory-routes
- **UI Entry**: Overall Analytics / Product Analysis buttons
- **Primary files**: `RoutesPage.handleOpenGlobalAnalytics`
- **Handler / function**: shared fetch then different dialogs
- **API / data ops**: paginated farmers `*`, farmer drafts, farm_cards `id,se_id,status`, farm_diary with `mandatory_base_visits`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Builds per-SE analytics entities from current `seList` + fetched data
2. Overall dialog uses `AnalyticsTable`
3. Product dialog prepends `{ name: 'TOTAL (ALL)', visits: flatMap all SE visits }` then SE entities to `ProductAnalyticsTable`
4. Empty: `No active territory data found.`
5. Error toast: `Analytics Error` / `error.message`

## Test Cases

### Success Scenarios

#### WEB-TC-036: Overall Analytics compiles and shows AnalyticsTable
- **Code Path**: Overall Analytics → fetch → dialog
- **Based On**: `handleOpenGlobalAnalytics` + `isAnalyticsOpen`
- **Expected UI behavior**: Loading "Compiling global data..."; then performance table (or empty state)

#### WEB-TC-037: Product Analysis shows ProductAnalyticsTable with TOTAL column
- **Code Path**: Product Analysis → same fetch → products dialog
- **Expected UI behavior**: Loading product copy; table with TOTAL (ALL) + per-SE columns when visit product data exists

### Business Logic Failure / Branch Scenarios

#### WEB-TC-038: Analytics fetch error toast
- **Condition**: throw in `handleOpenGlobalAnalytics`
- **Expected UI behavior**: Toast `Analytics Error` / `error.message`; loading cleared

---

# Test Scenario: PolygonMap — Renderer Branches

## Operation Overview
- **Module ID**: territory-routes
- **UI Entry**: Any map surface using `PolygonMap`
- **Primary files**: `src/components/PolygonMap.tsx`
- **Handler / function**: render branches
- **API / data ops**: Google Maps JS loader (`VITE_GOOGLE_MAPS_API_KEY`); OSM tiles on Leaflet fallback
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Empty polygons → dashed empty message
2. `loadError || localhost/127.0.0.1` → Leaflet fallback
3. Invalid leaflet center NaN → `Invalid coordinate data detected.`
4. Else wait `isLoaded` then Google Map hybrid; click polygon → InfoWindow
5. Legend Farm Card / Farm Diary always on map UIs

## Test Cases

### Success Scenarios

#### WEB-TC-039: Non-local Google path shows GoogleMap when loaded
- **Condition**: not local host, no loadError, `isLoaded`
- **Expected UI behavior**: Google hybrid map; polygon click shows title/type InfoWindow

### Business Logic Failure / Branch Scenarios

#### WEB-TC-040: Localhost or loadError uses Leaflet fallback
- **Condition**: `isLocalDev || loadError`
- **Expected UI behavior**: OSM Leaflet map with popups; legend visible

#### WEB-TC-041: Invalid leaflet center shows error text
- **Condition**: NaN lat/lng after normalize
- **Expected UI behavior**: `Invalid coordinate data detected.`

---

## Backend/App Mapping Hints

| WEB-TC | Operation key |
|--------|----------------|
| WEB-TC-001 | view_territory_routes |
| WEB-TC-002 | routes_page_loading |
| WEB-TC-003 | deny_routes_without_can_view |
| WEB-TC-004 | hide_route_mutations_without_can_edit |
| WEB-TC-005 | show_route_mutations_with_can_edit |
| WEB-TC-006 | list_se_routes |
| WEB-TC-007 | append_others_out_of_route |
| WEB-TC-008 | list_se_routes_empty |
| WEB-TC-009 | paginate_se_routes |
| WEB-TC-010 | list_se_routes_error |
| WEB-TC-011 | open_create_route_dialog |
| WEB-TC-012 | cascade_route_location_blocks |
| WEB-TC-013 | create_route |
| WEB-TC-014 | add_remove_territory_block |
| WEB-TC-015 | select_all_villages |
| WEB-TC-016 | validate_route_se_required |
| WEB-TC-017 | validate_route_name_required |
| WEB-TC-018 | validate_route_locations_complete |
| WEB-TC-019 | create_route_error |
| WEB-TC-020 | cancel_route_dialog |
| WEB-TC-021 | update_route |
| WEB-TC-022 | open_manage_routes_sheet |
| WEB-TC-023 | delete_route |
| WEB-TC-024 | delete_route_cancel |
| WEB-TC-025 | delete_route_error |
| WEB-TC-026 | hide_manage_route_actions |
| WEB-TC-027 | view_territories_load |
| WEB-TC-028 | drill_route_village_farmer |
| WEB-TC-029 | view_temp_dealers_by_village |
| WEB-TC-030 | territory_analytics_products_tabs |
| WEB-TC-031 | territory_scoped_map |
| WEB-TC-032 | open_farmer_detail_readonly |
| WEB-TC-033 | export_analytics_pdf |
| WEB-TC-034 | view_global_map |
| WEB-TC-035 | global_map_empty |
| WEB-TC-036 | overall_analytics |
| WEB-TC-037 | product_analysis |
| WEB-TC-038 | analytics_error |
| WEB-TC-039 | polygon_map_google |
| WEB-TC-040 | polygon_map_leaflet_fallback |
| WEB-TC-041 | polygon_map_invalid_coords |
