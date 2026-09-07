# WEB Test Scenarios — attendance

**Module ID**: `attendance`  
**Layer**: WEB  
**Primary sources analyzed**:
- `src/pages/AttendancePage.tsx`
- `src/components/AttendanceTimelineSheet.tsx` (incl. nested `RouteMap`)
- `src/hooks/useAuth.ts` / `src/hooks/usePermissions.ts`

**UI Entry**: `/attendance`  
**Permission module key**: `attendance`

**Code notes**:
- **View / grid / export / timeline only** — no create/edit/delete of attendance or shifts. `can_edit` is never read.
- Access Denied UI shows title only (no descriptive permission sentence).
- Cell status from `getAttendanceInfo(shift)` (same rules used in monthly CSV status cells).
- Export “Days Present” increments for **any** day with a shift row (including Active / Half Day / Hours), not only Full Day (`P`).
- Timeline sheet is read-only; merges `shift.events` (filtered) with injected visit/FSPP/farm_card events from farmers + farm_cards.

---

# Test Scenario: Attendance — Access Gate

## Operation Overview
- **Module ID**: attendance
- **UI Entry**: `/attendance`
- **Primary files**: `src/pages/AttendancePage.tsx`
- **Handler / function**: `getModulePerm('attendance')`
- **API / data ops**: via `usePermissions`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. `authLoading || permLoading` → full-screen spinner
2. `!attendanceAccess.can_view` → Access Denied (Shield + heading only)
3. Data fetch early-returns when `!userId || !attendanceAccess.can_view`
4. Export button not gated by `can_edit`

## Test Cases

### Success Scenarios

#### WEB-TC-001: User with attendance.can_view sees Attendance Dashboard
- **Code Path**: permission check → main UI
- **Based On**: `AttendancePage.tsx`
- **Preconditions**: `attendanceAccess.can_view === true`
- **Expected UI behavior**: "Attendance Dashboard"; search; week nav; Export; weekly grid

### Business Logic Failure / Branch Scenarios

#### WEB-TC-002: Auth/perm loading shows spinner
- **Condition**: `authLoading || permLoading`
- **Expected UI behavior**: Centered spinner

#### WEB-TC-003: Missing can_view shows Access Denied
- **Condition**: `!attendanceAccess.can_view`
- **Expected UI behavior**: Access Denied heading (no extra message text)

#### WEB-TC-004: can_edit unused — no mutate actions when page visible
- **Condition**: page rendered
- **Expected UI behavior**: Only search, week change, cell open timeline, export — no edit/create UI

---

# Test Scenario: Attendance — Weekly Grid Load

## Operation Overview
- **Module ID**: attendance
- **UI Entry**: Page mount / week navigation
- **Primary files**: `src/pages/AttendancePage.tsx`
- **Handler / function**: `fetchData` in `useEffect` on `currentWeekStart`
- **API / data ops**:
  - `profiles`: `role = 'SE'`, `is_demo = false`, order `name`
  - `shifts`: `select('*').gte('date', weekStart).lte('date', weekEnd)`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Week starts Monday (`day === 0 ? -6 : 1` from today)
2. Dates via `toYYYYMMDD` (local offset-adjusted)
3. Shifts mapped `se_id → date → shift` (one shift per SE/date overwrite if multiples)
4. Search filters SE name client-side; `ITEMS_PER_PAGE = 10`; search resets page to 1
5. Empty: `No executives found.`

## Test Cases

### Success Scenarios

#### WEB-TC-005: Load non-demo SEs and week shifts into grid
- **Code Path**: mount → Promise.all profiles + shifts
- **Expected UI behavior**: Rows of executives; Mon–Sun headers; cells populated from map

#### WEB-TC-006: Navigate previous/next week refetches
- **User steps**: ChevronLeft / ChevronRight (`shiftWeek(±1)`)
- **Expected API call**: shifts for new Mon–Sun range
- **Expected UI behavior**: Week label updates; grid reloads

#### WEB-TC-007: Search executives by name
- **Input**: `searchQuery` substring
- **Expected UI behavior**: Filtered rows; page reset to 1; pagination over filtered list

#### WEB-TC-008: Pagination 10 SEs per page
- **Preconditions**: &gt;10 matching SEs
- **Expected UI behavior**: Showing X–Y of Z; Previous/Next disable at ends

