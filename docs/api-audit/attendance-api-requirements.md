# Attendance & Daily Travel Reports — V2 API Requirements Audit

**Project:** FieldCommander Admin Dashboard (legacy)  
**Module:** Attendance (`/attendance`) + related Shifts / Expenses / Routes dependencies  
**Audit type:** Read-only frontend → backend capability inventory  
**Date:** 2026-08-26  
**Scope rule:** Conclusions are labeled **Verified**, **Inferred**, **Mocked**, **Partial**, or **New V2**. No application source files were modified for this audit. Requested V2 product features are **not** treated as verified legacy behavior.

---

## 1. Executive summary

### What the legacy Attendance module actually is

**Verified:** Attendance is a **shift-punch calendar** over Supabase `shifts`, not a leave/HR attendance system.

- Each cell is keyed by `(se_id, date)` → at most one `shifts` row.
- **Attendance status is computed entirely in the browser** by `getAttendanceInfo(shift)` from `start_time` / `end_time` (Unix ms). There is **no** `attendance_status` column and **no** leave/holiday/week-off tables consumed by this UI.
- Clicking a present/active cell opens **AttendanceTimelineSheet** — the legacy “daily travel report”: duration, GPS distance, odometer distance, odometer photos, GPS path (raw + optional Google Snap-to-Roads), punched-in territory route, and a merged activity timeline.
- Monthly “attendance report” is a **client-generated CSV** (same status rules), not a server export job.

### What V2 asks for vs what legacy does

| V2 requested capability | Legacy reality | Label |
|---|---|---|
| Present / absent / half day / leave / other statuses | Present-like statuses: Full Day, Half Day, Active Shift, custom “X Hours”, Absent. **No Leave / Holiday / Week-off** | **Verified** subset; Leave etc. = **New V2** |
| Filter by executive, team, territory, status, date range | Search by SE **name** + **week** navigator only | **Partial**; team/territory/status/range = **New V2** |
| Open complete daily travel report | Timeline sheet with map + events | **Verified** (composition of several queries) |
| Map path, GPS points, followed/planned route, punches, distance, expenses | Path + GPS + punched-in route + village “working in” compare + distances. **Expenses not loaded into timeline.** Planned route is territory name via `assigned_route_id`, not geometry | **Partial** |
| Export monthly attendance | Client CSV matrix | **Verified** (client-side) |

### Data access pattern (legacy)

**Verified:** Direct Supabase JS client from React. No dedicated REST layer, React Query store, or typed OpenAPI client for attendance. Generated `src/integrations/supabase/types.ts` is not a usable schema source in this repo.

### Critical engineering notes for backend

1. **Status is a derived view**, not stored — V2 should either reimplement the same rules server-side or store computed status with an audit trail of rule version.
2. **`shifts.total_distance` is read as-is** (backend/mobile-authored). Odometer km is **frontend-computed** as `end_km - start_km`.
3. **GPS trail volume:** frontend loads **all** `shift_locations` for a shift (`lat`, `lng` only), then may call Google Roads API in **chunks of 100**. No sampling, pagination, or encoded polyline in legacy.
4. **Timezone:** calendar dates use browser-local `YYYY-MM-DD` via `toYYYYMMDD` (offset-adjusted). Half-day window uses **browser local hours** of `end_time`. Overnight / multi-timezone behavior is ambiguous.
5. **Manual overrides** live in separate **Shifts** module (`can_edit`), not Attendance UI.
6. **Timeline “punched activities”** are a hybrid: JSON `shift.events` **plus** client-injected farmer visits / FSPP / farm cards for that SE+date.

---

## 2. Legacy implementation map

### 2.1 Navigation & entry

| Item | Detail | Confidence |
|---|---|---|
| Sidebar | “Attendance” → `/attendance`, module `attendance` | **Verified** — `AppSidebar.tsx` L39 |
| Router | `<Route path="/attendance" element={guard(<AttendancePage />)} />` | **Verified** — `Index.tsx` L58–61 |
| Permission | `getModulePerm('attendance')` → `{ can_view, can_edit }` | **Verified** — `AttendancePage.tsx` L54–55; `usePermissions.ts` |
| Roles matrix (web) | Module key `attendance`, label “Attendance & Timelines” | **Verified** — `RolesPage.tsx` L22; `PermissionEditor.tsx` L16 |
| Mobile companion perm | `mobile_travel_activity` — “Executive Travel Activity (Attendance, Reports, Expenses)” | **Verified** — `RolesPage.tsx` L38 (mobile app; admin UI does not call it) |
| Related nav | Shifts `/shifts` (`shifts`), Expenses `/expenses` (`expenses`), Territory Routes `/routes` | **Verified** |

### 2.2 UI surface map

```
/attendance  AttendancePage
├── Permission gate (can_view) → Access Denied
├── Header: title + search SE + week prev/next + Export
├── Weekly matrix table (SE rows × Mon–Sun columns)
│   ├── Future day → "-"
│   ├── No shift → Absent badge (not clickable)
│   └── Has shift → status badge → opens AttendanceTimelineSheet
├── Client pagination (10 SEs / page after name filter)
└── Export dialog → month picker → client CSV download

AttendanceTimelineSheet (daily travel report)
├── Punched-In Route badge (routes.name via assigned_route_id)
├── Summary cards: Duration | GPS Dist. | Odo Dist.
├── Odometer photos (start/end) if URLs present
├── GPS Travel Route map (Google Maps or Leaflet localhost fallback)
│   ├── Path: snapped > raw shift_locations > event lat/lng fallback
│   └── Numbered markers for events with type === 'activity'
└── Chronological timeline (shift.events + injected visit/fspp/farm_card)

/shifts  ShiftsPage  (shared dependency — manual regularization)
├── Filter by date + SE
├── List ACTIVE/COMPLETED shifts
└── Create/Update shift override (one shift per SE per date)

/expenses  ExpensesPage  (shared — expenses linked by shift_id)
└── TA/DA uses shift distance/odo; not embedded in Attendance timeline
```

