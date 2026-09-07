# Shifts Module — V2 API Requirements Audit

**Project:** FieldCommander Admin Dashboard (legacy)  
**Module:** Shifts (`/shifts`) + Attendance / Expenses integrations  
**Audit type:** Read-only frontend → backend capability inventory  
**Date:** 2026-08-26  
**Scope rule:** Conclusions are labeled **Verified**, **Inferred**, **Mocked**, **Partial**, or **New V2**. No application source files were modified for this audit. Requested V2 product features are **not** treated as verified legacy behavior.

---

## 1. Executive summary

### What the legacy Shifts module actually is

**Verified:** Shifts is a **manual regularization / override console** over Supabase table `shifts`, not a live punch clock, timesheet, or HR attendance engine.

- Admins with `shifts.can_view` list shifts for a **single calendar date** (optional SE filter), showing `ACTIVE` / `COMPLETED` badges, punch times, and distance/vehicle.
- Admins with `shifts.can_edit` open one sheet form to **Create Shift Override** (insert) or **Modify Existing Shift** (update).
- “Admin punch-in” and “admin punch-out” are **not separate UI actions**. They are the same upsert: set `start_time` (± optional `end_time`). Status is **derived** as `COMPLETED` if `end_time` is set, else `ACTIVE`.
- Conflict rule: **at most one shift row per `(se_id, date)`**, enforced in the browser before insert/update.
- Calendar `date` on save is derived from start datetime via **UTC** `toISOString().split('T')[0]` — a timezone hazard vs Attendance’s local `YYYY-MM-DD`.

### What V2 asks for vs what legacy does

| V2 requested capability | Legacy reality | Label |
|---|---|---|
| View active shifts for all executives | List filtered by **one date** (+ optional SE); includes ACTIVE and COMPLETED; no “active only” default or live counts | **Partial** |
| Completed / incomplete / missed / other states | DB enum used in UI: **ACTIVE**, **COMPLETED** only. Incomplete ≈ open `end_time`. Missed ≈ no row (Attendance **Absent**). No MISSED / INCOMPLETE stored status | **Partial** + **New V2** for Missed as first-class |
| Admin punch-in / punch-out on behalf of executive | Same create/update form; labels call fields “Punch In/Out Date & Time” | **Verified** (unified form) |
| Override saved as that executive’s shift for selected day | Insert/update `shifts` with `se_id` + derived `date` | **Verified** |
| Edit permitted shift details | Times, personal vehicle, vehicle type, odo km, `total_distance`; SE locked on edit | **Verified** |
| Preserve reasons/comments and audit history | **No** reason field, **no** comment, **no** revision trail in UI or writes | **New V2** |
| Active duration / breaks / overtime | Duration only elsewhere (Attendance/Expenses); no breaks/OT in Shifts | **Partial** / **New V2** |
| GPS on admin punches | Not collected or edited on Shifts page | **Not found** (mobile/attendance owns GPS) |
| Bulk / export / polling | None on Shifts page | **Not found** |

### Data access pattern (legacy)

**Verified:** Direct Supabase JS client from React (`ShiftsPage.tsx`). No dedicated REST layer, React Query store, Zod schemas, mocks, or typed OpenAPI client for shifts. Generated `src/integrations/supabase/types.ts` is not a usable schema source in this repo.

### Critical engineering notes for backend

1. **Unified upsert matches actual UI operations.** Separate “create override / close active / edit completed” endpoints are optional convenience aliases; the form always posts the same field set.
2. **Attendance status ≠ shift `status`.** Attendance derives Full Day / Half Day / Active / Absent / X Hours from times; Shifts stores only `ACTIVE` \| `COMPLETED`.
3. **Audit + reason are product gaps.** V2 must add them; legacy cannot be used as evidence of existing audit behavior.
4. **Timezone:** Fix date semantics (org TZ, e.g. `Asia/Kolkata`) — legacy mixes UTC date on save with local display and Attendance local dates.
5. **Do not wipe** `events`, `assigned_route_id`, odo images, or `shift_locations` on admin edit unless explicitly specified — Shifts UI does not send those fields.

### Endpoint model recommendation

**Prefer a unified shift resource + command envelope**, not four unrelated write APIs:

| Need | Recommendation | Why |
|---|---|---|
| Create override / punch-in | `POST /v2/shifts` (or `POST /v2/shifts/commands` with `action: UPSERT`) | Matches “Create Shift Override” insert |
| Close active / punch-out | Same upsert via `PATCH /v2/shifts/{id}` setting `endTime` | Matches “Modify Existing Shift”; no separate close UI |
| Edit completed shift | Same `PATCH` | Same form for ACTIVE and COMPLETED rows |
| Revision history | **Separate** `GET /v2/shifts/{id}/revisions` | Not present in legacy; read model differs from mutate |

Optional thin aliases (`POST .../punch-in`, `POST .../punch-out`) may improve V2 UX, but they should share one validation/audit pipeline with the unified upsert.

