# Business Rules — Attendance

**Source system:** Field Commander Admin (`earthflow-admin-live`)  
**Module:** Attendance  
**Related routes / keys:** `/attendance`, permission `attendance` (label: “Attendance & Timelines”); related mobile catalog key `mobile_travel_activity` (not enforced in this page)  
**Primary sources:** `src/pages/AttendancePage.tsx`, `src/components/AttendanceTimelineSheet.tsx`

This document describes **business behavior** for Attendance as implemented in the reference project. It is not a redesign.

Legend:

- **Confirmed** — directly supported by implementation  
- **Implementation Detail** — how the old app encodes the rule  
- **Unconfirmed** — not proven here  
- **`UNCONFIRMED — likely implemented outside this admin repository`** — mobile / remote DB  

---

## 1. Module Purpose

### Confirmed

**Attendance Dashboard** is a **read-only / export** module that:

1. Shows a **Monday–Sunday weekly grid** of Sales Executives vs days  
2. **Derives** attendance display status from linked **shift** punch times (no separate attendance table writes)  
3. Opens a **timeline sheet** for a day’s shift (GPS path, odometer, injected field activities)  
4. Exports a **monthly CSV** matrix using the same rule engine  

UI copy: “Monitor daily shift punches and field timelines.”

Attendance does **not** create, update, or delete shifts, locations, or any attendance entity.

---

## 2. Attendance Entity / Model

### Confirmed

There is **no dedicated `attendance` table** in this admin application’s usage.

Attendance is a **derived view** over:

| Source | Role |
|---|---|
| `shifts` | One (effective) record per SE per `date` drives cell status |
| `profiles` | SE rows (`role = 'SE'`, `is_demo = false`) form grid rows |
| `shift_locations` | Timeline GPS polyline |
| `routes` | Punched-in route label + village→route mismatch UI |
| `farmers` | Comments / FSPP details injected as timeline events |
| `farm_cards` | Cards created that day injected as timeline events |
| `shift.events` | Pre-stored JSON events on the shift (mobile/other) |

---

## 3. Relationship to Shifts

### Confirmed

```
shifts (se_id, date, start_time, end_time, …)
        ↓  (read, map by se_id + date)
getAttendanceInfo(shift)  →  grid badge / CSV cell
        ↓  (click when shift exists)
AttendanceTimelineSheet(shift)
```

- Grid loads `shifts.select('*')` for the visible week’s date range.  
- Export loads `se_id, date, start_time, end_time` for the month.  
- **`shift.status` (`ACTIVE` / `COMPLETED`) is not read** by the attendance rule engine. Only presence of the row and `start_time` / `end_time` matter.  
- Editing a shift in **Shifts** module changes what Attendance shows on next fetch (dynamic recalculation; no stored attendance status).

### Confirmed — Attendance does not modify shift data

No `.insert` / `.update` / `.delete` on Attendance page or timeline sheet.

---

## 4. Sales Executive Relationship

### Confirmed

- Grid rows = all non-demo SEs (`profiles.role = 'SE'`, `is_demo = false`), ordered by name.  
- Search filters SE **name** (client-side); does not change which shifts are fetched.  
- Pagination: 10 SEs per page.  
- No territory / TH scoping.  

---

## 5. Date / Day / Week Rules

### Confirmed — week definition

- Week starts **Monday**, ends **Sunday** (7 columns).  
- Initial week: Monday of the current week (`getDay()` with Sunday → prior Monday).  
- Navigation: ±7 days via chevrons.  

### Implementation Detail — local date string

`toYYYYMMDD(date)` adjusts by `getTimezoneOffset()` then takes ISO date — intended as **local** calendar day for grid keys. Compared with Shifts admin save which uses UTC `toISOString().split('T')[0]` for `shifts.date` — potential cross-module date mismatch (documented under conflicts).

### Confirmed — future days

If cell `dateStr > todayStr` (local today via `toYYYYMMDD`):

- Grid shows `-` (not clickable, not Absent)  
- Export writes `-`  

Past/today with no shift → Absent. Future shifts are not specially handled beyond this date gate (a future-dated shift row would still be hidden behind `-` in UI/export for that future day).

### Confirmed — weekends / holidays

No special weekend or holiday rules. Saturday/Sunday are normal columns; no holiday calendar.

---

## 6. Attendance Rule Engine (Authoritative)

### Confirmed — function `getAttendanceInfo(shift)`

Evaluated **in order**. First match wins.

#### Step 0 — No shift

| Result | `status` | `short` |
|---|---|---|
| Absent | `'Absent'` | `'A'` |

#### Step 1 — Shift exists, no punch-out

