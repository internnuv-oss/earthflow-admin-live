# WEB Test Scenarios — farmers

**Module ID**: `farmers`  
**Layer**: WEB  
**Primary sources analyzed**:
- `src/pages/FarmersPage.tsx`
- `src/components/FarmerTable.tsx` (`getFarmerStage`, `StageProgressBar`)
- `src/components/FarmerDetailSheet.tsx`
- `src/components/FarmerMapView.tsx`
- `src/components/DataTable.tsx`
- `src/hooks/useAuth.ts` / `src/hooks/usePermissions.ts`

**UI Entry**: `/farmers`  
**Permission module key**: `farmers`

**Code notes**:
- No create/delete farmer in this UI.
- `FarmerTable` forwards `onFilteredDataChange` (exports/map use filtered set).
- Edit button uses **`hasEditAccess = getModulePerm('farmers').can_edit`**, not the `canEdit` prop (prop is unused for the Edit button).
- `villageToSE` state is never populated (`setVillageToSE` unused) → Full CSV / PDF “Assigned SE” falls back to `Unassigned`.
- `FarmersPage` does **not** pass `onSaved` to the sheet → save success toasts but does not reload/close via `onSaved`.
- Stage: `has_farm_card` → Farm Card; else non-empty `fspp_details` → FSPP; else Onboarding.

---

# Test Scenario: Farmers — Access Gate

## Operation Overview
- **Module ID**: farmers
- **UI Entry**: `/farmers`
- **Primary files**: `src/pages/FarmersPage.tsx`
- **Handler / function**: `getModulePerm('farmers')`
- **API / data ops**: via `usePermissions`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. `authLoading || permLoading` → full-screen spinner
2. `!farmerAccess.can_view` → Access Denied + `You do not have permission to view the farmer directory.`

## Test Cases

### Success Scenarios

#### WEB-TC-001: User with farmers.can_view sees Farmer Directory
- **Code Path**: permission check → main UI
- **Based On**: `FarmersPage.tsx`
- **Preconditions**: `farmerAccess.can_view === true`
- **Expected UI behavior**: "Farmer Directory"; table/map toggle + exports when loaded

### Business Logic Failure / Branch Scenarios

#### WEB-TC-002: Auth/perm loading shows spinner
- **Condition**: `authLoading || permLoading`
- **Expected UI behavior**: Centered spinner

#### WEB-TC-003: Missing can_view shows Access Denied
- **Condition**: `!farmerAccess.can_view`
- **Expected UI behavior**: Access Denied for farmer directory

---

# Test Scenario: Farmers — List (Submitted + Drafts)

## Operation Overview
- **Module ID**: farmers
- **UI Entry**: Directory after `can_view`
- **Primary files**: `src/pages/FarmersPage.tsx`
- **Handler / function**: mount fetch loops + `fetchVillageMapping`
- **API / data ops**:
  - `routes.select('name, locations')` → village→route map
  - `profiles` SE names for filter
  - `farm_cards.select('farmer_id')` → `has_farm_card`
  - Chunked `farmers.select('*, profiles:se_id(name)')` range 1000
  - Chunked `drafts` `entity_type='farmer'` range 1000
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Draft mapped from `draft_data`; forced `status:'DRAFT'`; defaults Incomplete Farmer / `—`
2. Non-draft district/taluka overwritten from `personal_details.city` / `.taluka`
3. Combine + sort `created_at` desc
4. Farmer chunk error → toast `Failed to load farmers`
5. Draft chunk error → silent stop (no toast)

## Test Cases

### Success Scenarios

#### WEB-TC-004: Load merges farmers, drafts, farm-card flags, route map
- **Code Path**: page mount → setRows / setFilteredData
- **Based On**: `FarmersPage.tsx`
- **Preconditions**: `can_view`
- **Expected UI behavior**: Combined rows; stage can show Farm Card when id in farm_cards set
- **Expected API call**: routes + SE profiles + farm_cards + chunked farmers/drafts

#### WEB-TC-005: Incomplete draft name default
- **Based On**: `d.fullName || 'Incomplete Farmer'`
- **Expected UI behavior**: Name Incomplete Farmer (or Unnamed in table if null)

#### WEB-TC-006: Empty table message
- **Condition**: no rows after filters
- **Expected UI behavior**: `No farmers found.`

### Business Logic Failure / Branch Scenarios

#### WEB-TC-007: Farmers chunk error toast
- **Condition**: farmer select error
- **Expected UI behavior**: Toast `Failed to load farmers` / message; loop stops

---

# Test Scenario: Farmers — Table Filters, Search, Stage