---

## 2. Legacy flow map

### 2.1 Navigation & entry

| Item | Detail | Confidence |
|---|---|---|
| Sidebar | “Shifts” → `/shifts`, module `shifts` | **Verified** — `AppSidebar.tsx` L42 |
| Router | `<Route path="/shifts" element={guard(<ShiftsPage />)} />` | **Verified** — `Index.tsx` L57 |
| Permission | `getModulePerm('shifts')` → `{ can_view, can_edit }` | **Verified** — `ShiftsPage.tsx` L19–20; `usePermissions.ts` |
| Roles matrix (web) | Module key `shifts`, label “Shift Management” | **Verified** — `RolesPage.tsx` L25; `PermissionEditor.tsx` L16 |
| Mobile companion | `mobile_travel_activity` — travel/attendance/expenses (admin Shifts page does not call it) | **Verified** — `RolesPage.tsx` L38 |
| Related nav | Attendance `/attendance`, Expenses `/expenses` | **Verified** |

### 2.2 UI surface map

```
/shifts  ShiftsPage
├── Permission gate (can_view) → Access Denied
├── Header: “Shift Management” + Create Shift Override (can_edit)
├── Filters: date (default today UTC ISO date) + SE select (All | list)
├── Table (no pagination, no status filter, no search)
│   ├── Executive name (profiles join)
│   ├── Status badge ACTIVE | COMPLETED (and any other raw status string)
│   ├── Start / End local time
│   ├── Distance: prefer odo (end_km - start_km) else total_distance; 2W/4W badge
│   └── Edit action (can_edit) → sheet
├── Loading spinner / empty “No shifts found for this date criteria.”
└── Sheet editor
    ├── Create Manual Shift | Modify Existing Shift
    ├── SE select (required; disabled when editing)
    ├── Start Time datetime-local * (Punch In)
    ├── End Time datetime-local optional (Punch Out)
    ├── Personal vehicle checkbox → vehicle type 2W/4W + start/end odometer
    ├── Total Distance Override (km)
    └── Save Shift Records → conflict check → insert | update → refresh list

/attendance  AttendancePage  (consumer of same shifts rows)
├── Weekly matrix + status engine from start/end times
└── No write path for shifts

/expenses  ExpensesPage  (consumer via expenses.shift_id)
└── Reads shift times / km / odo images for TA/DA; does not write shifts
```

### 2.3 Source files (Shifts core)

| File | Role |
|---|---|
| `src/pages/ShiftsPage.tsx` | List, filters, create/update override, conflict check |
| `src/hooks/usePermissions.ts` | RBAC / Super Admin / TH bypass |
| `src/components/AppSidebar.tsx` | Nav visibility via `shifts.can_view` |
| `src/pages/RolesPage.tsx` / `PermissionEditor.tsx` | Permission module registration |
| `src/pages/Index.tsx` | Route registration |

### 2.4 Shared / dependent modules

| File | Dependency |
|---|---|
| `src/pages/AttendancePage.tsx` | Reads `shifts` for week/month; derives attendance labels; no Shifts-module writes |
| `src/components/AttendanceTimelineSheet.tsx` | Day report: `events`, GPS `shift_locations`, route, odo images |
| `src/pages/ExpensesPage.tsx` / `ExpenseActionSheet.tsx` | `expenses.shift_id` → shift distance/duration for TA/DA |
| `profiles` | SE dropdown (`role = SE`, `is_demo = false`) |

### 2.5 Search term coverage

| Term | Finding |
|---|---|
| shift / active shift | **Verified** — page + `status === 'ACTIVE'` styling; Attendance “Active Shift” |
| punch-in / punch-out | **Verified** — form labels; timeline event types (Attendance) |
| clock-in / clock-out / timesheet | **Not found** as product terms |
| working hours | **Verified** elsewhere as `(end-start)/3600000`; not shown on Shifts list |
| override / adjustment / regularization | **Verified** — button “Create Shift Override”; copy “Adjust, correct, or append…” |
| attendance session | **Not found** as named entity; `shifts` row is the session |
| break / overtime / missed | **Not found** in Shifts UI |
| audit / reason / comment (on override) | **Not found** |
| mock / hardcoded shifts | **Not found** (live Supabase) |
| polling / realtime / active-user widget | **Not found** for shifts (Dashboard has no active-shift KPI) |

---

## 3. Feature-to-API matrix

Legend **Status**: Verified | Partial | Mocked | Inferred | New V2  
Legend **Backend today**: Supabase table/query used by frontend