---

# Test Scenario: Attendance — Status Rules (`getAttendanceInfo`)

## Operation Overview
- **Module ID**: attendance
- **UI Entry**: Grid cell short label / CSV cell status
- **Primary files**: `src/pages/AttendancePage.tsx`
- **Handler / function**: `getAttendanceInfo`
- **API / data ops**: none (client)
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. No shift → `{ status: 'Absent', short: 'A' }`
2. Shift without `end_time` → `{ status: 'Active Shift', short: 'ON' }`
3. `totalHours = (end_time - start_time) / 3600000`
4. If `totalHours > 7.5` → Full Day / `P` (**checked before** half-day window)
5. Else if logout local time decimal in `[13.0, 14.5]` (1:00–2:30 PM) → Half Day / `HD`
6. Else → status/short = hours like `X.Xh` (1 decimal)
7. Future dates (`dateStr > todayStr`): grid shows `-` (not clickable); no Absent button

## Test Cases

### Success Scenarios

#### WEB-TC-009: Absent cell when no shift (past/today)
- **Condition**: no shift in map; not future
- **Expected UI behavior**: Non-button `A` cell; title Absent

#### WEB-TC-010: Active Shift shows ON
- **Condition**: shift with no end_time
- **Expected UI behavior**: Clickable blue `ON`; opens timeline

#### WEB-TC-011: More than 7.5 hours → Full Day P
- **Condition**: end_time set; duration &gt; 7.5h
- **Expected UI behavior**: Green `P` (even if punch-out in half-day window)

#### WEB-TC-012: Half Day when punch-out 1:00–2:30 PM and ≤7.5h
- **Condition**: totalHours ≤ 7.5; logoutDecimal in [13, 14.5]
- **Expected UI behavior**: Amber `HD`

#### WEB-TC-013: Other completed durations show hours short code
- **Condition**: completed; ≤7.5h; punch-out outside half-day window
- **Expected UI behavior**: Slate badge with e.g. `6.2h`

### Business Logic Failure / Branch Scenarios

#### WEB-TC-014: Future day shows dash
- **Condition**: `dateStr > todayStr`
- **Expected UI behavior**: `-` only; no Absent/P/ON; not clickable

---

# Test Scenario: Attendance — Open Timeline from Cell

## Operation Overview
- **Module ID**: attendance
- **UI Entry**: Click status button on day with shift
- **Primary files**: `AttendancePage.tsx` → `AttendanceTimelineSheet`
- **Handler / function**: `setSelectedShift` / sheet `onClose`
- **API / data ops**: sheet fetches (see next scenario)
- **Layer**: WEB

## Test Cases

### Success Scenarios

#### WEB-TC-015: Click shift cell opens timeline sheet
- **Preconditions**: shift exists for SE/date
- **Expected UI behavior**: Sheet open with `seName`'s Timeline and shift date; closing clears selection

#### WEB-TC-016: Absent cell does not open sheet
- **Condition**: no shift (div, not button)
- **Expected UI behavior**: No timeline open

---

# Test Scenario: Attendance — Monthly CSV Export

## Operation Overview
- **Module ID**: attendance
- **UI Entry**: Export → month dialog → Download CSV
- **Primary files**: `src/pages/AttendancePage.tsx`
- **Handler / function**: `handleExportMonthlyAttendance`
- **API / data ops**: profiles (SE, non-demo) + shifts for month date range (`start_time`/`end_time`/`se_id`/`date`)
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Default `exportMonth` = current `YYYY-MM`
2. Headers: `Executive Name`, day numbers 1..N, `Days Present`
3. Future day → `-`; shift day → quoted `info.status`; else `Absent`
4. `presentCount++` whenever a shift exists that day (any status including Active/Hours)
5. File: `Monthly_Attendance_{exportMonth}.csv` with BOM; success toast; dialog closes
6. Errors → toast `Export Failed` + message; `exporting` cleared

## Test Cases

### Success Scenarios

#### WEB-TC-017: Export selected month downloads matrix
- **User steps**: Export → pick month → Download CSV
- **Expected UI behavior**: Toast Export Successful; file downloads; dialog closes
- **Expected API call**: profiles + shifts for month bounds

