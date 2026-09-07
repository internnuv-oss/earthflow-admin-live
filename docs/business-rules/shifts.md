# Business Rules — Shifts

**Source system:** Field Commander Admin (`earthflow-admin-live`)  
**Module:** Shifts  
**Related routes / keys:** `/shifts`, permission `shifts`  
**Primary sources:** `src/pages/ShiftsPage.tsx`, consumers in `AttendancePage.tsx`, `AttendanceTimelineSheet.tsx`, `ExpensesPage.tsx`, `ExpenseActionSheet.tsx`

This document describes **business behavior** for Shifts as implemented in the reference project. It is not a redesign.

Legend:

- **Confirmed** — directly supported by implementation  
- **Implementation Detail** — how the old app encodes the rule  
- **Unconfirmed** — not proven here  
- **`UNCONFIRMED — likely implemented outside this admin repository`** — mobile / remote DB  

---

## 1. Module Purpose

### Confirmed

Admin **Shift Management** lets authorized users:

1. List SE shifts for a selected calendar date (optionally filtered by SE)  
2. Create a **manual / override** shift for any non-demo SE  
3. Edit an existing shift’s punch times, personal-vehicle/odometer fields, and distance override  

UI copy: “Adjust, correct, or append field executive shift records.”  
Create button label: **“Create Shift Override”**; editor titles: **“Create Manual Shift”** / **“Modify Existing Shift”**.

Shifts are the primary input for **Attendance** (presence rules + timeline) and **Expenses** (TA/DA distance when `shift_id` is linked).

---

## 2. Shift Entity and Important Fields

### Confirmed — fields used by this admin app

There is **no `shifts` / `shift_locations` table definition** in the checked local migration file. Field inventory is inferred from read/write usage:

| Field | Role in admin |
|---|---|
| `id` | Primary key |
| `se_id` | Owning Sales Executive (`profiles.id`) |
| `date` | Calendar day string `YYYY-MM-DD` (derived from start time on save) |
| `status` | Stored as `ACTIVE` or `COMPLETED` (derived on save) |
| `start_time` | Punch-in as **Unix ms** number |
| `end_time` | Punch-out as Unix ms, or `null` if open |
| `is_personal_vehicle` | Boolean |
| `vehicle_type` | `'two-wheeler'` \| `'four-wheeler'` when personal; else `null` |
| `start_km` | Start odometer (string; may contain non-numeric chars) |
| `end_km` | End odometer (string) |
| `total_distance` | Numeric km (GPS / manual override field) |
| `assigned_route_id` | Read by Attendance timeline only (not edited on Shifts page) |
| `events` | JSON array of timeline events (read by Attendance; not edited on Shifts page) |
| `start_odo_image` / `end_odo_image` | Image URLs shown on Attendance timeline / expenses join (not edited on Shifts page) |

### Confirmed related entity — `shift_locations`

| Field usage | Role |
|---|---|
| `shift_id` | FK to shift |
| `lat`, `lng` | GPS points |
| `timestamp` | Order for path |

Admin Shifts page does **not** create, edit, or delete `shift_locations`. Attendance timeline reads them for map display.

---

## 3. Shift Ownership

### Confirmed

- Every shift belongs to one SE via `se_id`.  
- Directory joins `profiles` and **requires** `profiles.is_demo = false` (`profiles!inner`).  
- SE dropdown for create/filter loads `profiles` where `role = 'SE'` and `is_demo = false`.  
- On edit, **SE cannot be changed** (`disabled={!!editingShift}`).

Admins with `shifts.can_edit` may create/edit shifts for **any** listed (non-demo) SE — no further role scoping in this page.

---

## 4. Sales Executive Assignment

### Confirmed

- Create: user must pick an SE (`se_id` required).  
- Edit: SE fixed.  
- Filter: date + optional single SE or “All Executives.”  

**`UNCONFIRMED — likely implemented outside this admin repository`:** mobile creating shifts for the logged-in SE only.

---

## 5. Route Relationship

### Confirmed

- Shifts UI does **not** assign or edit routes.  
- Attendance timeline resolves “Punched-In Route” from `shift.assigned_route_id` against `routes` for that SE; default label `'Others'` if unmatched.  
- Village→route map from SE’s routes is used to compare farmer-event villages vs punched-in route (display mismatch badges).  