| # | UI feature / user action | Status | Existing data source | Recommended V2 endpoint | Notes |
|---|---|---|---|---|---|
| S1 | View shifts for selected date (all non-demo SEs) | **Verified** | `shifts` ⋈ `profiles` | `GET /v2/shifts` | Client filter; no pagination |
| S2 | Filter by executive | **Verified** | `.eq('se_id')` | `executiveId` query | |
| S3 | Access denied without `shifts.can_view` | **Verified** | RBAC | AuthZ on all shift APIs | |
| S4 | Create Shift Override button | **Verified** | — | gated by `can_edit` | |
| S5 | Create shift (admin punch-in ± punch-out) | **Verified** | `insert` | `POST /v2/shifts` | Unified body |
| S6 | Edit existing shift (any status) | **Verified** | `update` | `PATCH /v2/shifts/{id}` | Same body fields |
| S7 | Duplicate SE+date blocked | **Verified** | pre-select `id` | Enforce unique + `409` | |
| S8 | Status ACTIVE/COMPLETED badge | **Verified** | `shifts.status` | Return stored + derived | Derived on write |
| S9 | Incomplete / open shift | **Partial** | `end_time` null → ACTIVE | Filter `status=ACTIVE` or `open=true` | No “INCOMPLETE” enum |
| S10 | Missed shift state | **New V2** (as stored) / **Inferred** via Attendance Absent | No row | Summary or attendance join | Not on Shifts page |
| S11 | Completed / other attendance states | **Partial** | Attendance engine | Cross-link Attendance APIs | Not Shifts badges |
| S12 | Active-shift counts / widgets | **New V2** | — | `GET /v2/shifts/summary` | Dashboard does not show |
| S13 | Team / territory / status filters | **New V2** | — | Query params on list | Only date + SE today |
| S14 | Admin punch-in alias | **Inferred** UX wrap of S5 | insert start only | Optional `POST .../punch-in` | Same pipeline |
| S15 | Admin punch-out alias | **Inferred** UX wrap of S6 | update end | Optional `POST .../punch-out` | Same pipeline |
| S16 | Edit start/end time | **Verified** | form datetime-local | Patch times | |
| S17 | Vehicle + odo + distance override | **Verified** | form fields | Patch fields | |
| S18 | Override reason / comment | **New V2** | — | Required on mutate | Absent in legacy |
| S19 | Audit / revision history | **New V2** | — | `GET .../revisions` | Absent in legacy |
| S20 | Active duration live | **New V2** | — | Computed `durationMs` | Not on list |
| S21 | Breaks / overtime | **New V2** | — | — | Not in codebase |
| S22 | Overnight / timezone | **Partial** | UTC date vs local display | Org TZ contract | Hazard **Verified** |
| S23 | Overlap beyond same-date uniqueness | **Partial** | only SE+date | Optional time-range conflict | No time overlap check |
| S24 | GPS/location on admin punch | **Not found** | — | Optional lat/lng | Timeline GPS separate |
| S25 | Attendance sync after override | **Inferred** | same table | Side effect: attendance views refresh | No webhook in admin |
| S26 | Bulk ops / export / polling | **Not found** | — | Optional **New V2** | Manual refetch after save only |
| S27 | SE lookup for filters/editor | **Verified** | `profiles` | `GET /v2/executives` | Shared |
| S28 | Role permissions for module | **Verified** | `role_permissions` | AuthZ | TH / Super Admin bypass |

---

## 4. Detailed endpoint contracts

> Naming uses recommended REST for V2. Legacy uses Supabase PostgREST-style table access. Each contract lists fields the frontend **actually consumes**, plus **New V2** fields clearly marked.

### 4.1 `GET /v2/shifts`

**Purpose:** Power Shift Management list table.  
**Confidence:** **Verified** — `ShiftsPage.fetchShifts` L58–73.

#### Query parameters

| Param | Type | Required | Legacy behavior | V2 notes |
|---|---|---|---|---|
| `date` | `YYYY-MM-DD` | yes* | `.eq('date', selectedDate)` | *Legacy always sends a date (default “today”) |
| `from` / `to` | `YYYY-MM-DD` | no | — | **New V2** history range |
| `executiveId` | uuid | no | `.eq('se_id')` when not All | |
| `status` | `ACTIVE` \| `COMPLETED` \| … | no | — | **New V2**; list shows all statuses for date |
| `openOnly` | boolean | no | — | **New V2** → `endTime == null` |
| `teamId` / `routeId` | uuid | no | — | **New V2** |
| `includeDemo` | boolean | no | Always `profiles.is_demo = false` via inner join | |
| `page` / `pageSize` | int | no | None (full result) | Recommend server pagination |
| `sort` | string | no | `start_time` desc | |
| `timezone` | IANA | no | Browser local display | Pin org TZ |

#### Existing legacy call

```text
shifts
  .select('*, profiles!inner(name, is_demo)')
  .eq('profiles.is_demo', false)
  .eq('date', selectedDate)          // if set
  .eq('se_id', selectedSE)           // if not All
  .order('start_time', { ascending: false })
```

#### Response (fields consumed by list)