#### WEB-TC-018: Export marks future days as dash and counts present days with shifts
- **Based On**: export row builder
- **Expected UI behavior**: CSV cells `-` / status string / `Absent`; Days Present = count of days with shift

### Business Logic Failure / Branch Scenarios

#### WEB-TC-019: Export fails on profile or shift query error
- **Condition**: `pErr` or `sErr` thrown
- **Expected UI behavior**: Toast Export Failed; Generating... ends

#### WEB-TC-020: Export button disabled while generating
- **Condition**: `exporting === true`
- **Expected UI behavior**: Download CSV shows spinner / `Generating...`; disabled

---

# Test Scenario: Attendance Timeline Sheet — Data & Map

## Operation Overview
- **Module ID**: attendance
- **UI Entry**: Timeline sheet when `open && shift`
- **Primary files**: `src/components/AttendanceTimelineSheet.tsx`
- **Handler / function**: `fetchExtraData` in `useEffect`
- **API / data ops**:
  - `shift_locations` by `shift_id` order timestamp
  - optional Google Roads `snapToRoads` (chunks of 100) when `VITE_GOOGLE_MAPS_API_KEY` set
  - `routes` for `se_id` → village→route map + punched-in route from `assigned_route_id` (default `Others`)
  - `farmers` for `se_id` (comments, fspp_details)
  - `farm_cards` for `se_id`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Inject visit events from farmer comments on shift.date; FSPP from `evaluationDate`; farm_card from card `created_at` on shift.date
2. Event times ≤ punch-in bumped to `start_time + 60000 + index*1000`
3. Raw `shift.events` filtered out if title is `General Visit` or title contains `fspp` / `farm card` (case-insensitive)
4. Combined events sorted by `time`
5. Map path: snappedPath &gt; livePath &gt; event GPS fallback; empty → `No GPS route data available.`
6. Localhost/127.0.0.1 or Google loadError → Leaflet OSM + “Local Dev Map Mode”; else Google Map when loaded
7. Odo: both km → max(0, end-start) 1 decimal; start only → `In Progress`; else `--`
8. Farmer location vs punched-in route may show Punched in / Working in mismatch badges
9. Activity markers only for `type === 'activity'` with lat/lng
10. No writes to DB from this sheet

## Test Cases

### Success Scenarios

#### WEB-TC-021: Open sheet loads GPS path and punched-in route
- **Code Path**: open → fetch locations + routes
- **Expected UI behavior**: Punched-In Route badge; map shows path or empty GPS message

#### WEB-TC-022: Timeline merges shift.events with injected visit/FSPP/farm_card
- **Preconditions**: comments / fspp_details.evaluationDate / farm_cards on shift.date
- **Expected UI behavior**: Sorted timeline includes Farmer Checked-In / Added FSPP Details / Farm Card Generated as applicable

#### WEB-TC-023: Snap-to-roads used when API key and snapped points returned
- **Preconditions**: env key set; Roads API returns `snappedPoints`
- **Expected UI behavior**: `displayPath` prefers snapped coordinates

#### WEB-TC-024: Localhost uses Leaflet fallback map
- **Condition**: hostname localhost/127.0.0.1 (or Google loadError)
- **Expected UI behavior**: OSM map + Local Dev Map Mode badge when path exists

### Business Logic Failure / Branch Scenarios

#### WEB-TC-025: No locations and no event GPS → empty map message
- **Condition**: empty path
- **Expected UI behavior**: `No GPS route data available.`

#### WEB-TC-026: Sheet with null shift renders nothing
- **Condition**: `!shift`
- **Expected UI behavior**: Component returns `null`

#### WEB-TC-027: Snap-to-roads failure is non-blocking
- **Condition**: fetch throws (caught, console.error)
- **Expected UI behavior**: Falls back to livePath / event path; sheet still usable

---

## Backend/App Mapping Hints
- WEB-TC-001 → view_attendance
- WEB-TC-005 → list_attendance_week_grid
- WEB-TC-006 → navigate_attendance_week
- WEB-TC-009 → attendance_status_rules
- WEB-TC-015 → open_attendance_timeline
- WEB-TC-017 → export_monthly_attendance_csv
- WEB-TC-021 → view_shift_timeline_sheet
- WEB-TC-022 → inject_timeline_events