### 2.3 Source files (Attendance core)

| File | Role |
|---|---|
| `src/pages/AttendancePage.tsx` | Weekly grid, status engine, monthly CSV export |
| `src/components/AttendanceTimelineSheet.tsx` | Daily travel report, GPS map, timeline, route compare |
| `src/hooks/usePermissions.ts` | RBAC / Super Admin / TH bypass |
| `src/components/AppSidebar.tsx` | Nav visibility |
| `src/pages/RolesPage.tsx` / `PermissionEditor.tsx` | Permission module registration |
| `src/pages/Index.tsx` | Route registration |

### 2.4 Shared / dependent modules

| File | Dependency on Attendance / travel data |
|---|---|
| `src/pages/ShiftsPage.tsx` | CRUD on `shifts`; conflict rule 1 SE / date; vehicle + distance overrides |
| `src/pages/ExpensesPage.tsx` | `expenses.shift_id` → shift times, km, `total_distance`, odo images |
| `src/components/ExpenseActionSheet.tsx` | TA/DA math from shift distance; rate 4/8 ₹/km; DA if distance > 60 |
| `src/pages/RoutesPage.tsx` / route components | Territory routes; village lists used by timeline route compare |
| `farmers`, `farm_cards` | Timeline event injection |
| Google Roads API | Client snap-to-roads (not backend) |

### 2.5 Search term coverage

| Term | Finding |
|---|---|
| attendance / present / absent / half day | **Verified** in AttendancePage status engine |
| leave / holiday / week-off | **Not found** in Attendance UI or related fetches |
| check-in / punch-in / punch-out | Event types rendered; icons for `punch-in` / `punch-out` |
| activity / tracking / GPS / location | Timeline + `shift_locations` |
| travel report / day report | Timeline sheet (no separate “Travel Report” page name) |
| distance / route / expense | Cards + Expenses module; expenses **not** in timeline fetch |
| monthly report | Client CSV export |
| regularization / override | ShiftsPage “Create Shift Override” |
| mock / hardcoded attendance data | **Not found** (live Supabase queries). Localhost map tile fallback is UI-only |

---

## 3. Feature-to-API matrix

Legend **Status**: Verified | Partial | Mocked | Inferred | New V2  
Legend **Backend today**: Supabase table/query or external API used by frontend

| # | UI feature / user action | Status | Existing data source | Recommended V2 endpoint | Notes |
|---|---|---|---|---|---|
| A1 | View weekly attendance matrix for all non-demo SEs | **Verified** | `profiles` + `shifts` date range | `GET /v2/attendance/week` | Client paginates |
| A2 | Access denied without `attendance.can_view` | **Verified** | `role_permissions` / admin bypass | AuthZ on all attendance APIs | `can_edit` unused on page |
| A3 | Search executives by name | **Verified** | Client filter on loaded SEs | `search` query param on A1 | |
| A4 | Navigate previous/next week | **Verified** | Re-fetch shifts for new Mon–Sun | `weekStart` / `from`+`to` | Monday-start week |
| A5 | Status badge per cell (P / HD / ON / A / Xh) | **Verified** (client rules) | Raw shift times | Prefer server `attendanceStatus` on A1 | See §6 |
| A6 | Open daily travel report (timeline) | **Verified** | Shift row already in memory + extra queries | `GET /v2/attendance/shifts/{shiftId}/day-report` | Aggregated preferred |
| A7 | Export monthly attendance CSV | **Verified** (client) | `profiles` + `shifts` month | `GET /v2/attendance/exports/monthly` | Legacy is browser Blob |
| A8 | Filter by team | **New V2** | — | Query filters on A1 | No team filter in UI |
| A9 | Filter by territory / route | **New V2** | — | Query filters on A1 | |
| A10 | Filter by attendance status | **New V2** | — | Query filters on A1 | Status not stored |
| A11 | Arbitrary date-range filter (not week) | **New V2** | — | `from`/`to` on list APIs | Export is month-only |
| A12 | Dashboard status breakdown counts | **New V2** | — | `GET /v2/attendance/summary` | No summary cards on page |
| A13 | Leave / holiday / week-off status | **New V2** | — | Leave calendar APIs + status enum | Not in legacy |
| A14 | First punch-in / last punch-out fields | **Partial** | `start_time` / `end_time` as sole punches | Day-report summary | No separate punch table in admin |
| A15 | Working duration | **Verified** (client) | `(end-start)/3600000` | Include in day-report | |
| A16 | Break duration / overtime | **New V2** | — | Day-report computed fields | Not in UI |
| A17 | Daily GPS trail | **Verified** | `shift_locations` | `GET .../gps-trail` or embed | lat/lng only selected |
| A18 | GPS accuracy / altitude / speed | **Not found** | — | Optional trail point fields | Not selected/displayed |
| A19 | Planned route geometry vs actual path | **Partial** | `assigned_route_id` + village name compare | Day-report + geometry APIs | No planned polyline in legacy |
| A20 | Punched activities with type, entity, GPS, time | **Partial** | `shift.events` JSON + injections | Day-report `events[]` | Attachments not shown |
| A21 | Expenses on daily travel report | **Partial** / **New V2** for parity with V2 ask | Expenses module only | Embed `expenses[]` in day-report | Icon exists; no fetch |
| A22 | Travel distance (GPS) | **Verified** | `shifts.total_distance` | Return as authored + optional recompute | |
| A23 | Odometer distance | **Verified** (client) | `start_km`, `end_km` | Prefer server `odoDistanceKm` | |
| A24 | Route adherence % | **New V2** | Village mismatch badges only | Analytics field | |
| A25 | Manual shift create/edit (regularization) | **Verified** (Shifts module) | `shifts` insert/update | `POST/PATCH /v2/shifts` | Separate permission |
| A26 | Duplicate shift prevention | **Verified** | Pre-check same SE+date | Enforce uniquely | |
| A27 | Monthly export server-generated | **New V2** (optional) | Client CSV today | Async job + download URL | |
| A28 | Attendance audit history | **New V2** | — | `GET .../audit` | Not in UI |
| A29 | Privacy/authZ for location data | **Inferred** | Same as session + module view | Explicit scope + retention | No extra gate in UI |