```json
{
  "timezone": "Asia/Kolkata",
  "date": "2026-08-26",
  "items": [
    {
      "id": "uuid",
      "executiveId": "uuid",
      "executiveName": "string",
      "date": "YYYY-MM-DD",
      "status": "ACTIVE",
      "startTimeMs": 0,
      "endTimeMs": null,
      "workingDurationHours": null,
      "isPersonalVehicle": false,
      "vehicleType": "two-wheeler|four-wheeler|null",
      "startKm": "string|null",
      "endKm": "string|null",
      "odoDistanceKm": 0,
      "totalDistanceKm": 0,
      "displayDistanceKm": 0
    }
  ],
  "pagination": { "page": 1, "pageSize": 50, "total": 0 },
  "counts": {
    "active": 0,
    "completed": 0,
    "total": 0
  }
}
```

| Field | Required by UI | Source today |
|---|---|---|
| `executiveName` | Yes | `profiles.name` |
| `status` | Yes | `shifts.status` |
| `startTimeMs` / `endTimeMs` | Yes | `start_time` / `end_time` (Unix ms) |
| Distance display | Yes | Prefer odo delta if positive else `total_distance` — **Verified** L275–285 |
| Vehicle badge | Yes if personal | `is_personal_vehicle` + `vehicle_type` (`four-wheeler` → `4W` else `2W`) |
| `workingDurationHours` | No on list | **New V2** / used in Attendance & Expenses |
| `counts` | No | **New V2** for active-shift widgets |

#### Loading / empty / error / permission

| Case | Legacy UI | Evidence |
|---|---|---|
| Auth/perm loading | Full-screen spinner | L194 |
| `!can_view` | Access Denied + Shield | L196–205 |
| Data loading | Spinner in table | L247–248 |
| Empty | “No shifts found for this date criteria.” | L249–250 |
| Fetch error | **Silent** (no toast if query fails) | **Verified** gap L70–72 |
| Save success/error | Toast | L185–190 |

#### Backend responsibilities

- Authorize `shifts.can_view`
- Exclude demo executives (parity: inner join `is_demo = false`)
- Stable sort by `start_time` desc
- Prefer unique `(executiveId, date)` in data model
- Optionally return computed `odoDistanceKm` / `displayDistanceKm` / `workingDurationHours`

---

### 4.2 `GET /v2/shifts/{id}`

**Purpose:** Load one shift into editor / detail (legacy reuses list row in memory).  
**Confidence:** **Inferred** for V2; legacy does not refetch by id.

Return full editable fields plus non-editable context:

| Editable in legacy UI | Not editable in Shifts UI (preserve on PATCH) |
|---|---|
| `executiveId` (create only) | `events` |
| `startTimeMs`, `endTimeMs` | `assignedRouteId` |
| `isPersonalVehicle`, `vehicleType` | `startOdoImageUrl`, `endOdoImageUrl` |
| `startKm`, `endKm`, `totalDistanceKm` | `shift_locations` / GPS trail |

---

### 4.3 `POST /v2/shifts` — create override / admin punch-in (± out)

**Purpose:** “Create Shift Override” / “Create Manual Shift”.  
**Confidence:** **Verified** — `handleSaveShift` insert path L178–180.

#### Request body

```json
{
  "executiveId": "uuid",
  "startTime": "2026-08-26T09:30:00+05:30",
  "endTime": null,
  "isPersonalVehicle": false,
  "vehicleType": "two-wheeler",
  "startKm": "12050",
  "endKm": "",
  "totalDistanceKm": 0,
  "reason": "Executive forgot to punch in",
  "comment": "optional free text",
  "actorLocation": null
}
```

| Field | Legacy | Validation | Notes |
|---|---|---|---|
| `executiveId` | `se_id` required | Required | Toast if missing L121–122 |
| `startTime` | datetime-local → ms | Required | |
| `endTime` | optional → ms \| null | Optional | |
| `date` | **Derived**, not user-entered | Server must derive in **org TZ** | Legacy uses **UTC** date from ISO — hazard L131 |
| `status` | Derived | `endTime ? COMPLETED : ACTIVE` | Form `status` state unused on save |
| `isPersonalVehicle` | checkbox | | |
| `vehicleType` | `two-wheeler` \| `four-wheeler` \| null | Null if not personal | L168 |
| `startKm` / `endKm` | strings | Free text | Shown when personal vehicle |
| `totalDistanceKm` | number | `parseFloat` or 0 | Always editable |
| `reason` / `comment` | — | **New V2** recommend required `reason` | |
| `actorLocation` | — | **New V2** optional GPS | Legacy admin punch has no GPS |

#### Existing legacy payload

```text
{
  se_id, date, status, start_time, end_time,
  is_personal_vehicle, vehicle_type, start_km, end_km, total_distance
}
```

#### Response

Created shift resource (same shape as list item) + **New V2** `revisionId`.

#### Errors expected by UI

