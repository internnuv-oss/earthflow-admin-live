# WEB Test Scenarios — shifts

**Module ID**: `shifts`  
**Layer**: WEB  
**Primary sources analyzed**:
- `src/pages/ShiftsPage.tsx` (single-page module; editor is inline Sheet)
- `src/hooks/useAuth.ts` / `src/hooks/usePermissions.ts`

**UI Entry**: `/shifts`  
**Permission module key**: `shifts`

**Code notes**:
- Create + Edit only (no delete). Create/Edit gated by `can_edit`; list by `can_view`.
- SE dropdown for filters/create: `profiles` where `role = 'SE'` and `is_demo = false`.
- List query joins `profiles!inner` and filters `profiles.is_demo = false`.
- Saved `date` and `status` are **derived on save** from start/end times — not taken from the unused `formData.date` / `formData.status` fields as user-editable controls (`status` in form is overwritten: end set → `COMPLETED`, else `ACTIVE`).
- `vehicle_type` persisted only when `is_personal_vehicle`; otherwise `null`. Default type `two-wheeler`.
- No frontend validation that end ≥ start, or that odometer end ≥ start (list display only uses odo when parseable and `e > s`).

---

# Test Scenario: Shifts — Access Gate

## Operation Overview
- **Module ID**: shifts
- **UI Entry**: `/shifts`
- **Primary files**: `src/pages/ShiftsPage.tsx`
- **Handler / function**: `getModulePerm('shifts')`
- **API / data ops**: via `usePermissions`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. `authLoading || permLoading` → full-screen spinner
2. `!permLoading && !shiftAccess.can_view` → Access Denied + `You do not have permission to manage shifts.`
3. Create Shift Override + Edit icon only when `shiftAccess.can_edit`

## Test Cases

### Success Scenarios

#### WEB-TC-001: User with shifts.can_view sees Shift Management
- **Code Path**: permission check → main UI
- **Based On**: `ShiftsPage.tsx`
- **Preconditions**: `shiftAccess.can_view === true`
- **Expected UI behavior**: "Shift Management"; date + SE filters; table

### Business Logic Failure / Branch Scenarios

#### WEB-TC-002: Auth/perm loading shows spinner
- **Condition**: `authLoading || permLoading`
- **Expected UI behavior**: Centered spinner

#### WEB-TC-003: Missing can_view shows Access Denied
- **Condition**: `!shiftAccess.can_view`
- **Expected UI behavior**: Access Denied for shifts

#### WEB-TC-004: can_edit false hides create and edit
- **Condition**: `can_view && !can_edit`
- **Expected UI behavior**: No "Create Shift Override"; no Edit buttons; filters/list still work

---

# Test Scenario: Shifts — List & Filters

## Operation Overview
- **Module ID**: shifts
- **UI Entry**: Date + Executive filters; table
- **Primary files**: `src/pages/ShiftsPage.tsx`
- **Handler / function**: `fetchShifts`; SE list `useEffect`
- **API / data ops**:
  - SE list: `profiles.select('id, name').eq('role','SE').eq('is_demo', false).order('name')`
  - Shifts: `shifts.select('*, profiles!inner(name, is_demo)').eq('profiles.is_demo', false).order('start_time', { ascending: false })` + optional `.eq('date', selectedDate)` + optional `.eq('se_id', selectedSE)`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Default `selectedDate` = today (`toISOString().split('T')[0]`); `selectedSE` = `'All'`
2. Fetch when `userId && shiftAccess.can_view`; re-runs on date/SE change
3. Empty list copy: `No shifts found for this date criteria.`
4. Distance column: if start_km/end_km parseable and end &gt; start → odo delta (1 decimal) + Odo subtitle; else `total_distance` to 2 decimals
5. Personal vehicle badge: `four-wheeler` → `4W`, else `2W`

## Test Cases

### Success Scenarios

#### WEB-TC-005: Load SE filter options (non-demo)
- **Code Path**: mount → profiles fetch
- **Expected UI behavior**: All Executives + SE names in select

#### WEB-TC-006: List shifts for selected date
- **Code Path**: `fetchShifts` with default/today date
- **Expected API call**: shifts query with `.eq('date', selectedDate)` and demo profile excluded
- **Expected UI behavior**: Rows with executive, status badge, times, distance; or empty message

#### WEB-TC-007: Filter by specific SE
- **User steps**: Choose executive ≠ All
- **Expected API call**: additional `.eq('se_id', selectedSE)`
- **Expected UI behavior**: Refetch; list for that SE on date

#### WEB-TC-008: Display odometer-derived distance when end &gt; start
- **Condition**: parseable start_km/end_km with e &gt; s
- **Expected UI behavior**: Shows computed km and `Odo: {start} - {end}`

#### WEB-TC-009: Display total_distance when odo not usable
- **Condition**: missing/invalid odo or end ≤ start
- **Expected UI behavior**: Shows `Number(total_distance||0).toFixed(2) km`

### Business Logic Failure / Branch Scenarios

#### WEB-TC-010: Clearing date omits date filter
- **Condition**: `selectedDate` falsy (if user clears date input)
- **Expected API call**: no `.eq('date', ...)` applied
- **Expected UI behavior**: Query still ordered by start_time; may return multi-day rows

---

# Test Scenario: Shifts — Create Manual Shift

## Operation Overview
- **Module ID**: shifts
- **UI Entry**: Create Shift Override → Sheet "Create Manual Shift"
- **Primary files**: `src/pages/ShiftsPage.tsx`
- **Handler / function**: `handleOpenEditor()` / `handleSaveShift`
- **API / data ops**: duplicate check select; then `shifts.insert([payload])`
- **Layer**: WEB

