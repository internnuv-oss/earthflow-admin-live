# WEB Test Scenarios — farm-diary-operations

**Module ID**: `farm-diary-operations`  
**Layer**: WEB  
**Primary sources analyzed**:
- `src/pages/FarmDiaryPage.tsx` (exported as default; routed as `FarmDiaryApprovals` in `Index.tsx`)
- `src/hooks/useAuth.ts` / `src/hooks/usePermissions.ts`

**UI Entry**: `/farm-diary-approvals` (sidebar label: Farm Diary; module key in sidebar: `farm_diary_approvals`)  
**Permission module key used in page**: `farm_diary_masters` (via `getModulePerm('farm_diary_masters')`)

**Code notes**:
- **View / list / export / detail only** — no create, update, delete, or approve handlers on this page. `can_edit` is never read.
- Access gate uses **`farm_diary_masters.can_view`**, not `farm_diary_approvals` (sidebar module key differs from page check).
- Crop identity for filters, upcoming events, and sheet SOP template is resolved by matching `farm_diary.farm_name` to `master_crops.crop_name` (case-insensitive).
- Stage and forecast filters apply to the **computed Upcoming Event**, not to historical observation stage alone.
- Visits count = size of unique `selected_stage_id` values in nested `crop_observation_sessions`.

---

# Test Scenario: Farm Diary Operations — Access Gate

## Operation Overview
- **Module ID**: farm-diary-operations
- **UI Entry**: `/farm-diary-approvals`
- **Primary files**: `src/pages/FarmDiaryPage.tsx`
- **Handler / function**: `getModulePerm('farm_diary_masters')`
- **API / data ops**: via `usePermissions`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. `authLoading || permLoading` → full-screen spinner
2. `!diaryAccess.can_view` → Access Denied + `You do not have permission to view Farm Diaries.`
3. Master/diary fetches early-return when `!userId || !diaryAccess.can_view`
4. No `can_edit` gating (export + View Timeline available whenever page is visible)

## Test Cases

### Success Scenarios

#### WEB-TC-001: User with farm_diary_masters.can_view sees Farm Diaries Directory
- **Code Path**: permission check → main UI
- **Based On**: `FarmDiaryPage.tsx`
- **Preconditions**: `diaryAccess.can_view === true`
- **Expected UI behavior**: Title "Farm Diaries Directory"; filters; Export Filtered CSV; table

### Business Logic Failure / Branch Scenarios

#### WEB-TC-002: Auth/perm loading shows spinner
- **Condition**: `authLoading || permLoading`
- **Expected UI behavior**: Centered spinner

#### WEB-TC-003: Missing farm_diary_masters.can_view shows Access Denied
- **Condition**: `!diaryAccess.can_view`
- **Expected UI behavior**: Access Denied for Farm Diaries (even if sidebar used `farm_diary_approvals`)

#### WEB-TC-004: can_edit is unused — page remains view-only when visible
- **Condition**: page rendered (`can_view` true); no edit/create/delete UI exists
- **Expected UI behavior**: Export and View Timeline only; no mutate buttons

---

# Test Scenario: Farm Diary Operations — Fetch Masters & Diaries

## Operation Overview
- **Module ID**: farm-diary-operations
- **UI Entry**: Page mount when `userId` and `can_view`
- **Primary files**: `src/pages/FarmDiaryPage.tsx`
- **Handler / function**: filter-list `useEffect`s
- **API / data ops**:
  - `profiles` SE list: `role = 'SE'`, `is_demo.eq.false OR is_demo.is.null`, order `name`
  - `master_crops` / `master_crop_stages` for filter dropdowns
  - `sop_crop_stages` (+ apps) → build `cropStagesMap` (stages with ≥1 application; `das` = min app DAS; sorted by `stage_sequence`)
  - `farm_diary` select `*`, nested `farmers` + `crop_observation_sessions`, order `created_at` desc
- **Layer**: WEB

## Code Analysis

### Error / Edge Paths Handled in UI
1. Diary fetch error → toast `Error fetching data` + `error.message`
2. Master fetches: set state only when `data` present (no error toasts)

## Test Cases

### Success Scenarios

#### WEB-TC-005: Load SE / crop / stage filter options and SOP map
- **Code Path**: mount → master fetches
- **Expected UI behavior**: Executive/Crop/Upcoming Stage selects populated; upcoming-event calc uses SOP map

#### WEB-TC-006: Load farm diary list
- **Code Path**: mount → `farm_diary` select
- **Expected API call**: `.from('farm_diary').select(...).order('created_at', { ascending: false })`
- **Expected UI behavior**: Table rows or empty state; loading spinner until done

### Business Logic Failure / Branch Scenarios

#### WEB-TC-007: Diary fetch error toast
- **Condition**: `error` from `farm_diary` select
- **Expected UI behavior**: Toast title `Error fetching data`

#### WEB-TC-008: No fetch when userId or can_view missing
- **Condition**: `!userId || !diaryAccess.can_view`
- **Expected UI behavior**: Effects return early (no list load on access-denied path)