| Condition | Legacy | V2 |
|---|---|---|
| Missing SE or start | Toast validation | `400` |
| Duplicate SE+date | Toast “Shift Conflict” | `409 CONFLICT` |
| DB error | Toast message | `4xx/5xx` + message |
| No `can_edit` | Button hidden | `403` |

---

### 4.4 `PATCH /v2/shifts/{id}` — edit / admin punch-out / close

**Purpose:** “Modify Existing Shift” — including setting end time to close an ACTIVE shift.  
**Confidence:** **Verified** — update path L175–177.

#### Behavior vs create

| Rule | Legacy |
|---|---|
| SE change | Disabled in UI; payload still sends current `se_id` |
| Conflict check | Same SE+date uniqueness excluding self L140–142 |
| Status | Re-derived from presence of `end_time` |
| Date | Re-derived from **new** start time (can move day) |

#### Recommended body

Same fields as POST (partial patch allowed in V2). **New V2:** require `reason` for any mutating PATCH.

#### Preserve-on-edit (critical)

Unless V2 product explicitly allows clearing, PATCH must **not** null out:

- `events`, `assigned_route_id`, odo image URLs, GPS points, mobile-authored fields not in the admin form.

Legacy Supabase `.update(payload)` only sends listed columns — other columns remain (**Inferred** PostgREST partial update).

---

### 4.5 Optional command aliases (same pipeline)

These are **New V2** convenience wrappers. Use only if product wants explicit punch buttons; still write one `shifts` row and one audit revision.

#### `POST /v2/shifts/punch-in`

```json
{
  "executiveId": "uuid",
  "punchedAt": "ISO-8601",
  "reason": "string",
  "isPersonalVehicle": false,
  "vehicleType": null,
  "startKm": null
}
```

Maps to create with `startTime = punchedAt`, `endTime = null`, `status = ACTIVE`. Reject if shift already exists for derived date (`409`) or offer “open existing” policy (**product decision**).

#### `POST /v2/shifts/{id}/punch-out`

```json
{
  "punchedAt": "ISO-8601",
  "reason": "string",
  "endKm": null,
  "totalDistanceKm": null
}
```

Maps to PATCH setting `endTime`, `status = COMPLETED`. Reject if already completed unless force-edit with reason (**New V2** policy).

---

### 4.6 `GET /v2/shifts/summary` (**New V2**)

**Purpose:** Active-shift counts / status breakdown for dashboards.  
**Legacy:** **Not found** (Dashboard KPIs ignore shifts).

```json
{
  "date": "YYYY-MM-DD",
  "timezone": "Asia/Kolkata",
  "counts": {
    "active": 0,
    "completed": 0,
    "absentExecutives": 0,
    "totalExecutives": 0
  }
}
```

`absentExecutives` requires joining SE directory — aligns with Attendance Absent semantics.

---

### 4.7 `GET /v2/shifts/{id}/revisions` (**New V2**)

**Purpose:** Override audit trail. **Not found** in legacy.

```json
{
  "items": [
    {
      "id": "uuid",
      "shiftId": "uuid",
      "action": "CREATE|UPDATE|PUNCH_IN|PUNCH_OUT",
      "actorUserId": "uuid",
      "actorName": "string",
      "reason": "string",
      "comment": "string|null",
      "changedAt": "ISO-8601",
      "oldValues": { },
      "newValues": { }
    }
  ]
}
```

Minimum audit fields demanded by V2 product: **actor, old value, new value, reason, timestamp**.

---

### 4.8 `GET /v2/executives` (shared lookup)

**Verified** legacy:

```text
profiles.select('id, name').eq('role','SE').eq('is_demo',false).order('name')
```

Used for filter dropdown and editor SE select (`ShiftsPage` L51–55).

---

## 5. Shift models and status machine

### 5.1 `shifts` fields (as consumed across admin)

| Field | Shifts list/editor | Attendance | Timeline | Expenses | Notes |
|---|---|---|---|---|---|
| `id` | yes | map / open | joins | via `shift_id` | |
| `se_id` | yes | matrix key | yes | | |
| `date` | filter + derived | matrix key | day match | | `YYYY-MM-DD` |
| `start_time` | yes (ms) | status + duration | duration | duration | Unix **ms** |
| `end_time` | yes | status + duration | duration | duration | null = open |
| `status` | badge | **ignored** | not shown | | `ACTIVE` \| `COMPLETED` |
| `is_personal_vehicle` | yes | — | — | — | |
| `vehicle_type` | 2W/4W | — | — | rate inference elsewhere | |
| `start_km` / `end_km` | yes | — | odo | TA/DA | strings |
| `total_distance` | override | — | GPS Dist | TA/DA fallback | number km |
| `start_odo_image` / `end_odo_image` | **not edited** | — | photos | photos | |
| `assigned_route_id` | **not edited** | — | punched-in route | — | |
| `events` | **not edited** | — | timeline JSON | — | |

### 5.2 Shift record status machine (stored)