Condition: `!shift.end_time` (null / falsy)

| Result | `status` | `short` |
|---|---|---|
| Active / in progress | `'Active Shift'` | `'ON'` |

**Confirmed:** Missing punch-out ⇒ Active Shift, **not** Absent. Incomplete shift still counts as a shift day for export “Days Present” (see §14).

`shift.start_time` is **not** validated here; a shift with missing start still reaches Active if no end, or hours math if end exists.

#### Step 2 — Duration Full Day

```
totalHours = (end_time - start_time) / 3_600_000
if totalHours > 7.5 → Full Day
```

| Threshold | Behavior |
|---|---|
| Exactly **7.5** hours | **Not** Full Day (strict `>`) |
| **> 7.5** hours | `'Full Day'`, short `'P'` |

Lunch/breaks are **not** subtracted. Duration is raw end − start.

#### Step 3 — Half Day (logout window)

Only reached if **not** Full Day.

```
logoutDate = new Date(end_time)   // browser local timezone
logoutDecimal = hours + minutes/60   // seconds ignored
if logoutDecimal >= 13.0 && logoutDecimal <= 14.5 → Half Day
```

| Boundary | Inclusive? | Clock meaning |
|---|---|---|
| **13.0** | Yes (`>=`) | Exactly **13:00** → Half Day |
| **14.5** | Yes (`<=`) | Exactly **14:30** → Half Day |
| Before 13:00 | — | Not Half Day (falls through) |
| After 14:30 | — | Not Half Day (falls through) |

Comment in code: “logged out between 1:00 PM (13.0) and 2:30 PM (14.5).”

#### Step 4 — Hours display

If punched out, ≤ 7.5 hours, and logout **outside** [13:00, 14:30]:

| Result | `status` | `short` |
|---|---|---|
| Hours-based | `` `${totalHours.toFixed(1)} Hours` `` | `` `${totalHours.toFixed(1)}h` `` |

Comment: logout before 1:00 PM **or** after 2:30 PM with &lt; 7.5 hours.

### Confirmed decision tree (summary)

```
no shift                    → Absent (A)
no end_time                 → Active Shift (ON)
hours > 7.5                 → Full Day (P)
logout ∈ [13:00, 14:30]     → Half Day (HD)
else                        → "{n.n} Hours" / "{n.n}h"
```

### Confirmed — what inventory got right / refine

| Inventory claim | Verified |
|---|---|
| Full day &gt; 7.5h | **Yes** (strict greater than) |
| Half day logout 13:00–14:30 | **Yes**, inclusive both ends |
| Hours instead of simple Present | **Yes** (no generic “Present” label; Full Day short is `P`) |
| Derived from shifts | **Yes** |
| `shift.status` drives attendance | **No** |

### Confirmed — dynamic recalculation

Status is computed on every grid render and every export pass from current shift times. Nothing persisted as attendance status.

---

## 7. Present / Absent / Active Semantics

### Confirmed terminology in UI

| Label | Meaning |
|---|---|
| Absent | No shift row for that SE+date (past/today) |
| Active Shift | Shift without `end_time` |
| Full Day | Completed duration &gt; 7.5h |
| Half Day | Completed; logout in inclusive window; not Full Day |
| `{n} Hours` | Completed; not Full Day; not Half Day window |

There is **no** status string `"Present"`. Full Day’s short code is `'P'`.

### Confirmed — “present” for export count

CSV column **Days Present**: increments for **every** day that has a shift map entry and is not a future `-` day — including Active Shift, Half Day, Hours, and Full Day. Absent does not increment.

---

## 8. Weekly Grid Construction

### Confirmed

1. Fetch all non-demo SEs.  
2. Fetch all shifts with `date` between week Monday and Sunday inclusive.  
3. Build `shiftsMap[se_id][date] = shift`.  
4. For each SE × day: compute `getAttendanceInfo(shift)`.  
5. Future → `-`; shift present → clickable badge with `short`; no shift → non-clickable Absent badge.  

### Confirmed — multiple shifts same day

`forEach` assignment **overwrites** — last shift in the result set for that `se_id`+`date` wins. Query has no `order` on Attendance fetch → **which** duplicate wins is **unspecified** if multiples exist (Shifts admin tries to prevent duplicates).

### Confirmed — empty days

Absent styling (`A`), not blank.

### Confirmed — display

Cell shows **short** code; `title` tooltip shows full `status` + “Click for Timeline” when shift exists.

---

## 9. Timeline / Activity Rules

### Confirmed — open condition

Only days **with a shift** open the timeline (Absent cells are not buttons).

### Confirmed — header metrics