Route selection effect on shift creation: **not implemented in Shifts admin**.

**`UNCONFIRMED — likely implemented outside this admin repository`:** how `assigned_route_id` is set at punch-in.

---

## 6. Creation Rules

### Confirmed — who creates

| Actor | Behavior in this repo |
|---|---|
| Admin with `shifts.can_edit` | Can create via “Create Shift Override” |
| Admin with view only | Can list; no create/edit controls |
| SE via admin UI | No SE self-service in this app |

Default form on create:

- `status` form seed `'ACTIVE'` (overridden on save — see §13)  
- `start_time` = now (datetime-local)  
- `end_time` empty  
- `is_personal_vehicle` false  
- `vehicle_type` `'two-wheeler'`  
- odometer empty; `total_distance` 0  

### Confirmed — required fields on save

1. `se_id`  
2. `start_time`  

Toast if missing: “Executive and Start Time are required.”

### Confirmed — derived fields on save

| Derived | Rule |
|---|---|
| `date` | `new Date(start_time).toISOString().split('T')[0]` (UTC date of start) |
| `status` | `'COMPLETED'` if `end_time` present; else `'ACTIVE'` |
| `start_time` / `end_time` | Stored as `.getTime()` ms |
| `vehicle_type` | Stored only if `is_personal_vehicle`; else `null` |

### Confirmed — duplicate rule (admin)

Before insert/update, query existing shifts with same `se_id` + `date`. If any other row exists → block with “Shift Conflict” / “Duplicate entries are restricted.”

**Implication:** At most **one shift per SE per calendar `date`** as enforced by this admin save path. Overlap of clock times is **not** separately checked — the day uniqueness covers same-day multiples.

Whether mobile can insert a second shift for the same day: **Unconfirmed** (no DB unique constraint visible in local migrations).

---

## 7. Editing Rules

### Confirmed

- Edit requires `shifts.can_edit`.  
- Editable after open: start/end times, personal vehicle flag, vehicle type, start/end odometer, total distance override.  
- Not editable in Shifts UI: SE, route, events, GPS trail, odo images.  
- Completed shifts (`end_time` set / `status` COMPLETED) remain **fully editable** — no lock after completion.  
- Clearing end time on save sets status back to `ACTIVE`.  

No delete or cancel action in Shifts UI.

---

## 8. Required / Optional Fields

### Confirmed (admin form)

| Field | Required? |
|---|---|
| Sales Executive | Yes (create) |
| Start Time (Punch In) | Yes |
| End Time (Punch Out) | Optional |
| Used Personal Vehicle? | Optional (default false) |
| Vehicle Type | Shown only if personal; defaults two-wheeler; not validated beyond UI |
| Start/End Odometer | Optional even if personal |
| Total Distance Override | Optional (defaults 0) |

No rule that personal vehicle **requires** odometer values.

---

## 9. Date / Start / End Time Rules

### Confirmed

- Labels: “Start Time (Punch In Date & Time)”, “End Time (Punch Out Date & Time)”.  
- UI inputs: `datetime-local`.  
- Business `date` column is derived from start, not from a separate date picker (list filter uses a date picker independently).  
- No validation that `end_time > start_time`.  
- No validation against “future only” or business-hours windows in Shifts page.  

### Implementation Detail — timezone risk

`date` uses `toISOString().split('T')[0]`, which is **UTC**. Local evening punches can store the **next/previous UTC day**, affecting filters and Attendance day mapping. Document as implementation behavior, not intentional product rule.

List filter `selectedDate` defaults to today’s local ISO date string `toISOString().split('T')[0]` at mount — same UTC pattern.

---

## 10. Punch-In / Punch-Out Rules

### Confirmed in admin

- Punch-in ≈ setting `start_time`.  
- Punch-out ≈ setting `end_time`.  
- Missing punch-out ⇒ `end_time` null ⇒ status `ACTIVE`.  

Admin does not write punch events into `events` JSON or create `shift_locations` rows when saving.

**`UNCONFIRMED — likely implemented outside this admin repository`:** mobile GPS punch-in/out, photo capture for odo images, event logging.

---

## 11. Status Values and Transitions

### Confirmed statuses written by admin save