```
                  POST (no end)                PATCH set end
   [none] ----------------------> ACTIVE ----------------------> COMPLETED
             POST (with end)         ^                              |
                    \                | clear end (**not in UI**)     |
                     \---------------+                              |
                      -------------> COMPLETED <--------------------+
                                         |
                                         | PATCH times/vehicle/km
                                         v
                                      COMPLETED
```

| Transition | Legacy UI | Confidence |
|---|---|---|
| Create ACTIVE | Start only, no end | **Verified** |
| Create COMPLETED | Start + end on create | **Verified** (same form) |
| ACTIVE → COMPLETED | Edit and set end | **Verified** |
| COMPLETED → ACTIVE | Possible if end cleared | **Inferred** (form allows empty end; status re-derived) |
| Delete shift | **Not found** | No delete control |

### 5.3 Attendance-derived states (separate; sync implication)

From `AttendancePage.getAttendanceInfo` (**Verified** L21–47) — **not** stored on `shifts.status`:

| Condition | Label | Relation to Shifts module |
|---|---|---|
| No shift row | Absent | “Missed” analogue — **not** listed on `/shifts` |
| `!end_time` | Active Shift | Same as Shifts `ACTIVE` |
| Hours > 7.5 | Full Day | Still `COMPLETED` in Shifts |
| Logout local time 13:00–14:30 and ≤7.5h | Half Day | Still `COMPLETED` |
| Else | `{n} Hours` | Still `COMPLETED` |

**Attendance synchronization:** Any create/update on `shifts` immediately changes what Attendance shows for that `(se_id, date)` because both read the same row. No separate sync job in admin (**Verified** shared table / **Inferred** no cache).

### 5.4 Incomplete vs missed (product mapping)

| V2 term | Legacy mapping | Where visible |
|---|---|---|
| Incomplete / open | `status=ACTIVE` or `end_time` null | Shifts + Attendance ON |
| Completed | `status=COMPLETED` | Shifts |
| Missed | No shift for day (past) | Attendance Absent only |
| Other | Partial hours / Half / Full | Attendance only |

---

## 6. Validation / conflict rules

### 6.1 Client validation (**Verified**)

| Rule | Evidence |
|---|---|
| `se_id` and `start_time` required | L121–122 |
| Duplicate `(se_id, date)` blocked | L134–158; toast with en-IN date |
| Edit excludes own id from conflict query | L140–142 |
| `vehicle_type` null when not personal | L168 |
| `total_distance` coerced to number | L171 |
| SE immutable in UI when editing | `disabled={!!editingShift}` L339 |

### 6.2 Not validated in legacy (gaps → V2 should decide)

| Rule | Legacy |
|---|---|
| `end_time >= start_time` | **Not checked** |
| Time overlap across days / overnight | **Not checked** beyond date uniqueness |
| Odo `end_km >= start_km` | **Not checked** (display ignores non-positive delta) |
| Reason required | **Not present** |
| Concurrent edit / optimistic locking | **Not present** |
| DB unique constraint | Unknown from frontend; only client pre-check (**Inferred** risk of race) |

### 6.3 Recommended V2 server rules

1. Unique constraint on `(executive_id, date)` (org-scoped).  
2. `409` on conflict with clear message (parity with toast text).  
3. Reject `endTime < startTime`.  
4. Derive `date` and `status` server-side in org timezone.  
5. Require non-empty `reason` on create/update (**New V2**).  
6. Write revision row atomically with mutation.  
7. Optional: warn (not block) when editing COMPLETED shift that already has expenses linked.

---

## 7. Attendance integration

| Concern | Behavior | Label |
|---|---|---|
| Shared record | Attendance week/month queries `shifts` by `date` range | **Verified** |
| Status badges | Computed from times; ignore `shifts.status` | **Verified** |
| Day report | Opens from Attendance; uses fields Shifts does not edit (`events`, GPS, route, odo images) | **Verified** |
| After override | Next Attendance fetch shows new times/status labels | **Inferred** (no shared client cache) |
| Leave / holiday | Not in either module | **New V2** |
| First punch / last punch | Represented solely by `start_time` / `end_time` | **Verified** |
| Working duration | `(end-start)/3600000` in Attendance/Expenses/Timeline | **Verified** |
| Breaks / OT | Not computed | **New V2** |

Shifts APIs do **not** need to return Attendance labels for parity, but V2 list/detail **should** optionally include `attendanceStatus` for admin clarity (**New V2** convenience).

Cross-reference: `docs/api-audit/attendance-api-requirements.md` §4.6 / §6.

---

## 8. Permissions and audit trail

### 8.1 Permissions (**Verified**)

| Capability | Gate | Evidence |
|---|---|---|
| See nav + page | `shifts.can_view` | Sidebar filter; page Access Denied |
| Create / Edit | `shifts.can_edit` | Button + row Edit + save |
| Super Admin / TH | Full bypass | `usePermissions.ts` L33–37 |
| Attendance edits | Separate module; Attendance `can_edit` unused for writes | Attendance audit |