| Metric | Source |
|---|---|
| Punched-In Route | `routes` name where `routes.id === shift.assigned_route_id`, else `'Others'` |
| Duration | `(end-start)/3600000` hrs to 1 decimal, or `'Active'` if no end |
| GPS Dist. | `shift.total_distance` (label “GPS Dist.”) |
| Odo Dist. | From `start_km`/`end_km` (see conflicts with Shifts odo math) |

Odo images: shown if `start_odo_image` / `end_odo_image` URLs exist.

### Confirmed — GPS / `shift_locations`

1. Load `shift_locations` for `shift_id`, order by `timestamp` asc (`lat`, `lng` only).  
2. Optionally Snap-to-Roads (Google Roads API, chunks of 100, `interpolate=true`) if `VITE_GOOGLE_MAPS_API_KEY` set.  
3. Display path priority: **snapped** → raw live path → fallback from `shift.events` locations with lat/lng.  
4. Localhost / Maps load error → Leaflet/OSM fallback map.  
5. Markers: path start `S` / end `E` (Google); activity markers numbered for `type === 'activity'` with coordinates.  

**No reverse geocoding** is implemented in Attendance code (inventory mention of reverse-geocode is **not** confirmed here). Snap-to-Roads is path geometry, not address lookup.

### Confirmed — event sources merged into timeline

**A. Stored on shift:** `shift.events` array, filtered to **exclude**:

- `title === 'General Visit'`  
- titles containing `'fspp'` (case-insensitive)  
- titles containing `'farm card'` (case-insensitive)  

(These are re-injected from DB sources below to avoid duplicates of those categories.)

**B. Injected — farmer comments** (`type: 'visit'`, title `'Farmer Checked-In'`):

- Comment `created_at` local calendar date === `shift.date`  
- Time = comment timestamp; if ≤ `shift.start_time`, bump to `start_time + 60s + index*1s`  
- Location = farmer `village`  

**C. Injected — FSPP** (`type: 'fspp'`, title `'Added FSPP Details'`):

- `fspp_details.evaluationDate` local date === `shift.date`  
- Same time bump rule  
- Description includes score, category, committed land  

**D. Injected — farm cards** (`type: 'farm_card'`, title `'Farm Card Generated'`):

- `farm_cards.created_at` local date === `shift.date` for this SE  
- Description: plot, area, status  

### Confirmed — not included

- **`farm_diary`** / diary observation sessions: **not queried** by Attendance timeline.  
- Expense events: icon styling exists for `type === 'expense'` but expenses are **not** fetched/injected here; only appear if already in `shift.events`.

### Confirmed — ordering

`[...rawEvents, ...dynamicEvents].sort((a,b) => (a.time||0) - (b.time||0))` ascending by `time`.

### Confirmed — location / route mismatch UI

For farmer-like events, village string is cleaned and looked up in village→route map. If actual route ≠ punched-in route, show badges “Punched in: …” vs “Working in: …”.

Missing location: may show “Location Recorded”, GPS coords, or omit.

### Confirmed — what counts as an activity

Anything remaining in merged `events` list after filter + injections. Map “activity markers” only for `type === 'activity'` with lat/lng.

**`UNCONFIRMED — likely implemented outside this admin repository`:** who writes `shift.events` (punch-in/out, expense, activity GPS points).

---

## 10. Export Rules

### Confirmed

- Dialog: select calendar month (`YYYY-MM`).  
- CSV UTF-8 BOM; filename `Monthly_Attendance_{YYYY-MM}.csv`.  
- Headers: `Executive Name`, day numbers `1..N`, `Days Present`.  
- Cell values: future `-`; with shift → quoted `info.status` (full string, e.g. `"Full Day"`, `"3.2 Hours"`); else `Absent`.  
- Includes **all** non-demo SEs (search filter on grid does **not** apply to export).  
- Same `getAttendanceInfo` engine.  

---

## 11. Filters / Search

### Confirmed

| Control | Effect |
|---|---|
| Search Executive | Filters SE list by name substring; resets to page 1 |
| Week nav | Changes date range fetch |
| Pagination | 10 rows/page |

No status filter, no route filter.

---

## 12. Permissions

### Confirmed

| Check | Usage |
|---|---|
| `attendance.can_view` | Gate page load, Access Denied, data fetch |
| `attendance.can_edit` | **Never referenced** in AttendancePage or AttendanceTimelineSheet |

Export is available whenever the user can view the page (not gated by `can_edit`).

Roles UI still allows configuring Edit for Attendance, but **this module does not use it**.

---

## 13. Data Ownership / Scoping

### Confirmed

Global non-demo SE set. Shifts for all SEs in week/month range (demo SEs omitted from rows; orphan shifts for demo SEs would not appear as a row).