| Status | Condition |
|---|---|
| `ACTIVE` | No `end_time` |
| `COMPLETED` | `end_time` is set |

Form field `formData.status` is loaded from DB on edit but **ignored** on save — always recalculated from end_time.

### Confirmed UI

Badge green styling for `ACTIVE`; slate for other (including `COMPLETED`).

No other status vocabulary (e.g. CANCELLED) appears in ShiftsPage.

### Confirmed Attendance overlay (different vocabulary)

Attendance derives **display** statuses from times, not from `shift.status`:

| Condition | Attendance label | Short |
|---|---|---|
| No shift | Absent | A |
| No `end_time` | Active Shift | ON |
| Duration > 7.5 hours | Full Day | P |
| Logout local time between 13:00 and 14:30 inclusive | Half Day | HD |
| Else (punched out, ≤7.5h, outside that window) | `{hours} Hours` | `{hours}h` |

These attendance labels do **not** update `shifts.status`.

---

## 12. Active vs Completed Behavior

### Confirmed

| Concern | ACTIVE (`!end_time`) | COMPLETED (`end_time` set) |
|---|---|---|
| Admin edit | Allowed | Allowed |
| List end column | “—” | Local time |
| Attendance cell | Active Shift | Full/Half/Hours rules |
| Timeline duration | “Active” | Hours to 1 decimal |
| Expense duration | “N/A” if missing end | Hours |

---

## 13. Vehicle / Transport Rules

### Confirmed

- Checkbox: **“Used Personal Vehicle?”** → `is_personal_vehicle`.  
- If checked: show Vehicle Type toggle **Two-Wheeler** (`two-wheeler`) / **Four-Wheeler** (`four-wheeler`). Comment in code: “built to match mobile functionality.”  
- If unchecked: `vehicle_type` saved as `null`; odometer inputs hidden (values may still remain in form state if toggled off after fill — still sent as `start_km`/`end_km` strings from form).  

### Confirmed — public transport

No separate “public transport” enum. Non-personal is simply `is_personal_vehicle = false` and `vehicle_type = null`. Distance then relies on `total_distance` override (or mobile-filled `total_distance`).

### Confirmed — display

List shows 2W/4W badge only when `is_personal_vehicle` is true.

---

## 14. Odometer and Distance Calculation

### Confirmed — admin save

- `start_km`, `end_km` stored as entered (strings).  
- `total_distance` stored as `parseFloat(...) || 0`.  
- **No** server-side or client-side rule that end odometer must be greater than start on save.  
- Admin does **not** auto-compute `total_distance` from odometer on save.

### Confirmed — distance used for display / expenses (shared pattern)

```
strip non-numeric from start_km / end_km
if both parse and end > start:
  odoDistance = round(end - start, 1)
distanceUsed = odoDistance > 0 ? odoDistance : total_distance
```

Used in:

- Shifts list “Distance / Vehicle” column  
- ExpenseActionSheet TA/DA defaults  
- Expenses payout export TA/DA split  

### Confirmed conflict — timeline odometer display

`AttendanceTimelineSheet` computes odo as `Math.max(0, end - start)` **without** requiring `end > start` (negative becomes 0). Also does not strip non-numeric chars the same way. If only `start_km` present → shows “In Progress”. Timeline “GPS Dist.” shows `shift.total_distance` separately from “Odo Dist.”

### Confirmed — manual override vs odometer

When valid odo delta > 0, it **wins** over `total_distance` for list display and expense distance.  
If odo invalid or not greater, **`total_distance` is used** — so manual/GPS total can apply when odo incomplete.

Admin field label: **“Total Distance Override (km)”**.

---

## 15. Location / GPS

### Confirmed

- Optional for admin operations; Shifts page never requires GPS.  
- Timeline: prefer Google Snap-to-Roads of `shift_locations`; else raw points; else fall back to lat/lng on `shift.events` activity locations.  
- Empty path → “No GPS route data available.”  

**`UNCONFIRMED — likely implemented outside this admin repository`:** writing `shift_locations` during the field day.

---

## 16. Duplicate / Overlapping Shifts

### Confirmed

- Admin: **one shift per SE per `date`** (conflict toast).  
- No time-range overlap check.  
- Attendance maps `shiftsMap[se_id][date] = shift` — if multiple rows existed for same day, **last processed in forEach wins** (order from query unspecified beyond week range).  