## Operation Overview
- **Module ID**: farmers
- **UI Entry**: Table view
- **Primary files**: `src/components/FarmerTable.tsx`
- **Handler / function**: date filter + DataTable filters
- **API / data ops**: None (client-side)
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Date From/To on `created_at` (same day-bound logic as FPOs); Clear Dates
2. Filters: Status; Stage (**single-select** via `isSingleSelect`); District; Taluka; Village; Onboarded By
3. Stage predicate: `getFarmerStage(row) === values[0]`
4. Search: name, mobile, village, taluka, district, SE name
5. Route Name column from `villageToRoute[village.toLowerCase()]` or `Unassigned`
6. Status DRAFT → Saved Draft; SUBMITTED → default badge

## Test Cases

### Success Scenarios

#### WEB-TC-008: Date From/To and Clear Dates
- **Based On**: `dateFilteredRows`
- **Expected UI behavior**: Rows outside range excluded; Clear restores full set before other filters

#### WEB-TC-009: Search farmers
- **Based On**: `searchAccessor`
- **Expected UI behavior**: Case-insensitive includes on coded fields

#### WEB-TC-010: Filter Status / District / Taluka / Village / SE
- **Based On**: filter predicates
- **Expected UI behavior**: Matching rows only

#### WEB-TC-011: Single-select Stage filter
- **Condition**: `isSingleSelect: true`; predicate uses `values[0]`
- **User steps**: Select Onboarding / FSPP / Farm Card
- **Expected UI behavior**: Only rows whose `getFarmerStage` equals selected stage

#### WEB-TC-012: Stage badge derivation
- **Based On**: `getFarmerStage`
- **Expected UI behavior**: Farm Card / FSPP Checked / Onboarding badges per rules above

#### WEB-TC-013: Route Name shows mapped route or Unassigned
- **Based On**: `villageToRoute`
- **Expected UI behavior**: Primary-styled name when mapped; italic Unassigned otherwise

---

# Test Scenario: Farmers — Table / Map Toggle

## Operation Overview
- **Module ID**: farmers
- **UI Entry**: Table | Map tabs
- **Primary files**: `src/pages/FarmersPage.tsx`, `src/components/FarmerMapView.tsx`
- **Handler / function**: `viewMode` state
- **API / data ops**: Map may call Nominatim for missing villages
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Default `viewMode='table'`
2. Map receives `filteredData`; popup View Profile → `setSelected`
3. Empty map: `No farmers to display on map.`
4. Markers: DRAFT orange pin; else green
5. Geocode missing village keys via Nominatim (+ Gujarat); fallback district coords or Gujarat center; 1.2s delay between requests; progress UI
6. Scatter offset from farmer id hash

## Test Cases

### Success Scenarios

#### WEB-TC-014: Switch to Map shows filtered farmers
- **User steps**: Click Map tab
- **Expected UI behavior**: Leaflet map; markers for `filteredData`

#### WEB-TC-015: Switch back to Table
- **Expected UI behavior**: FarmerTable rendered again

#### WEB-TC-016: Empty filtered data on map
- **Condition**: `data.length === 0`
- **Expected UI behavior**: Empty map message

#### WEB-TC-017: Map popup View Profile opens detail
- **User steps**: Open marker popup → View Profile
- **Expected UI behavior**: `onViewDetails(farmer)` → detail sheet

#### WEB-TC-018: Locating missing villages progress banner
- **Condition**: villages not in HARDCODED_VILLAGES dictionary
- **Expected UI behavior**: Progress banner while Nominatim queue runs; then markers update

---

# Test Scenario: Farmers — Exports

## Operation Overview
- **Module ID**: farmers
- **UI Entry**: CSV / Full Data CSV / PDF when `!loading`
- **Primary files**: `src/pages/FarmersPage.tsx`
- **Handler / function**: `handleExportExcel`, `handleExportFullDataCSV`, `handleExportPDF`
- **API / data ops**: None — from `filteredData` + `villageToRoute` (+ unused `villageToSE`)
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Simple CSV: includes Route Name from `villageToRoute`; filename `farmers_export_<date>.csv`
2. Full Data CSV: dynamic cattle/tree/past-crop columns; bigha→acres (*0.4); yield tonnes/quintals→kg; BOM `\uFEFF`; filename `farmers_dynamic_analytics_<date>.csv`; Assigned SE uses empty `villageToSE` → Unassigned
3. PDF: Assigned SE also from `villageToSE` → Unassigned; popup blocked silent return

## Test Cases

### Success Scenarios