---

## 4. Detailed contracts

> Naming uses recommended REST for V2. Legacy uses Supabase PostgREST-style table access. Each contract lists fields the frontend **actually consumes**, plus **New V2** fields clearly marked.

### 4.1 `GET /v2/attendance/week`

**Purpose:** Power Attendance Dashboard weekly matrix.  
**Confidence:** **Verified** — `AttendancePage` `fetchData` L92–126.

#### Query parameters

| Param | Type | Required | Legacy behavior | V2 notes |
|---|---|---|---|---|
| `weekStart` | `YYYY-MM-DD` | yes* | Monday of displayed week | *or `from`+`to` spanning 7 days |
| `from` | `YYYY-MM-DD` | alt | `toYYYYMMDD(weekDays[0])` | |
| `to` | `YYYY-MM-DD` | alt | `toYYYYMMDD(weekDays[6])` | Inclusive |
| `search` | string | no | Client name includes | Server-side preferred |
| `page` | int | no | Client `ITEMS_PER_PAGE = 10` | |
| `pageSize` | int | no | 10 | |
| `includeDemo` | boolean | no | Always exclude `is_demo = false` only | Legacy uses `.eq('is_demo', false)` (null demos excluded) |
| `teamId` | uuid | no | — | **New V2** |
| `territoryId` / `routeId` | uuid | no | — | **New V2** |
| `status` | enum | no | — | **New V2**; requires server status rules |
| `timezone` | IANA | no | Browser local | **Inferred** V2 should pin org timezone (e.g. `Asia/Kolkata`) |

#### Existing legacy calls

```text
profiles.select('id, name').eq('role','SE').eq('is_demo',false).order('name')
shifts.select('*').gte('date', start).lte('date', end)
```

Mapping: `shiftsMap[se_id][date] = shift` (last write wins if duplicates — **Inferred** risk).

#### Response (fields consumed by grid)

```json
{
  "weekStart": "2026-08-24",
  "weekEnd": "2026-08-30",
  "timezone": "Asia/Kolkata",
  "items": [
    {
      "executiveId": "uuid",
      "executiveName": "string",
      "days": [
        {
          "date": "2026-08-24",
          "isFuture": false,
          "shiftId": "uuid|null",
          "attendanceStatus": "FULL_DAY",
          "statusLabel": "Full Day",
          "statusShort": "P",
          "startTimeMs": 0,
          "endTimeMs": 0,
          "workingHours": 8.2
        }
      ]
    }
  ],
  "pagination": { "page": 1, "pageSize": 10, "total": 0 }
}
```

| Field | Required by UI | Source today |
|---|---|---|
| `executiveId`, `executiveName` | Yes | `profiles.id`, `name` |
| `date` | Yes | `shifts.date` or calendar day |
| `shiftId` | Yes for drill-down | `shifts.id` |
| `startTimeMs`, `endTimeMs` | Yes for rules | `start_time`, `end_time` |
| `attendanceStatus` / labels | Yes | **Client** `getAttendanceInfo` — recommend **server** |
| Full `shift.*` | Yes when opening sheet without refetch | Legacy keeps entire shift object in React state |

#### Loading / empty / error / permission

| Case | Legacy UI | Evidence |
|---|---|---|
| Auth/perm loading | Full-screen spinner | L228–230 |
| `!can_view` | Access Denied + Shield | L232–240 |
| Data loading | Spinner in table | L293–294 |
| No SEs after search | “No executives found.” | L313–318 |
| Fetch error | **Silent** (no toast on week fetch failure) | **Verified** gap L101–120 |
| Export error | Toast destructive | L211–212 |

#### Backend responsibilities

- Authorize `attendance.can_view`
- Return non-demo SEs (`role = SE`)
- Shifts for date window; **recommend unique (seId, date)**
- Apply status engine (§6) server-side for filters/export consistency
- Do **not** require leave tables for parity; add them only for **New V2** statuses

---

### 4.2 `GET /v2/attendance/shifts/{shiftId}/day-report`

**Purpose:** Complete daily travel report for one executive/day (timeline sheet).  
**Confidence:** **Verified** composition — `AttendanceTimelineSheet` L116–287 + render L384–564.

#### Path

| Param | Type |
|---|---|
| `shiftId` | uuid |

#### Optional query

| Param | Type | Notes |
|---|---|---|
| `includeGps` | boolean | Default true |
| `gpsMode` | `raw` \| `sampled` \| `encodedPolyline` | Legacy = full raw; sampling = **New V2** |
| `snapToRoads` | boolean | Legacy does snap **in browser** via Google; prefer server or omit |
| `includeInjectedActivities` | boolean | Farmer visit / FSPP / farm card injection — **Verified** client behavior |

#### Legacy queries when sheet opens

| # | Call | Lines | Consumed fields |
|---|---|---|---|
| 1 | `shift_locations.select('lat,lng').eq('shift_id').order('timestamp')` | 124–128 | Path points |
| 2 | Google `snapToRoads` chunks of 100, `interpolate=true` | 133–164 | Snapped lat/lng |
| 3 | `routes.select('id,name,locations').eq('se_id')` | 168–171 | Punched-in name + village→route map |
| 4 | `farmers.select(...).eq('se_id')` | 192–195 | Comments, FSPP, names, villages |
| 5 | `farm_cards.select(...).eq('se_id')` | 201–204 | Farm card timeline events |
| — | In-memory `shift` object | from parent | times, distance, events, odo, route id |

#### Recommended aggregated response