---

## 14. Edge Cases

### Confirmed

1. Exactly **7.5h** → not Full Day; may be Half Day or Hours depending on logout clock.  
2. Logout **exactly 13:00 or 14:30** → Half Day (if not Full Day).  
3. Active Shift with no end still increments **Days Present** in export.  
4. Negative duration (end &lt; start) → negative hours string possible; not sanitized.  
5. Full Day check runs **before** Half Day — theoretically &gt;7.5h with logout in window still Full Day.  
6. `logoutDecimal` ignores seconds (14:30:59 still 14.5).  
7. Timeline time-bump can reorder early farmer events to just after punch-in.  
8. Duplicate same-day shifts: last write wins, order undefined.  
9. Grid Absent vs export Absent wording consistent for empty past days.  

---

## 15. Calculations / Derived Values (Cheat Sheet)

| Value | Formula |
|---|---|
| Hours | `(end_time - start_time) / 3600000` |
| Full Day | `hours > 7.5` |
| Half Day window | local logout decimal ∈ **[13.0, 14.5]** inclusive |
| Days Present | count of days with a shift (non-future) |
| Timeline duration | same hours formula or Active |
| Odo display (timeline) | `max(0, parseFloat(end)-parseFloat(start))` if both parse |

---

## 16. Cross-Module Effects

| Module | Interaction |
|---|---|
| Shifts | Source of truth for times/date; admin edits change Attendance on refresh |
| Routes | Timeline punched-in route + village mismatch |
| Farmers / Farm Cards | Timeline injections |
| Expenses | Not consumed by Attendance; separate chain from shifts |
| Farm Diary | **Not** used in Attendance timeline |
| Dashboard | No attendance KPI found in prior inventory chain beyond shifts |

Attendance is **downstream only** — it does not feed other modules’ writes.

---

## 17. Rules a New Stack Must Preserve

1. Derive attendance from shifts; do not require a separate attendance write model unless intentionally redesigned.  
2. Preserve ordered rule engine: Absent → Active (no end) → Full Day (`> 7.5`) → Half Day (`[13:00, 14:30]` inclusive local) → Hours string.  
3. Do not use `shift.status` for attendance labels unless product changes.  
4. Monday–Sunday week grid; future days as `-`.  
5. Exclude demo SEs.  
6. Export monthly matrix with full status strings and Days Present = any shift day.  
7. Timeline: merge filtered `shift.events` + same-day farmer comments + FSPP evaluationDate + farm_cards; sort by time.  
8. Keep module view/export oriented unless adding explicit edit features.  
9. Document timezone policy explicitly (local vs UTC) when aligning with Shifts `date` storage.  

---

## 18. Important Unresolved / Conflicting Rules

1. **Shifts `date` UTC vs Attendance local `toYYYYMMDD`** may misalign cells.  
2. **Odometer math** in timeline vs Shifts/Expenses (strip + require end&gt;start).  
3. **Multiple shifts/day** last-wins with undefined order.  
4. Inventory claimed reverse geocode — **not implemented**; Snap-to-Roads only.  
5. Whether Active Shift should count toward “Days Present” is product-sensitive but confirmed as current behavior.  
6. `can_edit` configurable but unused.  
7. Farm diary absent from timeline despite operational importance elsewhere.  

---

## 19. Cross-Module Dependencies

**Depends on:** Shifts, Profiles/SE, (timeline) Routes, Farmers, Farm Cards, `shift_locations`.  

**Depended on by:** None for writes; humans/export consumers only.

**Related docs:** `docs/business-rules/shifts.md`, `territory-routes.md`, `sales-executives.md`, `roles-and-access.md`.

---

## 20. Evidence / Source Index

| Concern | Source |
|---|---|
| Rule engine, week grid, export, permissions | `src/pages/AttendancePage.tsx` |
| Timeline, GPS, injections, map | `src/components/AttendanceTimelineSheet.tsx` |
| Nav / role label | `AppSidebar.tsx`, `RolesPage.tsx` |
| Phase 0 notes | `docs/module-inventory.md` |
| `can_edit` unused confirmation | Grep across Attendance files; `roles-and-access.md` |

---

## 21. Rules That Appear to Live Outside This Repository

1. Creating shifts and punch-in/out times  
2. Writing `shift_locations` telemetry  
3. Populating `shift.events`, `assigned_route_id`, odo images  
4. Creating farmer comments / FSPP evaluationDate / farm_cards that timeline later displays  
5. Any payroll interpretation beyond this CSV  

Mark: **`UNCONFIRMED — likely implemented outside this admin repository`**.

---

*End of Attendance business rules extraction.*