#### WEB-TC-019: Simple CSV export
- **Based On**: `handleExportExcel`
- **Expected UI behavior**: Download `farmers_export_<date>.csv` with route names

#### WEB-TC-020: Full Data CSV export with dynamic columns
- **Based On**: `handleExportFullDataCSV`
- **Expected UI behavior**: Download analytics CSV; cattle/tree/past crop columns present when data exists; land/yield unit conversions applied as coded

#### WEB-TC-021: PDF export print window
- **Based On**: `handleExportPDF`
- **Expected UI behavior**: Farmers Directory Export then print

### Business Logic Failure / Branch Scenarios

#### WEB-TC-022: PDF popup blocked — no toast
- **Condition**: `!printWindow`
- **Expected UI behavior**: Silent return

#### WEB-TC-023: Assigned SE column shows Unassigned (villageToSE empty)
- **Condition**: `villageToSE[safeVillage]` undefined
- **Expected UI behavior**: Full CSV / PDF Assigned SE = `Unassigned` under current code

---

# Test Scenario: Farmers — Detail Dashboard Navigation

## Operation Overview
- **Module ID**: farmers
- **UI Entry**: Row click / map View Profile
- **Primary files**: `src/components/FarmerDetailSheet.tsx`
- **Handler / function**: view state machine + nested fetches
- **API / data ops**:
  - On open: `farm_cards.select('*').eq('farmer_id', id)`
  - Farm card detail: `farm_diary.select('*').eq('farm_card_id', ...)`
  - Diary detail: `crop_observation_sessions` nested select + `sop_crop_stages` for crop
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Views: `dashboard` | `profile` | `fspp` | `farm_cards` | `farm_card_detail` | `farm_diary_detail`
2. Back: diary→card detail→cards→dashboard
3. Edit only on `view === 'profile' && hasEditAccess`
4. FSPP hub available from dashboard when `fspp_details` has keys

## Test Cases

### Success Scenarios

#### WEB-TC-024: Open farmer shows dashboard hub
- **Expected UI behavior**: Status badge; hub navigation cards; village · onboarded by

#### WEB-TC-025: Navigate Core Profile / FSPP / Farm Cards
- **User steps**: Click hub cards
- **Expected UI behavior**: Titles switch; farm cards list loads from API when cards view used

#### WEB-TC-026: Open farm card then diary then observations
- **Code Path**: farm_card_detail → farm_diary_detail
- **Expected UI behavior**: Diaries for card; observation sessions (+ SOP stages when crop id present); loadingObservations while fetching

#### WEB-TC-027: Back button navigates hierarchy
- **Based On**: `handleBack`
- **Expected UI behavior**: diary→card→cards→dashboard as coded

#### WEB-TC-028: Edit visible only on profile with farmers.can_edit
- **Condition**: `view === 'profile' && hasEditAccess`
- **Expected UI behavior**: Edit button shown; hidden if no module can_edit even if parent passed canEdit differently

---

# Test Scenario: Farmers — Edit Validation & Save

## Operation Overview
- **Module ID**: farmers
- **UI Entry**: Profile → Edit → Save
- **Primary files**: `src/components/FarmerDetailSheet.tsx`
- **Handler / function**: `validateForm`, `handleSave`
- **API / data ops**:
  - Draft: `drafts.update({ draft_data, updated_at, update_history }).or(id/entity_id)`
  - Submitted: `farmers.update({ full_name, mobile, village, personal_details, farm_details, history_details, update_history }).eq('id', id)`
- **Layer**: WEB

## Code Analysis

### Validations Found in Code
1. Full name trim length ≥ 2
2. Father name trim length ≥ 2
3. Mobile `/^\d{10}$/`
4. Alternate mobile optional; if set must 10 digits
5. Village / state / district(`pd.city`) / taluka trim length ≥ 2
6. Pincode optional; if set `/^\d{6}$/`
7. Total land required and `parseFloat > 0`
8. ≥1 major crop, soil type, water source
9. If soil/water/equipment includes `Others` → corresponding other* text required

### Business Logic Found in Code
1. While editing: load districts; cascade talukas by district name match; villages by taluka
2. Draft payload flattens form fields into `draft_data`
3. Success draft toast: `Farmer Draft updated successfully.`
4. Success submitted: `Farmer details updated successfully.`
5. Errors: `Failed to save draft` / `Failed to save`
6. Does not close sheet on save (no `onClose`); `onSaved` optional (not wired from page)

## Test Cases

### Success Scenarios

#### WEB-TC-029: Cascading district → taluka → village while editing
- **Based On**: location effects when `isEditing`
- **Expected API call**: `districts`; `talukas.eq('district_id')`; `villages.eq('taluka_id')`