```json
{
  "shift": {
    "id": "uuid",
    "executiveId": "uuid",
    "executiveName": "string",
    "date": "YYYY-MM-DD",
    "status": "ACTIVE|COMPLETED",
    "startTimeMs": 0,
    "endTimeMs": null,
    "workingDurationHours": 0,
    "attendanceStatus": "ACTIVE_SHIFT",
    "assignedRouteId": "uuid|null",
    "assignedRouteName": "string",
    "totalDistanceKm": 0,
    "startKm": "string|null",
    "endKm": "string|null",
    "odoDistanceKm": 0,
    "odoDistanceLabel": "12.5 km|In Progress|--",
    "startOdoImageUrl": "string|null",
    "endOdoImageUrl": "string|null",
    "isPersonalVehicle": false,
    "vehicleType": "two-wheeler|four-wheeler|null"
  },
  "gpsTrail": {
    "source": "RAW|SNAPPED|EVENT_FALLBACK|NONE",
    "pointCount": 0,
    "points": [{ "lat": 0, "lng": 0, "timestamp": "iso|ms|null", "accuracyM": null }],
    "encodedPolyline": null
  },
  "routeContext": {
    "punchedInRouteName": "string",
    "villageToRoute": { "village-lower": "Route Name" }
  },
  "events": [
    {
      "type": "punch-in|punch-out|activity|expense|visit|fspp|farm_card|enrollment|draft|...",
      "title": "string",
      "description": "string|null",
      "timeMs": 0,
      "location": "string|{ village, address, lat, lng }",
      "farmerId": "uuid|null",
      "farmerName": "string|null",
      "entityId": "uuid|null",
      "attachments": []
    }
  ],
  "activityMapMarkers": [
    { "number": 1, "lat": 0, "lng": 0, "title": "string" }
  ],
  "expenses": [],
  "totals": {
    "expenseAmountSum": 0,
    "activityCount": 0
  }
}
```

#### Exact fields consumed by UI surfaces

**Header / route badge**

| UI | Fields |
|---|---|
| Title | `seName` (from parent list, not re-fetched) |
| Date line | `shift.date` → locale long date |
| Punched-In Route | `routes.name` where `routes.id === shift.assigned_route_id`, else `"Others"` |

**Summary cards**

| Card | Formula / fields |
|---|---|
| Duration | If both times: `((end_time - start_time) / 3600000).toFixed(1) + ' hrs'`; else `'Active'` |
| GPS Dist. | `shift.total_distance \|\| 0` + ` km` |
| Odo Dist. | If start+end km parseable: `max(0, end-start).toFixed(1) + ' km'`; else if start only: `'In Progress'`; else `'--'` |

**Odometer section** — shown if `start_odo_image` or `end_odo_image`; displays km labels + image URLs.

**Map**

| Input | Rules |
|---|---|
| Path priority | `snappedPath` > `livePath` (`shift_locations`) > fallback from `shift.events[].location.lat/lng` |
| Empty | “No GPS route data available.” |
| Markers | Only `events` with `type === 'activity'` and lat/lng; numbered 1..n |
| Start/End markers | Google only: labels `S` / `E` on first/last path points |
| Localhost | Leaflet OSM tiles; badge “Local Dev Map Mode” |

**Timeline**

| Input | Rules |
|---|---|
| Base events | `shift.events` array; filter out titles `'General Visit'` or title containing `fspp` / `farm card` (case-insensitive) |
| Injected | Same-day farmer `comments[]`, `fspp_details.evaluationDate`, `farm_cards.created_at` |
| Sort | Ascending by `time` (ms) |
| Empty | “No activities logged for this shift yet.” |
| Icons | `punch-in`, `punch-out`, `expense`, `visit`, `fspp`, `farm_card`, default |
| Route mismatch | For farmer-like events: compare village→route vs punched-in route; show green/red chips |

#### Expenses in day report

**Verified:** Timeline supports icon styling for `type === 'expense'` if present inside `shift.events`, but **does not** query `expenses` table.  
**New V2 (product ask):** Include linked expenses (`shift_id`) with category, amount, status, remarks, and sum for “total expenses.”

#### Loading / empty / error

| Case | Legacy |
|---|---|
| Loading GPS/routes/farmers | No dedicated skeleton; route badge starts as `"Loading..."` |
| No GPS | Map section omitted if `displayPath.length === 0`; empty message inside map component |
| Snap failure | `console.error`; falls back to raw GPS |
| Farmer/card fetch failure | Silent (no toast) |

#### Backend calculations (recommended)

| Metric | Legacy locus | V2 recommendation |
|---|---|---|
| Working duration | Frontend | Server |
| Odo distance | Frontend | Server |
| Attendance status | Frontend | Server |
| GPS distance | Stored `total_distance` | Keep authored value; optional recompute from trail |
| Snap-to-roads | Frontend Google | Optional server; watch API cost/quotas |
| Village vs punched-in route | Frontend | Server enrichment |
| Injected activities | Frontend merge | Server timeline builder for consistency |

---

### 4.3 `GET /v2/attendance/exports/monthly`

**Purpose:** Monthly attendance matrix download.  
**Confidence:** **Verified** client logic — `handleExportMonthlyAttendance` L139–216.

#### Query / body (legacy is UI dialog only)

| Param | Type | Legacy |
|---|---|---|
| `month` | `YYYY-MM` | `exportMonth` input `type="month"` |
| `format` | `csv` | Always CSV + UTF-8 BOM `\uFEFF` |
| `includeDemo` | boolean | false |

#### Legacy data fetches

```text
profiles.select('id, name').eq('role','SE').eq('is_demo',false).order('name')
shifts.select('se_id, date, start_time, end_time').gte('date', month-01).lte('date', month-lastDay)
```

#### CSV contract (exact columns consumed/produced)

| Column | Rule |
|---|---|
| `Executive Name` | Quoted `profiles.name` |
| `1` .. `N` (day numbers) | Per day: future → `-`; has shift → quoted `getAttendanceInfo().status`; else `Absent` |
| `Days Present` | Count of days **with any shift row** (not only Full Day) — **Verified** L179–196 |

Filename: `Monthly_Attendance_{YYYY-MM}.csv`

#### Request body / validation

None (GET-style). Month must be valid calendar month; `daysInMonth` via `new Date(y, m, 0).getDate()`.

#### Server vs client