---

## 17. Validation Summary (Admin)

| Check | Present? |
|---|---|
| SE + start required | Yes |
| Unique SE+date | Yes |
| end ≥ start | No |
| end odo ≥ start odo | No |
| Personal ⇒ odo required | No |
| Route required | No |
| Status manual pick | No (derived) |

---

## 18. Permissions & Role Restrictions

### Confirmed

| Permission | Effect |
|---|---|
| `shifts.can_view` | See Shift Management; Access Denied otherwise |
| `shifts.can_edit` | Show Create + Edit; save mutations |

No separate mobile shift permission key in `RolesPage` (unlike `mobile_distributor`, etc.).

Demo SE exclusion is hard-coded, not permission-based.

---

## 19. Admin Override Behavior

### Confirmed

Admin create/edit is explicitly framed as override/correction of field records. Admins can:

- Invent a full shift for an SE who had none  
- Change punch times after the fact  
- Toggle personal vehicle / type / odometer / distance  
- Re-open a completed shift by clearing end time  

They cannot assign route or GPS via this UI.

---

## 20. Delete / Cancel

### Confirmed

Not implemented on Shifts page.

**Unconfirmed:** soft-delete elsewhere or RLS cascades.

---

## 21. Search / Filter

### Confirmed

- Filter by **date** (exact `date` equality).  
- Filter by **SE** or All.  
- No free-text search on Shifts page.  
- Empty state: “No shifts found for this date criteria.”  
- Ordered by `start_time` descending.  

No export on Shifts page (Attendance has its own monthly CSV from shifts).

---

## 22. Data Ownership / Scoping

### Confirmed

- Global list of non-demo SE shifts (any SE).  
- No TH territory scoping in ShiftsPage.  

---

## 23. Edge Cases

### Confirmed

1. Form `status` ignored on save.  
2. UTC `date` derivation vs local punch clock.  
3. Editing SE blocked; changing start time can change `date` and then collide with another day’s uniqueness.  
4. Unchecking personal vehicle still may submit leftover odometer strings.  
5. Attendance “Days Present” counts any day with a shift row (including Active Shift / Hours), not only Full Day.  
6. Future dates in attendance export show `-` without Absent.  
7. Expense TA rate (₹4 vs ₹8/km) inferred by comparing submitted amount to `distance * 8` after DA — **not** by reading `vehicle_type` from the shift.  

---

## 24. Calculations and Derived Values

### Confirmed in this repository

| Value | Formula / rule |
|---|---|
| Shift status | end_time ? COMPLETED : ACTIVE |
| Shift date | UTC date of start_time |
| List/expense distance | odo (end−start) if end>start else total_distance |
| Attendance hours | (end−start)/3_600_000 |
| Full Day | hours > 7.5 |
| Half Day | logout local decimal hours ∈ [13.0, 14.5] and not already Full Day |
| Expense DA default | distanceUsed > 60 ⇒ ₹150 else ₹0 |
| Expense TA default | distanceUsed × (8 if amount matches 4W heuristic else 4) |

Do not invent other thresholds.

---

## 25. Cross-Module Effects

### Confirmed — Attendance

- Weekly grid keyed by `se_id` + `date` → one shift object.  
- Cell click opens timeline for that shift.  
- Monthly CSV uses same `getAttendanceInfo` rules.  

### Confirmed — Expenses

- Expenses join `shifts:shift_id(...)`.  
- TA/DA review uses shift distance/duration/odo images.  
- Creating/editing a shift in admin does **not** auto-create or update expenses.  

### Confirmed — Routes / Farmers

- Timeline only: route name from `assigned_route_id`; farmer comments / FSPP / farm cards injected as events for the shift’s `date`.  

---

## 26. What Creates a Shift (Answer Sheet)