`PermissionEditor` also lists `shifts` for per-user `user_permissions` (**Verified** L16), while page runtime uses **role** permissions via `role_id` — treat role RBAC as source of truth for ShiftsPage (**Verified** `usePermissions`).

### 8.2 Audit trail

| Requirement | Legacy | V2 |
|---|---|---|
| Actor | Not recorded by UI | Required on every mutation |
| Old / new values | Not recorded | Field-level or document diff |
| Reason | Not collected | Required |
| Comment | Not collected | Optional |
| Timestamp | Only implicit DB `updated_at` if column exists (**unknown** in types) | Explicit revision `changedAt` |
| UI to view history | **Not found** | `GET /revisions` |

---

## 9. Missing or mocked behavior

| Area | Finding | Label |
|---|---|---|
| Mock shift data | None; live Supabase | **Verified** |
| Reason / comment on override | Missing | **New V2** |
| Revision / audit API | Missing | **New V2** |
| Active counts / live refresh | Missing (no interval, no realtime channel) | **New V2** / **Not found** |
| Status filter / team / territory | Missing | **New V2** |
| Missed as shift status | Missing (Attendance Absent only) | **New V2** or keep attendance-derived |
| Breaks / overtime | Missing | **New V2** |
| GPS on admin punch | Missing | **Not found** |
| Bulk punch / export CSV | Missing on Shifts | **Not found** |
| Delete shift | Missing | **Not found** |
| Separate punch-in vs punch-out buttons | Missing (unified form) | **Partial** vs V2 wording |
| End ≥ start validation | Missing | Gap |
| Fetch error toast on list | Missing | Gap |
| `formData.status` / `formData.date` | Held in React state but not user-editable; overwritten on save | **Verified** dead UI state |
| Typed schema / OpenAPI | Missing in repo | **Not found** |

---

## 10. V2 coverage checklist

### 10.1 List & filters

- [ ] `GET /v2/shifts` with `date` (and optional range)
- [ ] Filter `executiveId`
- [ ] Exclude demo SEs by default
- [ ] Sort `startTime` desc
- [ ] Pagination
- [ ] Optional `status` / `openOnly`
- [ ] Optional team/territory filters (**New V2**)
- [ ] Empty / loading / 403 states
- [ ] Summary counts for active/completed (**New V2**)

### 10.2 Create override / punch-in

- [ ] `POST /v2/shifts` (unified)
- [ ] Required executive + start time
- [ ] Optional end time
- [ ] Derive `date` in org timezone
- [ ] Derive `ACTIVE` / `COMPLETED`
- [ ] Vehicle + odo + total distance fields
- [ ] Unique `(executiveId, date)` → 409
- [ ] Required `reason` + audit revision (**New V2**)

### 10.3 Edit / punch-out / close

- [ ] `PATCH /v2/shifts/{id}`
- [ ] Set/clear end time updates status
- [ ] Executive immutable (or explicit policy)
- [ ] Preserve events / route / odo images / GPS
- [ ] Conflict check excluding self
- [ ] Optional punch-out alias endpoint

### 10.4 Details & computed fields

- [ ] Working duration hours
- [ ] Odo distance vs GPS `totalDistance`
- [ ] Optional `attendanceStatus` projection
- [ ] Overnight date rules documented

### 10.5 Attendance sync

- [ ] Document shared `shifts` source of truth
- [ ] Attendance matrix reflects overrides without separate write API
- [ ] No accidental dual status stores unless versioned

### 10.6 Audit

- [ ] Actor, timestamp, reason
- [ ] Old/new values per change
- [ ] `GET /v2/shifts/{id}/revisions`
- [ ] Permissions to view audit (suggest `shifts.can_edit` or admin-only)

### 10.7 Non-functional

- [ ] Org timezone (recommend `Asia/Kolkata`)
- [ ] Unix ms vs ISO clearly versioned in API
- [ ] Idempotency / concurrency strategy
- [ ] No silent list failures (return errors)

### 10.8 Explicitly out of legacy Shifts scope (handle elsewhere)

- [ ] GPS trail / snap-to-roads → Attendance day-report
- [ ] Timeline events injection → Attendance
- [ ] TA/DA calculation → Expenses
- [ ] Leave/holiday calendars → **New V2** Attendance

---

## 11. Open questions