| Aspect | Legacy | V2 |
|---|---|---|
| Generation | Browser Blob download | **New V2** optional server generation for large fleets |
| Status rules | Must match grid | Single shared rule engine |
| Permissions | Any user with page access (view) | `attendance.can_view` (+ optional `can_export`) |

---

### 4.4 `GET /v2/attendance/summary` (**New V2**)

**Purpose:** Dashboard counts / status breakdown.  
**Confidence:** **New V2** — AttendancePage has **no** summary cards. Dashboard page has no attendance KPIs.

Suggested query: `date` or `from`/`to`, optional team/territory.

Suggested response:

```json
{
  "date": "YYYY-MM-DD",
  "counts": {
    "fullDay": 0,
    "halfDay": 0,
    "activeShift": 0,
    "hoursOnly": 0,
    "absent": 0,
    "onLeave": 0,
    "holiday": 0,
    "weekOff": 0
  },
  "totalExecutives": 0
}
```

---

### 4.5 GPS trail sub-resource

#### `GET /v2/attendance/shifts/{shiftId}/gps-trail`

**Purpose:** High-volume GPS points for map.  
**Confidence:** **Verified** fields `lat`,`lng` + order by `timestamp`; accuracy not read.

| Param | Type | Notes |
|---|---|---|
| `format` | `points` \| `encodedPolyline` | Polyline = **New V2** optimization |
| `sampleEveryMeters` | number | **New V2** |
| `page` / `cursor` | — | **New V2** if trails are large |
| `includeTimestamp` | boolean | Selected for order only today; not drawn on map |

**Privacy:** Location trails are sensitive. Require `attendance.can_view` (and ideally organization scope). Log access if compliance requires (**New V2** / **Inferred**).

---

### 4.6 Shared Shifts APIs (regularization)

**Module permission:** `shifts` (`can_view` / `can_edit`) — **Verified** `ShiftsPage.tsx`.

#### `GET /v2/shifts`

Legacy: `shifts.select('*, profiles!inner(name,is_demo)').eq('profiles.is_demo',false)` + optional `date`, `se_id`; order `start_time` desc.

Consumed list fields: `profiles.name`, `status`, `start_time`, `end_time`, `start_km`, `end_km`, `total_distance`, `is_personal_vehicle`, `vehicle_type`.

#### `POST /v2/shifts` / `PATCH /v2/shifts/{id}`

**Verified** payload L161–172:

| Field | Type | Validation |
|---|---|---|
| `se_id` | uuid | Required |
| `start_time` | ms (from datetime-local) | Required |
| `end_time` | ms \| null | Optional |
| `date` | `YYYY-MM-DD` | Derived from start datetime **UTC** `toISOString().split('T')[0]` — **timezone hazard** |
| `status` | `ACTIVE` \| `COMPLETED` | Derived: end present → COMPLETED else ACTIVE |
| `is_personal_vehicle` | boolean | |
| `vehicle_type` | `two-wheeler` \| `four-wheeler` \| null | Null if not personal |
| `start_km`, `end_km` | string | |
| `total_distance` | number | Override |

**Business rule:** Reject if another shift exists for same `se_id` + `date` (edit excludes self) — L134–158.

**Not editable in Shifts UI:** `events`, `assigned_route_id`, odo images, `shift_locations`.

---

### 4.7 Shared Expenses linkage (daily expenses total)

Not part of Attendance page, but V2 day-report “total expenses” should use:

```text
expenses.select(...).eq('shift_id', shiftId)
```

Categories observed in Expenses UI: `TA/DA`, `Travelling`, `Food`, `Misc`, others.  
Statuses: `Pending`, `Approved`, `Rejected`, `Queried`.

TA/DA distance preference (**Verified** Expenses): odo (`end_km - start_km`) if positive, else `total_distance`. DA = ₹150 if distance > 60; TA rate ₹4/km (2W) or ₹8/km (4W inferred).

---

### 4.8 Filter lookup APIs (**New V2** where noted)

| Endpoint | Purpose | Legacy |
|---|---|---|
| `GET /v2/executives?role=SE&isDemo=false` | Executive filter | **Verified** profiles query |
| `GET /v2/teams` | Team filter | **New V2** — no team model in Attendance |
| `GET /v2/territory-routes/...` | Territory filter | Routes module exists; not wired to Attendance |
| `GET /v2/attendance/statuses` | Status enum for filter UI | **New V2** |

`sales_executive.organization_details` exists on SE profile (**Verified** SEsPage) but is **opaque JSON** in admin; Attendance does not use it for team/territory filters.

---

## 5. Attendance / travel data models

### 5.1 `shifts` (primary attendance record)

| Field | Used by Attendance | Used by Timeline | Used by Shifts | Used by Expenses | Notes |
|---|---|---|---|---|---|
| `id` | map key / open sheet | GPS + joins | yes | via `shift_id` | |
| `se_id` | matrix key | farmers/routes | yes | | |
| `date` | matrix key `YYYY-MM-DD` | event day match | derived | | |
| `start_time` | status + duration | duration, inject clamp | yes | duration | Unix **ms** (**Inferred** from Date math) |
| `end_time` | status + duration | duration | yes | duration | null = Active |
| `status` | not used for badges | not shown | ACTIVE/COMPLETED badge | | Attendance uses times, not this enum |
| `events` | — | timeline JSON | not edited | — | Array of event objects |
| `total_distance` | — | GPS Dist card | editable override | TA/DA | km |
| `start_km` / `end_km` | — | Odo card/photos | editable | TA/DA | strings |
| `start_odo_image` / `end_odo_image` | — | photos | not in editor | photos | URLs |
| `assigned_route_id` | — | punched-in route | not in editor | — | FK to `routes` |
| `is_personal_vehicle` | — | not shown | yes | — | |
| `vehicle_type` | — | not shown | 2W/4W | rate inference | |

### 5.2 `shift_locations`

| Field | Selected | Displayed | Notes |
|---|---|---|---|
| `shift_id` | filter | — | |
| `lat` | yes | path | |
| `lng` | yes | path | |
| `timestamp` | order only | not labeled on map | |
| accuracy / speed / heading | **not selected** | — | Unknown if columns exist |