#### WEB-TC-030: Valid draft save
- **Preconditions**: `status === 'DRAFT'`; validation passes
- **Expected UI behavior**: Toast draft success; exit editing
- **Expected API call**: drafts update `.or(id/entity_id)`

#### WEB-TC-031: Valid submitted save
- **Preconditions**: `status !== 'DRAFT'`; validation passes
- **Expected UI behavior**: Toast farmer updated; exit editing
- **Expected API call**: `farmers.update(...).eq('id', f.id)`

### Validation Failure Scenarios

#### WEB-TC-032: Full name too short
- **Expected UI behavior**: Toast Validation Error / `Full Name is required (Min 2 characters).`

#### WEB-TC-033: Father name too short
- **Expected UI behavior**: `Father's Name is required (Min 2 characters).`

#### WEB-TC-034: Mobile not 10 digits
- **Expected UI behavior**: `Mobile Number must be exactly 10 digits.`

#### WEB-TC-035: Alternate mobile invalid when provided
- **Expected UI behavior**: `Alternate Mobile must be exactly 10 digits.`

#### WEB-TC-036: Village / State / District / Taluka too short
- **Expected UI behavior**: Respective required messages from `validateForm`

#### WEB-TC-037: Invalid pincode when provided
- **Expected UI behavior**: `Pincode must be exactly 6 digits.`

#### WEB-TC-038: Total land missing or ≤ 0
- **Expected UI behavior**: `Valid Total Land Holding is required.`

#### WEB-TC-039: Missing major crop / soil / water source
- **Expected UI behavior**: Corresponding “select at least one …” messages

#### WEB-TC-040: Others selected without specify text
- **Condition**: soil/water/equipment includes Others without other* trim
- **Expected UI behavior**: Specify other Soil/Water/Equipment messages

### Business Logic Failure / Branch Scenarios

#### WEB-TC-041: Draft save error toast
- **Condition**: drafts update error
- **Expected UI behavior**: `Failed to save draft`

#### WEB-TC-042: Submitted save error toast
- **Condition**: farmers update error
- **Expected UI behavior**: `Failed to save`

#### WEB-TC-043: Cancel edit discards UI edit mode
- **Expected UI behavior**: `setIsEditing(false)`; no API call

---

## Operations Not Present in Code (no TCs)

- Create/delete farmer
- Approve/reject workflow
- Edit FSPP / farm card / diary records from this sheet (view/navigate only)

---

## Backend/App Mapping Hints

| WEB-TC | Operation key |
|--------|----------------|
| WEB-TC-001 | view_farmers_directory |
| WEB-TC-002 | farmers_perm_loading |
| WEB-TC-003 | deny_farmers_without_can_view |
| WEB-TC-004 | list_farmers_and_drafts |
| WEB-TC-005 | map_farmer_draft_row |
| WEB-TC-006 | list_farmers_empty |
| WEB-TC-007 | list_farmers_error |
| WEB-TC-008 | filter_farmers_by_date |
| WEB-TC-009 | search_farmers |
| WEB-TC-010 | filter_farmers_geo_status_se |
| WEB-TC-011 | filter_farmers_by_stage |
| WEB-TC-012 | derive_farmer_stage |
| WEB-TC-013 | display_route_name |
| WEB-TC-014 | farmers_map_view |
| WEB-TC-015 | farmers_table_view |
| WEB-TC-016 | farmers_map_empty |
| WEB-TC-017 | map_open_farmer_detail |
| WEB-TC-018 | geocode_missing_villages |
| WEB-TC-019 | export_farmers_csv |
| WEB-TC-020 | export_farmers_full_csv |
| WEB-TC-021 | export_farmers_pdf |
| WEB-TC-022 | export_pdf_popup_blocked |
| WEB-TC-023 | assigned_se_unassigned_fallback |
| WEB-TC-024 | view_farmer_dashboard |
| WEB-TC-025 | navigate_farmer_hub |
| WEB-TC-026 | view_farm_card_diary_observations |
| WEB-TC-027 | farmer_detail_back_nav |
| WEB-TC-028 | farmer_edit_requires_can_edit |
| WEB-TC-029 | cascade_farmer_location_edit |
| WEB-TC-030 | update_farmer_draft |
| WEB-TC-031 | update_farmer_submitted |
| WEB-TC-032–040 | validate_farmer_form_* |
| WEB-TC-041 | update_farmer_draft_error |
| WEB-TC-042 | update_farmer_submitted_error |
| WEB-TC-043 | cancel_farmer_edit |