| Question | Answer from this repo |
|---|---|
| What creates a shift? | Admin insert; also presumed mobile (**outside**) |
| Who may create in admin? | Users with `shifts.can_edit` |
| Multiple shifts same day? | **Blocked** by admin save; DB uniqueness unconfirmed |
| May shifts overlap in time? | Not separately validated |
| What makes ACTIVE? | Missing `end_time` on save |
| What makes COMPLETED? | Non-null `end_time` on save |
| How does end_time affect status? | Presence ⇒ COMPLETED; absence ⇒ ACTIVE |
| Admins create/edit any SE? | Yes, any non-demo SE in list |
| Editable after create? | Times, vehicle, odo, total_distance; not SE/route/events/GPS |
| Read-only after start/complete? | **No** — still editable |
| End odo > start? | Enforced only for **distance display/expense** math, not on save |
| Distance derivation | Prefer odo delta; else total_distance |
| Manual distance override? | Yes via `total_distance` when odo unused |
| Vehicle type required fields? | Type UI only if personal; odo still optional |
| Route selection? | Not on Shifts page |
| Attendance consumption | Day map + status rules + timeline |
| Expenses consumption | Via `shift_id`; distance for TA/DA |
| GPS required? | No for admin; optional trail for timeline |
| Missing punch-out? | ACTIVE; Attendance “Active Shift” |
| Edit after completion? | Allowed |

---

## 27. Rules a New Stack Must Preserve

1. One operational shift per SE per business `date` when using admin create/edit (conflict messaging).  
2. Status = ACTIVE iff no punch-out; COMPLETED when punch-out present.  
3. Store punch times as epoch ms; expose date string for attendance grids.  
4. Personal vehicle flag gates vehicle_type persistence (`two-wheeler` / `four-wheeler` vs null).  
5. Distance consumers prefer valid odometer delta over `total_distance`.  
6. Admin may override times/odometer/distance for any non-demo SE.  
7. Exclude demo SEs from shift lists/filters consistent with Attendance/Expenses.  
8. Preserve Attendance duration/logout half-day/full-day rules that read shift times.  
9. Preserve Expense TA/DA distance > 60 ⇒ DA ₹150 and ₹4/₹8 rate model as implemented (or document intentional change).  
10. Keep `assigned_route_id`, `events`, `shift_locations`, odo images as data the field app may populate even if admin shift editor does not.  

---

## 28. Important Unresolved / Conflicting Rules

1. **Schema not in local migration** — full constraints/defaults unknown.  
2. **UTC date vs local punch** may desync Attendance days.  
3. **Odo math differs** between Shifts/Expenses (`end > start` + strip) vs Timeline (`Math.max(0, end−start)` without strip).  
4. **Expense rate ignores `vehicle_type`**, uses amount heuristic instead.  
5. **Mobile duplicate policy** unknown if admin uniqueness is the only guard.  
6. **`assigned_route_id` / events / GPS / odo images** write path outside admin.  
7. Attendance last-wins if multiple same-day rows exist despite admin guard.  

---

## 29. Cross-Module Dependencies

**Depends on:** `profiles` (SE), Permissions (`shifts`).  

**Consumed by:** Attendance, Expenses (via `shift_id`), Timeline (routes, farmers, farm_cards, shift_locations).  

**Related docs:** `territory-routes.md` (`assigned_route_id`), `sales-executives.md` (demo exclusion), `roles-and-access.md`.

---

## 30. Evidence / Source Index

| Concern | Source |
|---|---|
| Create/edit, uniqueness, vehicle, status | `src/pages/ShiftsPage.tsx` |
| Attendance status engine & week map | `src/pages/AttendancePage.tsx` |
| GPS, route, events, odo images | `src/components/AttendanceTimelineSheet.tsx` |
| TA/DA distance & rates | `src/components/ExpenseActionSheet.tsx`, `src/pages/ExpensesPage.tsx` |
| Permissions / nav | `RolesPage.tsx`, `AppSidebar.tsx`, `PermissionEditor.tsx` |
| Inventory notes | `docs/module-inventory.md` |

---

## 31. Rules That Appear to Live Outside This Repository

1. Primary SE punch-in / punch-out from the field app  
2. Writing `shift_locations` telemetry  
3. Populating `events`, `assigned_route_id`, odo photo URLs  
4. Creating linked `expenses` with `shift_id` and initial TA/DA amount  
5. Any DB unique index or RLS on `shifts`  
6. Public-transport-specific mobile UX beyond clearing personal vehicle  

Mark: **`UNCONFIRMED — likely implemented outside this admin repository`**.

---

*End of Shifts business rules extraction.*