1. **Timezone authority:** Should `date` follow org TZ (`Asia/Kolkata`) always, fixing legacy UTC `toISOString` derivation and the UTC default filter date on `selectedDate` init (L28)?
2. **Missed shifts:** First-class Shifts filter/status, or remain Attendance-only Absent?
3. **Reason required?** Product asks for preserved reasons — confirm mandatory on every admin mutation, including trivial distance edits.
4. **Clearing end time:** Allow reopening COMPLETED → ACTIVE from admin? Legacy form permits empty end.
5. **Moving date:** If start time crosses midnight, legacy rewrites `date` and may conflict with another day’s row — confirm intended.
6. **Expenses coupling:** When times/distance change, should approved TA/DA expenses be frozen, recalculated, or flagged?
7. **GPS on behalf punch:** Should admin punches optionally attach lat/lng, or remain office-side metadata-only?
8. **Unique constraint:** Does production DB already enforce `(se_id, date)`, or only the client check?
9. **Command aliases:** Ship unified CRUD only, or also punch-in/out aliases for V2 UX?
10. **Who may view revisions?** Same as `can_edit`, Super Admin only, or a new permission flag?
11. **Live active board:** Is polling/websocket required for “view active shifts for all executives,” or is date-filtered list + manual refresh enough?
12. **Overnight ACTIVE shifts:** If an SE never punches out, should nightly jobs auto-close, mark Incomplete, or leave ACTIVE indefinitely (legacy leaves ACTIVE)?

---

## Appendix A — Per-operation audit cards

### A1. List shifts by date

1. **UI action:** Change date and/or SE filter; view table.  
2. **Evidence:** `ShiftsPage.tsx` L58–77, L228–241, L244–318.  
3. **Classification:** **Verified**.  
4. **Existing call / V2:** Supabase select → `GET /v2/shifts`.  
5. **Schemas:** See §4.1.  
6. **Filters/pagination/time:** Date equality; optional SE; no page; `start_time` desc; display local time.  
7. **Validation/conflicts:** N/A.  
8. **Backend calcs:** Prefer odo delta for display distance (**client today**).  
9. **Permissions/audit:** `can_view`; no audit.  
10. **States:** Spinner; empty message; silent fetch failure; Access Denied.

### A2. Create shift override (admin punch-in / full day create)

1. **UI action:** Create Shift Override → fill form → Save.  
2. **Evidence:** L221–224, L102–116, L120–191, L323–418.  
3. **Classification:** **Verified**.  
4. **Existing / V2:** `insert` → `POST /v2/shifts`.  
5. **Schemas:** §4.3.  
6. **Date/TZ:** Date from start via UTC ISO date (**hazard**).  
7. **Validation:** SE+start required; SE+date unique.  
8. **Calcs:** Status from end presence; vehicle_type nulling.  
9. **Permissions/audit:** `can_edit`; **no** reason/audit (**New V2**).  
10. **States:** Saving spinner on button; success/error toasts; sheet closes on success; list refresh.

### A3. Edit shift / admin punch-out

1. **UI action:** Row Edit → change end time and/or other fields → Save.  
2. **Evidence:** L307–312, L87–101, L175–177, L134–158.  
3. **Classification:** **Verified**.  
4. **Existing / V2:** `update` → `PATCH /v2/shifts/{id}` (+ optional punch-out alias).  
5. **Schemas:** §4.4.  
6. **Semantics:** Same as create; SE locked in UI.  
7. **Conflicts:** Unique excluding self.  
8. **Calcs:** Status re-derived.  
9. **Permissions/audit:** `can_edit`; no history UI.  
10. **States:** Same toasts/saving as create.

### A4. View completed / active states

1. **UI action:** Inspect status badge column.  
2. **Evidence:** L267–270.  
3. **Classification:** **Verified** for ACTIVE/COMPLETED only.  
4. **V2:** Include on list; add filters/counts as **New V2**.  
5–10. Raw `status` string displayed; non ACTIVE get slate styling (so unknown statuses still show).

### A5. Missed / attendance states / duration / GPS / audit

1. **UI action:** Not on Shifts page (Attendance/Expenses/Timeline or absent).  
2. **Evidence:** Attendance/Expenses files; no reason fields in `ShiftsPage`.  
3. **Classification:** **Partial** / **New V2** / **Not found** as applicable — see matrix §3.  
4. **V2:** Prefer Attendance APIs for missed/derived statuses; Shifts revisions API for audit; do not invent GPS writes without product sign-off.

---

## Appendix B — Unified vs separate write endpoints (decision record)

| Approach | Pros | Cons | Fit to legacy UI |
|---|---|---|---|
| **A. Unified POST/PATCH** (recommended core) | One validator, one audit writer, matches single sheet form | Punch wording less explicit | **Best fit** |
| **B. Separate create / close / edit completed** | Clearer product language | Three code paths for one form; drift risk | Poor — UI does not distinguish |
| **C. Command bus** `POST /commands` with `UPSERT` / `PUNCH_IN` / `PUNCH_OUT` | Explicit actions + shared pipeline | Extra indirection | Good if V2 adds distinct buttons |
| **D. Revisions as separate read API** | Audit read ≠ mutate | — | **Required for New V2** regardless |

**Choice for V2:** Implement **A** as the source of truth; optionally expose **C**-style aliases that call the same domain service; always persist revisions via **D**.
)