## Code Analysis

### Validations Found in Code
1. **Executive + Start Time** required (Source: `handleSaveShift`)
   - Implementation: `if (!formData.se_id || !formData.start_time) return toast({ title: 'Validation Error', description: 'Executive and Start Time are required.' })`
2. **One shift per SE per calendar date** (date from start_time ISO date)
   - Check: `shifts.select('id').eq('se_id').eq('date', calculatedDateString)`; if any → Shift Conflict toast with `en-IN` locale date

### Business Logic Found in Code
1. New form defaults: status ACTIVE (ignored on save), start_time = now, end empty, personal vehicle false, vehicle_type `two-wheeler`, km empty, total_distance 0
2. `date` = `startDateObj.toISOString().split('T')[0]` (UTC date of start)
3. `status` = endMs ? `COMPLETED` : `ACTIVE`
4. `start_time`/`end_time` stored as epoch ms (`getTime()`); end null if blank
5. Payload includes start_km/end_km as entered strings; `total_distance` = `parseFloat(...) || 0`
6. `vehicle_type`: personal → form value; else `null`
7. Success: toast `Shift created successfully!`; close sheet; `fetchShifts`

## Test Cases

### Success Scenarios

#### WEB-TC-011: Create ACTIVE shift (no end time)
- **Code Path**: Create → select SE + start → Save
- **Input**: se_id, start_time; end_time empty
- **Expected API call**: insert with `status: 'ACTIVE'`, `end_time: null`, `date` from start
- **Expected UI behavior**: Success toast; sheet closes; list refresh

#### WEB-TC-012: Create COMPLETED shift (with end time)
- **Input**: se_id, start_time, end_time
- **Expected API call**: insert `status: 'COMPLETED'`, `end_time` = end ms

#### WEB-TC-013: Create with personal vehicle and type
- **Input**: is_personal_vehicle true; vehicle_type two-/four-wheeler; optional odo + total_distance
- **Expected API call**: payload `is_personal_vehicle: true`, `vehicle_type` set (not null)

#### WEB-TC-014: Create without personal vehicle nulls vehicle_type
- **Input**: is_personal_vehicle false (even if type was previously set in state)
- **Expected API call**: `vehicle_type: null`

### Validation Failure Scenarios

#### WEB-TC-015: Save without executive or start time
- **Validation Rule**: `!se_id || !start_time`
- **Expected UI behavior**: Toast Validation Error / `Executive and Start Time are required.`; no insert

#### WEB-TC-016: Duplicate SE + date blocked on create
- **Condition**: existing shift for same se_id and calculated date
- **Expected UI behavior**: Toast Shift Conflict with restricted duplicate message; no insert

### Business Logic Failure / Branch Scenarios

#### WEB-TC-017: Duplicate-check query error
- **Condition**: `checkError` from select
- **Expected UI behavior**: Toast Database Error; saving cleared

#### WEB-TC-018: Insert API error
- **Condition**: insert returns error
- **Expected UI behavior**: Toast `Error saving shift` with message; sheet stays open

---

# Test Scenario: Shifts — Modify Existing Shift

## Operation Overview
- **Module ID**: shifts
- **UI Entry**: Edit icon → Sheet "Modify Existing Shift"
- **Primary files**: `src/pages/ShiftsPage.tsx`
- **Handler / function**: `handleOpenEditor(shift)` / `handleSaveShift`
- **API / data ops**: duplicate check with `.neq('id', editingShift.id)`; `shifts.update(payload).eq('id', editingShift.id)`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Prefills form via `formatForInput` (local timezone-adjusted datetime-local strings)
2. SE select **disabled** when editing (`disabled={!!editingShift}`)
3. Duplicate check excludes current shift id
4. Success toast: `Shift updated successfully!`

## Test Cases

### Success Scenarios

#### WEB-TC-019: Open editor prefilled from shift
- **Code Path**: Edit → sheet
- **Expected UI behavior**: Title Modify Existing Shift; SE disabled; times/vehicle/km loaded

#### WEB-TC-020: Update shift end time flips status to COMPLETED
- **Input**: set end_time; save
- **Expected API call**: update with `status: 'COMPLETED'` and end ms
- **Expected UI behavior**: Success updated toast; refetch

#### WEB-TC-021: Clear end time saves as ACTIVE
- **Input**: end_time cleared
- **Expected API call**: `status: 'ACTIVE'`, `end_time: null`

### Validation Failure Scenarios

#### WEB-TC-022: Edit save still requires start time
- **Validation Rule**: same as create (`se_id` present from record; empty start blocked)
- **Expected UI behavior**: Validation Error toast if start cleared

#### WEB-TC-023: Conflict with another shift same SE/date
- **Condition**: another row exists for same se_id + calculated date (not current id)
- **Expected UI behavior**: Shift Conflict toast; no update

### Business Logic Failure / Branch Scenarios

#### WEB-TC-024: Update API error
- **Condition**: update returns error
- **Expected UI behavior**: Toast `Error saving shift`

#### WEB-TC-025: Cancel closes editor without save
- **User steps**: Cancel / close sheet
- **Expected UI behavior**: Sheet closes; no API mutate

---

## Backend/App Mapping Hints
- WEB-TC-001 → view_shifts
- WEB-TC-005 → list_se_for_shifts
- WEB-TC-006 → list_shifts_by_date
- WEB-TC-007 → list_shifts_by_se
- WEB-TC-011 → create_shift
- WEB-TC-016 → create_shift_duplicate_blocked
- WEB-TC-019 → update_shift_open
- WEB-TC-020 → update_shift
- WEB-TC-023 → update_shift_duplicate_blocked