### 5.3 `shift.events[]` (JSON shape as consumed)

| Property | Usage |
|---|---|
| `type` | Icon + map marker filter (`activity`) + farmer-event heuristics |
| `title` | Headline; also filtered for duplicate General Visit / FSPP / Farm Card |
| `description` | Body; may be relocated to location for some farmer events |
| `time` | ms sort + clock display |
| `location` | string village/address **or** `{ village, address, lat, lng }` |
| `farmer_name` / `farmerName` | Display |
| `entity_id` / `farmer_id` | Resolve name from farmers list |
| attachments | **Not consumed** in timeline |

### 5.4 Injected event models (client-built)

| Source | Match rule | Event type | Key fields |
|---|---|---|---|
| `farmers.comments[]` | local date of `created_at` == `shift.date` | `visit` | title “Farmer Checked-In”, comment, village |
| `farmers.fspp_details` | `evaluationDate` local date == shift.date | `fspp` | score, category, committedLand |
| `farm_cards` | `created_at` local date == shift.date | `farm_card` | plot, area, status, village |

If `eventTime <= shift.start_time`, time is forced to `start_time + 60000 + n*1000` — **Verified** ordering hack.

### 5.5 `routes` (planned / punched-in context)

| Field | Usage |
|---|---|
| `id`, `name` | Punched-in label |
| `locations[].villages[]` | Case-insensitive village → route map for “Working in” compare |

**Not present:** planned GPS polyline, ordered waypoints, adherence distance.

### 5.6 `expenses` (linked travel cost)

| Field | Attendance day-report today | V2 ask |
|---|---|---|
| `shift_id`, `category`, `amount`, `status`, `remarks`, `date` | Not loaded | Include + total |

### 5.7 Leave / holiday models

**Not found** in this admin codebase for Attendance. Any leave entity is **New V2** (or exists only in mobile / another service not referenced here).

---

## 6. Statuses and business rules

### 6.1 Attendance display statuses (legacy rule engine)

**Source:** `getAttendanceInfo` — `AttendancePage.tsx` L21–47. Applied identically in grid and monthly CSV.

| Condition (evaluated in order) | `status` label | `short` | Color classes | Enum suggestion |
|---|---|---|---|---|
| `!shift` | `Absent` | `A` | red | `ABSENT` |
| `!shift.end_time` | `Active Shift` | `ON` | blue | `ACTIVE_SHIFT` |
| `(end-start)/3600000 > 7.5` | `Full Day` | `P` | green | `FULL_DAY` |
| Local logout hour+min/60 ∈ **[13.0, 14.5]** | `Half Day` | `HD` | amber | `HALF_DAY` |
| Else | `{hours.toFixed(1)} Hours` | `{hours.toFixed(1)}h` | slate | `PARTIAL_HOURS` |

**Important:** Half Day is **not** “worked ~4 hours”; it is **logout clock time between 1:00 PM and 2:30 PM**, and only if total hours ≤ 7.5.

### 6.2 Shift record statuses (separate enum)

| Value | Where | Meaning |
|---|---|---|
| `ACTIVE` | ShiftsPage | No `end_time` (also set on create) |
| `COMPLETED` | ShiftsPage | Has `end_time` |

Attendance badges **ignore** this field and recompute from times.

### 6.3 Present count (export)

**Verified:** `Days Present` increments for **any day with a shift**, including Active Shift / Half Day / partial hours — not only Full Day.

### 6.4 Future days

Grid and export show `-` when `dateStr > todayStr` (`todayStr` = local `toYYYYMMDD(now)`).

### 6.5 Leave / holiday / week-off

**Not implemented.** Showing Leave as a first-class status is **New V2** and needs product rules (paid leave, unpaid, optional holiday calendar, week-off by roster).

### 6.6 Manual adjustments / regularization

| Mechanism | Module | What can change |
|---|---|---|
| Create/Update shift | Shifts (`can_edit`) | Times, vehicle, km, total_distance; forces date from start; unique SE+date |
| Attendance page | view-only | No edit controls despite `can_edit` existing on module |
| Status override enum | — | **Not found** (no admin “mark as Full Day” without editing times) |
| Audit log of edits | — | **Not found** |

### 6.7 Overnight shifts / timezone

| Topic | Observation | Risk |
|---|---|---|
| Calendar `date` | Stored on shift; week filter uses local YYYY-MM-DD | |
| Half-day window | `new Date(end_time).getHours()` **browser local** | Admin in other TZ sees different HD |
| ShiftsPage date derivation | `startDateObj.toISOString().split('T')[0]` (**UTC date**) | Can disagree with Attendance local date near midnight |
| Multi-day open shift | Possible if end null; counted Active on `date` only | Overnight completion date ambiguous |

### 6.8 Incomplete / duplicate / offline punches

| Case | Legacy handling |
|---|---|
| No punch-out | Active Shift / ON |
| Missing GPS | Map omitted / empty message; distance may still show `total_distance` |
| Duplicate shifts same day | ShiftsPage blocks create/update; Attendance map last-wins if data exists |
| Offline sync / duplicate events | Not handled in admin; events array trusted as stored |
| Missing `events` | Treated as `[]` |

### 6.9 Break duration / overtime

**Not found.** **New V2** if required — needs definitions (break punches? schedule length?).

---

## 7. GPS / map requirements

### 7.1 Trail acquisition (legacy)

1. Load all points for `shift_id` ordered by `timestamp` ascending.  
2. Optionally snap via Google Roads API in batches of **100** with `interpolate=true`.  
3. Prefer snapped path for draw.  
4. Else raw points.  
5. Else polyline through activity/event coordinates.

### 7.2 Volume & performance implications for V2