---

# Test Scenario: Farm Diary Operations — Upcoming Event Computation

## Operation Overview
- **Module ID**: farm-diary-operations
- **UI Entry**: Table Upcoming Event column / filters / export
- **Primary files**: `src/pages/FarmDiaryPage.tsx`
- **Handler / function**: `getUpcomingStage`, `getCropIdFromName`
- **API / data ops**: client-side over `cropStagesMap` + diary sessions
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Returns `null` if `!is_sowing_done` or `!sowing_date`, or crop name not in masters, or no SOP stages with apps
2. **With visits**: next stage = first stage with `stage_sequence > maxCompletedSeq` among completed `selected_stage_id`s
3. **No visits**: first stage whose `sowing_date + das >= today`; if all past → fallback `stages[0]` (overdue)
4. No next stage after last completed → `{ stage_id: 'COMPLETED', name: 'All Stages Completed', date: null, isOverdue: false }`
5. Else date = sowing + next DAS; `isOverdue` if date &lt; today
6. UI: null → italic `Awaiting Sowing Date`; completed badge without date; overdue shows red + `(Overdue)`

## Test Cases

### Success Scenarios

#### WEB-TC-009: Upcoming stage after visits uses next sequence
- **Condition**: sowing done; sessions with completed stage_ids; later SOP stage exists
- **Expected UI behavior**: Shows next stage name + target date

#### WEB-TC-010: No visits — next calendar-due stage (or first if all past)
- **Condition**: sowing done; empty sessions
- **Expected UI behavior**: Stage whose target ≥ today, else first stage marked overdue when date &lt; today

#### WEB-TC-011: All SOP stages completed
- **Condition**: visits cover final stage; no later sequence
- **Expected UI behavior**: Green outline badge `All Stages Completed`

### Business Logic Failure / Branch Scenarios

#### WEB-TC-012: No sowing → Awaiting Sowing Date
- **Condition**: `!is_sowing_done` or missing `sowing_date`
- **Expected UI behavior**: `Awaiting Sowing Date` in Upcoming Event

#### WEB-TC-013: farm_name not matching any master crop
- **Condition**: `getCropIdFromName` returns null
- **Expected UI behavior**: Upcoming Event treated as null (`Awaiting Sowing Date` path)

---

# Test Scenario: Farm Diary Operations — Filters, Sort, Pagination

## Operation Overview
- **Module ID**: farm-diary-operations
- **UI Entry**: Filter bar + table headers + pager
- **Primary files**: `src/pages/FarmDiaryPage.tsx`
- **Handler / function**: `filteredData`, `sortedData`, `handleSort`, page state
- **API / data ops**: client-side only
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Search: substring on `farm_name`, farmer `full_name`, `village` (case-insensitive)
2. SE: `farmers.se_id === selectedSE` (or All)
3. Crop: `getCropIdFromName(farm_name) === selectedCrop` (or All); dropdown default option label "Select Crop..." value `All`
4. Stage: when not All, `upcoming !== null && upcoming.stage_id === selectedStage`
5. Forecast: only when **both** `forecastStart` and `forecastEnd` set; require upcoming.date in [start 00:00, end 23:59:59.999]; Clear Dates resets both
6. Default sort: `created_at` desc; toggle same key flips asc/desc
7. Sort keys: created_at, farm_name, farmer_name, executive, visits (unique stage ids), upcoming_date (missing date → 0)
8. `ITEMS_PER_PAGE = 15`; filter/sort change resets `currentPage` to 1
9. Empty filtered page: `No farm diaries found matching your criteria.`

## Test Cases

### Success Scenarios

#### WEB-TC-014: Search filters by farm name, farmer, or village
- **Input**: searchTerm matching one of the three fields
- **Expected UI behavior**: Only matching diaries listed; page reset to 1

#### WEB-TC-015: Filter by Executive / Crop
- **Expected UI behavior**: Rows limited to matching `se_id` / crop id from farm_name

#### WEB-TC-016: Filter by Upcoming Stage
- **Condition**: `selectedStage !== 'All'`
- **Expected UI behavior**: Only diaries whose computed upcoming `stage_id` equals selection (excludes null upcoming)

#### WEB-TC-017: Forecast date range filters by upcoming event date
- **Preconditions**: both start and end filled
- **Expected UI behavior**: Only diaries with upcoming.date inside inclusive day range

#### WEB-TC-018: Clear Dates clears forecast filter
- **Code Path**: Clear Dates button (visible when both dates set)
- **Expected UI behavior**: `forecastStart`/`forecastEnd` empty; forecast match becomes true for all

#### WEB-TC-019: Column sort toggles direction
- **User steps**: Click sortable header twice
- **Expected UI behavior**: Asc then desc (or vice versa); indicator arrows update

#### WEB-TC-020: Pagination 15 per page
- **Preconditions**: &gt;15 filtered rows
- **Expected UI behavior**: Showing X to Y of Z; Prev disabled on page 1; Next disabled on last page