| Topic | Legacy | Recommendation |
|---|---|---|
| Pagination | None | Cursor/page or max points |
| Sampling | None | Meter-based downsample for UI |
| Encoded polyline | None | Google/Encoded polyline for bandwidth |
| Accuracy filter | None | Drop points with poor accuracy if available |
| Snap-to-roads | Client, API key in `VITE_GOOGLE_MAPS_API_KEY` | Move server-side or make optional; cost & key exposure |
| Ordering | `timestamp` ASC | Preserve; document clock skew |

### 7.3 Planned vs followed route

| Layer | Legacy |
|---|---|
| Planned geometry | **Not found** (territory villages only) |
| Followed geometry | GPS trail / snapped / event fallback |
| Comparison | Text chips: Punched in route name vs Working in route(village) |
| Adherence % / deviation km | **New V2** |

### 7.4 Map UI requirements (parity)

- Polyline color `#2563eb`, weight 4  
- Activity markers orange numbered circles  
- Zoom ~14, center first point  
- Production: Google Maps JS; localhost: Leaflet OSM fallback  

### 7.5 Privacy / authorization

- Trail endpoints must not be public.  
- Scope to org / role; consider masking exact home coordinates if policy requires (**product question**).  
- Export of raw GPS not present in legacy monthly CSV (attendance statuses only).

---

## 8. Export requirements

### 8.1 Monthly attendance CSV (legacy parity)

| Item | Spec |
|---|---|
| Trigger | Export button → month dialog → Download CSV |
| Generator | **Client** |
| Charset | UTF-8 with BOM |
| Rows | One per non-demo SE |
| Cells | Status labels from §6.1 |
| Present column | Count of days with shift |
| Future cells | `-` |

### 8.2 Server-generated export (**New V2** optional)

Suggested:

- `POST /v2/attendance/exports/monthly` → `{ jobId }`  
- `GET /v2/attendance/exports/{jobId}` → status + `downloadUrl`  
- Same columns as legacy unless product expands (leave codes, team, territory).

### 8.3 Related exports (not Attendance module)

Expenses detailed CSV and consolidated payout CSV use shift distances — see Expenses module. Do not conflate with attendance export.

### 8.4 Travel report export

**Not found** (no PDF/CSV of daily timeline). **New V2** if required.

---

## 9. Mocked, missing, and ambiguous behavior

### 9.1 Mocked / hardcoded

| Item | Finding |
|---|---|
| Mock attendance API | **Not found** |
| Hardcoded SE list | **Not found** (live `profiles`) |
| Localhost map mode | **Verified** UI fallback only — not fake GPS |
| Half-day thresholds 13.0–14.5 and 7.5h | **Hardcoded constants** in frontend |

### 9.2 Missing vs V2 feature list

| Missing in legacy Attendance UI | Label |
|---|---|
| Leave / holiday / week-off | **New V2** |
| Team filter | **New V2** |
| Territory filter | **New V2** |
| Status filter | **New V2** |
| Arbitrary date range (non-week) on grid | **New V2** |
| Summary / breakdown cards | **New V2** |
| Break / overtime | **New V2** |
| Expenses list + total on day report | **New V2** (icon-ready only) |
| Planned route polyline compare | **New V2** |
| Route adherence metrics | **New V2** |
| GPS accuracy fields | **Not found** |
| Attachments on activities | **Not found** in timeline |
| Audit history | **New V2** |
| Server monthly export job | **New V2** |
| Attendance `can_edit` actions | **Partial** (permission exists; unused) |

### 9.3 Ambiguous / inferred

| Topic | Ambiguity |
|---|---|
| Author of `total_distance` | Written by mobile/backend; admin can override on Shifts — exact mobile formula unknown here |
| Full `shift_locations` schema | Only `lat`,`lng`,`timestamp` proven via select/order |
| `events` schema completeness | Consumed defensively; producer is mobile app (out of repo) |
| Multiple shifts per day in DB | UI prevents new duplicates; historical duplicates last-wins in map |
| `organization_details` as team/territory | Opaque; unused by Attendance |
| Whether leave exists elsewhere | Not referenced by this frontend |
| Overnight shift `date` | UTC vs local conflict between ShiftsPage and AttendancePage |
| Snap-to-roads in production builds | Runs whenever API key present and not localhost error path |

---

## 10. V2 coverage checklist

Use this as a field-by-field comparison sheet against OpenAPI / Postman.

### 10.1 AuthZ

- [ ] `attendance.can_view` enforced on all read endpoints  
- [ ] `attendance.can_edit` defined (legacy unused) or mapped to shifts edit  
- [ ] `shifts.can_view` / `shifts.can_edit` for overrides  
- [ ] Location/GPS endpoints require same or stricter scope  
- [ ] Demo executives excluded by default (`is_demo = false`)  
- [ ] TH / Super Admin bypass documented  

### 10.2 `GET /v2/attendance/week` (or equivalent)

- [ ] `weekStart` or `from`+`to` (`YYYY-MM-DD`)  
- [ ] Monday-start week semantics documented  
- [ ] `search` (executive name)  
- [ ] `page`, `pageSize`  
- [ ] `includeDemo`  
- [ ] Response: `executiveId`, `executiveName`  
- [ ] Per day: `date`, `isFuture`, `shiftId`, `startTimeMs`, `endTimeMs`  
- [ ] Per day: `attendanceStatus`, `statusLabel`, `statusShort`, `workingHours`  
- [ ] Empty list behavior  
- [ ] Error payload suitable for toast  

### 10.3 Status engine parity

- [ ] `ABSENT` when no shift  
- [ ] `ACTIVE_SHIFT` when `endTime` null  
- [ ] `FULL_DAY` when hours > 7.5  
- [ ] `HALF_DAY` when logout local time ∈ [13:00, 14:30] and hours ≤ 7.5  
- [ ] `PARTIAL_HOURS` with one-decimal label  
- [ ] Timezone for half-day rule documented  
- [ ] Future dates excluded from status / show placeholder  

### 10.4 Filters (**mix of legacy + New V2**)

- [ ] Executive  
- [ ] Team (**New V2**)  
- [ ] Territory / route (**New V2**)  
- [ ] Status (**New V2**)  
- [ ] Date range (**New V2** beyond week)  

### 10.5 Day report `GET .../day-report`

- [ ] Shift identity + executive name + date  
- [ ] `assignedRouteId` / `assignedRouteName`  
- [ ] Duration hours / Active  
- [ ] `totalDistanceKm`  
- [ ] `startKm`, `endKm`, `odoDistanceKm`, odo images  
- [ ] `events[]` with type, title, description, time, location, farmer fields  
- [ ] Injected visit / FSPP / farm_card parity (or documented replacement)  
- [ ] Filter rules for duplicate General Visit / FSPP / Farm Card titles  
- [ ] Activity map markers (`type=activity` + coordinates)  
- [ ] Village vs punched-in route mismatch flags  
- [ ] `expenses[]` + total (**New V2** product)  
- [ ] Vehicle fields if needed for expense parity  

### 10.6 GPS trail

- [ ] Points ordered by timestamp  
- [ ] `lat`, `lng` required  
- [ ] Optional `timestamp`, `accuracyM`  
- [ ] Sampling / pagination / encoded polyline options documented  
- [ ] Snap-to-roads: server | client | none  
- [ ] Empty trail handling  

### 10.7 Monthly export

- [ ] `month=YYYY-MM`  
- [ ] CSV columns: Executive Name, days 1..N, Days Present  
- [ ] Status cell strings match grid labels  
- [ ] Future → `-`  
- [ ] Absent without shift  
- [ ] Days Present = count of days with shift  
- [ ] UTF-8 BOM (if parity required)  
- [ ] Client vs server generation flagged  

### 10.8 Summary counts (**New V2**)

- [ ] Endpoint exists  
- [ ] Counts per status for date/range  
- [ ] Matches status engine  

### 10.9 Leave / holiday (**New V2**)

- [ ] Status enums  
- [ ] Calendar sources  
- [ ] Interaction with shift punches (precedence rules)  

### 10.10 Shifts regularization

- [ ] List by date + executive  
- [ ] Create/update with unique (seId, date)  
- [ ] ACTIVE/COMPLETED derivation  
- [ ] Vehicle + distance fields  
- [ ] Does **not** clear GPS/events unless specified  

### 10.11 Computed vs raw

- [ ] Document which fields are stored vs computed  
- [ ] `total_distance` stored  
- [ ] Odo distance computed  
- [ ] Attendance status computed (unless persisted)  
- [ ] Duration computed  

### 10.12 Non-functional

- [ ] Org timezone  
- [ ] Overnight shift policy  
- [ ] GPS retention / privacy  
- [ ] Audit log for shift edits (**New V2**)  
- [ ] Max GPS points / payload limits  

---

## 11. Product / backend questions

1. **Canonical timezone?** Should half-day (13:00–14:30) and `shifts.date` use `Asia/Kolkata` (or org setting) instead of browser local / UTC mix?  
2. **Persist attendance status?** Keep pure derivation, or store status + `ruleVersion` for exports/payroll stability?  
3. **Leave system source of truth?** Does a leave module exist outside this repo? Precedence when both leave and shift exist?  
4. **Team / territory dimensions?** Are they `organization_details` fields, manager hierarchy, or territory routes?  
5. **Days Present definition:** Keep “any shift” or count only Full Day / (Full+Half)?  
6. **GPS distance:** Trust mobile `total_distance`, recompute from trail, or prefer odometer always (as Expenses often does)?  
7. **Snap-to-roads:** Remain client-side, move to backend, or drop for V2 cost/privacy?  
8. **Trail volume:** Expected max points/day? Need sampling defaults?  
9. **Day-report expenses:** Include all categories or only TA/DA? Approved only or all statuses?  
10. **Injected activities:** Keep server-side merge of comments/FSPP/cards, or require mobile to write all events into `shift.events`?  
11. **Planned route geometry:** Is V2 requiring true polylines, or is village-level punched-in vs working-in enough?  
12. **Regularization audit:** Required fields (who/when/before/after) for shift edits?  
13. **Attendance `can_edit`:** Should V2 expose inline status overrides on the matrix, or keep edits only under Shifts?  
14. **Overnight shifts:** If punch-out is after midnight, which `date` owns attendance and export cell?  
15. **Privacy:** May all `attendance.can_view` roles see exact GPS, or only aggregated distance?  

---

## Appendix A — Legacy call index (quick reference)

| # | Operation | Location | Purpose |
|---|---|---|---|
| 1 | `profiles` SE list | `AttendancePage.tsx` 102, 149–154 | Matrix + export rows |
| 2 | `shifts.select('*')` week | `AttendancePage.tsx` 103–107 | Matrix cells |
| 3 | `shifts.select(se_id,date,start_time,end_time)` month | `AttendancePage.tsx` 158–162 | CSV |
| 4 | `shift_locations` | `AttendanceTimelineSheet.tsx` 124–128 | GPS path |
| 5 | Google Snap-to-Roads | `AttendanceTimelineSheet.tsx` 146 | HD path |
| 6 | `routes` by `se_id` | `AttendanceTimelineSheet.tsx` 168–171 | Punched-in + village map |
| 7 | `farmers` by `se_id` | `AttendanceTimelineSheet.tsx` 192–195 | Injected visits/FSPP |
| 8 | `farm_cards` by `se_id` | `AttendanceTimelineSheet.tsx` 201–204 | Injected farm cards |
| 9 | `shifts` list/create/update | `ShiftsPage.tsx` | Regularization |
| 10 | `expenses` + `shifts:shift_id(...)` | `ExpensesPage.tsx` | Travel cost / TA-DA |

## Appendix B — Confidence legend

| Label | Meaning |
|---|---|
| **Verified** | Observed in source; UI calls or renders it |
| **Inferred** | Strongly implied by code patterns; not fully proven by schema |
| **Partial** | Some of the capability exists; gaps vs full V2 ask |
| **Mocked** | Fake/hardcoded data path (none found for attendance records) |
| **New V2** | Requested or recommended; not implemented in legacy Attendance UI |

---

*End of attendance API requirements audit.*