### Business Logic Failure / Branch Scenarios

#### WEB-TC-021: Forecast ignored when only one date set
- **Condition**: only start or only end filled (not both)
- **Expected UI behavior**: `matchesForecast` stays true (no date-range filtering)

#### WEB-TC-022: Empty filter result message
- **Condition**: `paginatedData.length === 0` and not loading
- **Expected UI behavior**: Empty-state copy with BookOpen icon

---

# Test Scenario: Farm Diary Operations — Export Filtered CSV

## Operation Overview
- **Module ID**: farm-diary-operations
- **UI Entry**: Export Filtered CSV button
- **Primary files**: `src/pages/FarmDiaryPage.tsx`
- **Handler / function**: `executeExport`
- **API / data ops**: client CSV download from `sortedData` (no server export)
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Empty `sortedData` → toast `No Data` / `No records match your filters to export.`
2. Headers: Created Date, Farm/Diary Name (Crop), Farmer Name, Village, Executive (SE), Area, Sowing Date, Visits, Upcoming Stage, Upcoming Stage Date, Is Overdue
3. Area = `` `${plot_area || 0} ${plot_area_unit || 'Acres'}` ``
4. Dates via `formatDDMMYY`; BOM `\uFEFF`; filename `Farm_Diaries_Export_YYYY-MM-DD.csv`
5. Success toast: `Export Successful` / `Your file is downloading.`

## Test Cases

### Success Scenarios

#### WEB-TC-023: Export downloads CSV of current sorted filtered rows
- **Preconditions**: `sortedData.length > 0`
- **Expected UI behavior**: Browser download; success toast; columns match headers; Is Overdue Yes/No from `upcoming.isOverdue`

### Validation Failure Scenarios

#### WEB-TC-024: Export with no matching rows
- **Validation Rule**: `sortedData.length === 0`
- **Expected UI behavior**: Toast No Data; no download

---

# Test Scenario: Farm Diary Operations — Diary Detail Sheet

## Operation Overview
- **Module ID**: farm-diary-operations
- **UI Entry**: Row click / View Timeline → Sheet
- **Primary files**: `src/pages/FarmDiaryPage.tsx`
- **Handler / function**: `openDiaryDetails`; observation `useEffect`
- **API / data ops**:
  - `crop_observation_sessions` nested sample sets/params where `farm_diary_id = selectedDiary.id`, order created_at desc
  - If crop id from farm_name: `sop_crop_stages` for that crop ordered by `stage_sequence`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Sheet shows plot/soil/nutrient/water/historical fields with `N/A` fallbacks; yield history length / input prefs key count
2. Badges: Sowing Done vs Pre-Sowing; optional Sown date
3. Timeline accordion per SOP stage: completed if any session for `stage_id`; target DAS = min app DAS; overdue vs today when sowing done and not completed
4. Completed sessions show health score badge thresholds (≥4 green, ≥3 amber, else red), action tier color (Red/Amber/else green), samples/photos, Upload Image params as links
5. Pending stage content: `Stage Pending` + no observations copy
6. No SOP stages: `No stages configured for this crop.`
7. Loading: `Fetching field observations...`
8. Image `onError` → placeholder URL

## Test Cases

### Success Scenarios

#### WEB-TC-025: Open diary sheet loads observations and SOP stages
- **Code Path**: row click → sheet open → fetch sessions (+ sop stages if crop matched)
- **Expected UI behavior**: Header farm_name + farmer/village; profile cards; accordion timeline

#### WEB-TC-026: Completed stage shows visit records and samples
- **Preconditions**: sessions exist for a sop stage_id
- **Expected UI behavior**: Completed badge; Visit Record details; plant samples / parameter values

#### WEB-TC-027: Pending stage shows Stage Pending empty state
- **Preconditions**: sop stage with no matching sessions
- **Expected UI behavior**: Accordion content Stage Pending message; Overdue/Pending badge per target date when sowing done

### Business Logic Failure / Branch Scenarios

#### WEB-TC-028: Crop name unmatched → no SOP stages in sheet
- **Condition**: `getCropIdFromName` null → `setSopTemplateStages([])`
- **Expected UI behavior**: `No stages configured for this crop.`

#### WEB-TC-029: Sample photo load failure uses placeholder
- **Condition**: `img` onError
- **Expected UI behavior**: Placeholder `https://placehold.co/100x100/...` src

---

## Backend/App Mapping Hints
- WEB-TC-001 → view_farm_diaries (gated by farm_diary_masters.can_view)
- WEB-TC-005 → list_filter_masters_and_sop_map
- WEB-TC-006 → list_farm_diary
- WEB-TC-009 → compute_upcoming_stage
- WEB-TC-014 → filter_search_se_crop_stage_forecast
- WEB-TC-019 → sort_farm_diary_table
- WEB-TC-020 → paginate_farm_diary
- WEB-TC-023 → export_farm_diary_csv
- WEB-TC-025 → view_farm_diary_detail_sheet
