# Business Rules — Territory Routes

**Source system:** Field Commander Admin (`earthflow-admin-live`)  
**Module:** Territory Routes  
**Related routes / keys:** `/routes`, permission module `routes`  
**Primary sources:** `src/pages/RoutesPage.tsx`, `src/components/RouteBuilderDialog.tsx`, `src/components/SERoutesSheet.tsx`, `src/components/TerritoryViewSheet.tsx`, `src/components/PolygonMap.tsx`, plus consumers (`FarmersPage`, `AttendanceTimelineSheet`, Location Master)

This document describes **business behavior** for Territory Routes as implemented in the reference project. It is not a redesign.

Legend:

- **Confirmed** — directly supported by implementation  
- **Implementation Detail** — how the old app encodes the rule  
- **Unconfirmed** — referenced or suspected but not provable from this repository  

---

## 1. Module Purpose

### Confirmed

Territory Routes lets web admins:

1. **Create and assign** geographic service routes to Sales Executives (SEs)  
2. **Edit / reassign / remove** those routes  
3. Browse routes **grouped by SE**  
4. View **territory drill-downs** (route → villages → farmers) including dealers, analytics, product usage, and maps  
5. Run **global** analytics, product analysis, and a global farm-boundary map  

UI copy: “Manage service routes grouped by Sales Executive.”

A route is a named territory package of one or more **territory blocks**, each block selecting State + District + Taluka + one or more Villages (from Location Master names, denormalized into JSON).

---

## 2. Entities and Data Structure

### Confirmed primary entity: `routes`

Fields used by the app:

| Field | Role |
|---|---|
| `id` | Route primary key |
| `name` | Route display name |
| `se_id` | Assigned Sales Executive (`profiles.id`) |
| `locations` | JSON array of territory blocks |
| `created_by` | Set on create to current admin Auth user id |

### Confirmed `locations` block shape (written by Route Builder)

```json
{
  "state": "Gujarat",
  "district": "<district name string>",
  "taluka": "<taluka name string>",
  "villages": ["<village name>", "..."]
}
```

- Multiple blocks allowed per route.  
- Villages are **name strings**, not FKs to `villages.id`.  
- District/taluka likewise stored as **names**.

### Confirmed optional / legacy “other village” fields (read, not written by Route Builder)

When extracting villages, the app also accepts if present:

- Per location: `otherVillages` | `other_villages` | `other_route_villages` (array or comma-separated string)  
- Per route: `otherVillages` | `other_villages` | `other_route_villages` | `other_route`  

Route Builder **does not** create these fields; they are supported for read/analytics if data exists (likely mobile/legacy).

### Confirmed synthetic UI entity (not a DB row)

**`Others (Out of Route)`** with `id: 'others-custom-route'`, `is_custom_others: true`  

Computed in memory when an SE’s farmers (submitted + drafts) have villages **not** covered by that SE’s official route village lists.

### Confirmed related entities (consumed, not owned by route table)

| Entity | Link to routes |
|---|---|
| SE `profiles` | `routes.se_id`; list page is SE-centric |
| Location Master | Supplies district/taluka/village names for builder |
| Farmers / drafts | Matched to routes by **village name** (and SE ownership) |
| `temp_dealers` | Matched to route villages by village name string |
| `farm_cards` | `se_id` + `boundary_polygon`; linked to farmers for maps/metrics |
| `farm_diary` | via `farmer_id`; `diary_polygon`; `mandatory_base_visits` for products |
| `shifts.assigned_route_id` | Attendance timeline labels punched-in route |

---

## 3. Hierarchy Relationships

### Confirmed conceptual chain

```
Location Master
  District → Taluka → Village (master tables)

Territory Route (DB)
  → se_id → Sales Executive
  → locations[] → state (hard-coded list) + district/taluka/village **names**

Derived (UI)
  → Villages on route
      → Farmers of that SE whose village name matches
      → temp_dealers whose village name matches
      → Farm Cards / Farm Diaries of those farmers (polygons, visits)
```

### Confirmed answers to key relationship questions

| Question | Confirmed answer |
|---|---|
| Can a route contain multiple villages? | **Yes** (multi-select per block; multiple blocks) |
| Can a village belong to multiple routes? | **Yes allowed** — no uniqueness check; farmer→route maps use last write / per-SE official set |
| Can an SE have multiple routes? | **Yes** |
| Can a route be reassigned to another SE? | **Yes** — edit updates `se_id` |
| What happens to villages/farmers/dealers on route delete? | **Unaffected** — only `routes` row is deleted; farmer/dealer data remains; they may appear under “Others (Out of Route)” |
| How is route ownership determined? | **`routes.se_id`** |

---

## 4. What Makes a Route Valid (Create/Update)

### Confirmed validation (`RouteBuilderDialog`)

A route save is rejected unless:

1. An SE is selected (`selectedSe`)  
2. Route name is non-empty after trim  
3. **Every** territory block has:
   - `state`  
   - `district`  
   - `taluka`  
   - `villages.length > 0`  

### Confirmed create fields

- `name`, `locations` (cleaned to state/district/taluka/villages only), `se_id`, `created_by`  

### Confirmed update fields

- `name`, `locations`, `se_id` (reassignment allowed)  

### Confirmed Location Master coupling

District options come from `districts`; talukas/villages cascade by resolving selected **name** to master id, then loading children. State is from hard-coded `INDIAN_STATES` (default new block: Gujarat). District list is **not filtered by state**.

---

## 5. Route Creation Rules

### Confirmed

1. Requires `routes.can_edit`.  
2. Opens builder with empty edit data; at least one territory block (default Gujarat).  
3. User may add/remove blocks (cannot remove last block — `canRemove` only if `locations.length > 1`).  
4. Changing state/district/taluka clears dependent fields (cascade).  
5. Villages multi-select with Select All.  
6. On success, list reloads.

### Confirmed — SE picker includes all `role = 'SE'`

Route Builder does **not** exclude demo SEs, while the Routes list page filters demo SEs with `is_demo.eq.false OR is_demo.is.null`. **Conflict:** a demo SE can receive a route via builder even if not shown on the main SE list.

---

## 6. Route Editing Rules

### Confirmed

1. From “Manage Routes” sheet, Edit opens builder with existing `id`, `name`, `se_id`, `locations`.  
2. All create validations apply.  
3. SE can be changed (reassignment).  
4. Locations replaced wholesale with cleaned JSON.

### Confirmed conflict — synthetic “Others” in Manage Routes

`SERoutesSheet` renders **all** `se.routes`, including the computed `Others (Out of Route)` entry, and shows Edit/Delete when `canEdit`.

- Edit would pass `id: 'others-custom-route'` into builder → update against a non-DB id (**failure / invalid**).  
- Delete/unassign would `DELETE ... WHERE id = 'others-custom-route'` (**no-op or error**).  

Territory View filters `is_custom_others` out of “pure” routes before rebuilding Others — Manage Routes does **not**.

---

## 7. Route Deletion / Unassignment Rules

### Confirmed terminology

UI confirm: “remove this route from the SE?”  
Implementation: **`DELETE FROM routes WHERE id = …`** (hard delete of the route record).  
Toast: “Route Removed” / “The territory has been deleted successfully.”

### Confirmed effects

- Route row gone; SE loses that assignment.  
- No updates to farmers, dealers, farm cards, diaries, or Location Master.  
- Farmers in those villages remain; may surface under **Others (Out of Route)** for that SE.  
- Shifts that stored `assigned_route_id` may retain a dangling id (**Unconfirmed** cleanup).

---

## 8. Assignment Rules

### Confirmed

1. Every persisted route **must** have an `se_id` at save time.  
2. Assignment is the route’s `se_id` field (not a separate join table).  
3. “Unassign” = delete route (not nulling `se_id`).  
4. Multiple routes per SE allowed.  
5. No check that villages are exclusive to one SE or one route.

---

## 9. Required / Optional Fields

| Field | Required |
|---|---|
| Route name | Yes |
| Assigned SE | Yes |
| ≥1 territory block | Yes (UI always has ≥1) |
| Per block: state, district, taluka, ≥1 village | Yes |
| `created_by` | Set on create only |
| otherVillages fields | Optional / legacy read-only for builder |

---

## 10. Duplicate Rules

### Confirmed not enforced

- Duplicate route names (same or different SEs)  
- Same village on multiple routes (same or different SEs)  
- Overlapping territory blocks within one route  

### Confirmed matching collisions

- Farmer “Assigned Route” (Farmers module): village→route map last route wins globally when building map from all routes.  
- Per-SE official village set: a village on any of the SE’s routes counts as “in route.”  

---

## 11. Village Assignment Rules

### Confirmed

1. Villages chosen from Location Master for the selected taluka.  
2. Stored as array of names on each block.  
3. A farmer belongs to a route **for territory views** if:
   - Farmer’s `se_id` equals the route’s SE, **and**  
   - Farmer village string (trim, case-insensitive) equals a village name on that route (or otherVillages fields).  
4. Draft farmers included (village from draft_data).  
5. Submitted farmers used for orphan detection on the list page (`status = 'SUBMITTED'` for orphan scan on RoutesPage; TerritoryView uses SUBMITTED + drafts).

### Confirmed — Others (Out of Route)

Villages appearing on the SE’s farmers/drafts but **not** in the SE’s official route village set (case-insensitive) form a synthetic route “Others (Out of Route).”

### Confirmed conflict — village counting on main table

“Total Villages” per SE **sums** village array lengths across routes (and orphans), **without** de-duplicating the same village name if it appears on two official routes. Orphan villages are counted separately via the synthetic route.

---

## 12. Other-Village Behavior

### Confirmed

- Route Builder does not capture “other” villages.  
- Extractors treat otherVillages-like fields as additional official coverage when present.  
- Synthetic “Others (Out of Route)” is separate: computed from farmer villages outside official coverage, not from those JSON fields.

---

## 13. Dealer Relationships at Route Level

### Confirmed

- Territory View loads **`temp_dealers`** (all rows), then filters by village name match to route villages.  
- Dealers are **not** stored on the route.  
- Displayed as “prospect dealers” / “registered prospect dealers.”  
- Field name variants supported (`village` / `Village` / `VILLAGE`, etc.).  

### Confirmed — not the main `dealers` table

Territory route dealer tab uses `temp_dealers`, not `dealers.se_id`.

### Unconfirmed

How `temp_dealers` is populated / maintained.

---

## 14. Farmer Relationships

### Confirmed

1. Farmers are **not** FK-linked to routes.  
2. Association is **SE + village name**.  
3. Territory drill-down: Route → list villages → farmers in village.  
4. Farmers module shows “Route Name” via global village→route map from `routes.locations`.  
5. Orphan villages drive “Others” bucket for that SE.

---

## 15. Farm Cards / Farm Diaries / Polygons

### Confirmed

| Data | Usage |
|---|---|
| `farm_cards.boundary_polygon` | Map polygons if array length > 2; typed “Farm Card” |
| `farm_diary.diary_polygon` | Map polygons if length > 2; typed “Farm Diary” |
| Card `status` | Analytics: DRAFT vs non-DRAFT = Completed |
| Diary `mandatory_base_visits` | Product analytics (fertilizers_applied / pesticides_applied) |

### Confirmed map scopes

- **Global Map** (Routes page): all farm cards/diaries with polygons (join farmers for titles) — **not filtered by route**.  
- **Territory View Map**: polygons for farmers belonging to the selected SE’s territory (all SE farmers, or filtered by route/village level helpers).  

### Confirmed polygon rules

- Coordinates normalized from `{lat,lng}`, `{latitude,longitude}`, or `[lat,lng]` arrays.  
- Default map center fallback Gujarat.  
- Localhost may use Leaflet fallback vs Google Maps.

---

## 16. Visibility, Scoping, Permissions

### Confirmed permissions (`routes`)

| Permission | Effect |
|---|---|
| `can_view` | See page, territories, analytics, maps |
| no view | Access Denied |
| `can_edit` | Create & Assign; Manage Routes; Edit/Delete route |

### Confirmed SE list filter on Routes page

Only SEs with `role = 'SE'` and `is_demo` false **or null**. Demo SEs hidden from main list (but not from builder — see §5).

### Confirmed scoping

- Admin views are global across SEs (no TH territory filter in queries).  
- Territory View scopes farmers/cards/diaries to the selected SE.  
- Dealers from `temp_dealers` are global then village-filtered.

---

## 17. Status / State Behavior

### Confirmed

No Active/Inactive status on `routes` in this app. Presence = assigned; delete = removed.

Synthetic route `is_custom_others` is a UI flag only.

Farm card statuses appear only in analytics displays.

---

## 18. Analytics — How Metrics Are Calculated

### Confirmed — Overall Executive Performance (global)

For each SE on the filtered list:

**Inputs**

- All farmers + farmer drafts (global fetch, then filter by `se_id`)  
- Farm cards by `se_id`  
- Farm diaries (global) attributed to SE via farmer_id → se_id map  
- `villageCount` = unique village **strings** extracted from that SE’s `routes` (includes synthetic Others if present on `se.routes`)  

**Metrics (`AnalyticsTable.computeMetrics`)**

| Metric | Rule |
|---|---|
| Number of Villages | Passed-in `villageCount` |
| Number of Farmers | Count of farmer+draft entities for SE |
| Completed Profile Farmer | Not draft (`!is_draft`) |
| Draft Farmer | `is_draft` |
| FSPP Enrolled Farmer | Has non-empty `fspp_details`; breakdown by Category A–D if present |
| Average Score | Mean of `fspp_details.score` among FSPP farmers |
| Total Land (Acres) | Sum `farm_details.totalLand` where > 0 |
| Committed Land for Bio | Sum `fspp_details.committedLand` |
| Average Land/Farmer | Total land / farmers with land > 0 |
| Farm Card Built | `total (Draft: x, Completed: y)` from cards by SE; Completed = status ≠ `DRAFT` |
| Farm Diary Built | Count of diaries for SE’s farmers |
| Major Crops | Crop frequency %; crops ≤5% rolled into “Other” |
| Soil Type & % | Top 2 soils by share |
| Biofertilizer Stage | Distribution of `farm_details.biofertilizer` or `fspp_details.statusLabel` |
| Last Visited on | Max of `updated_at`/`created_at` among farmers |

Also builds a **TOTAL (ALL)** column aggregating entities.

Export: print-to-PDF HTML.

### Confirmed — Product Analysis (global / per territory)

From `mandatory_base_visits`:

- Parse `fertilizers_applied` and `pesticides_applied` (JSON array or stringified JSON)  
- Key = `name|||unit`  
- Per entity: use count, quantity sum, % of that entity’s total product uses  
- Global dialog adds TOTAL (ALL) column from all SE visits  

### Confirmed — Per-SE Territory View analytics

Same `AnalyticsTable` / `ProductAnalyticsTable`, but entities = **routes** (including Others), with farmers/visits scoped via village match for that route.

---

## 19. Search / Filter Behavior

### Confirmed

- Main page: paginated SE list (10/page); no free-text search.  
- Builder: searchable selects for SE / state / district / taluka; village checkbox list.  
- No route-name search on list.

---

## 20. Edge Cases

### Confirmed

1. Synthetic Others route appears in Manage Routes with Edit/Delete affordances (unsafe).  
2. Demo SE hidden on list but assignable in builder.  
3. Village counted twice on main “Total Villages” if on two official routes.  
4. Village→route farmer column can conflict if same village on multiple routes (last map write).  
5. Route delete does not cascade to operational data.  
6. State selection does not filter districts.  
7. Renaming Location Master villages does not update route JSON.  
8. Global map ignores route boundaries — shows all polygons.  
9. `temp_dealers` vs real `dealers` dual model.  
10. otherVillages fields readable but not authorable in builder.  
11. Attendance uses `shifts.assigned_route_id` against routes — separate from village matching.

---

## 21. Cross-Module Effects

| Module | Effect |
|---|---|
| Location Master | Source of district/taluka/village names for builder |
| Sales Executives | Routes owned via `se_id`; demo filter inconsistency |
| Farmers | Assigned Route column; orphan villages; territory farmer lists |
| Farm Cards / Diaries | Maps + card/diary counts + product visits |
| Attendance / Shifts | `assigned_route_id` for punched-in route label; village→route map for timeline |
| Dealers (temp) | Prospect dealers by village under routes |
| Roles & Access | `routes` view/edit |

---

## 22. Calculations / Derived Values (Summary)

- Official village set per SE = union of all village/otherVillage strings on SE’s DB routes (lowercased for orphan detection)  
- Orphan villages = SE farmer/draft villages not in official set  
- Farmer-on-route = SE match + village name match  
- Analytics metrics as in §18  
- Polygon inclusion if coordinate array length > 2  

---

## 23. Rules a New Stack Must Preserve

1. Persist routes with `name`, `se_id`, and `locations[]` of `{state, district, taluka, villages[]}`.  
2. Validate SE + name + complete blocks with ≥1 village each.  
3. Allow multiple routes per SE and reassignment via `se_id`.  
4. Treat “unassign” as deleting the route row; do not delete farmers/dealers/villages.  
5. Derive **Others (Out of Route)** from SE farmers/drafts whose villages are outside official coverage.  
6. Associate farmers/dealers to routes by **case-insensitive village name**, scoped by SE for farmers.  
7. Provide territory drill-down Route → Village → Farmers and SE/route analytics including FSPP, land, farm cards/diaries, products.  
8. Render farm card/diary polygons on maps when present.  
9. Gate mutations with `routes` edit permission.  
10. Preserve Location Master name-based cascading for builder (and the state-vs-district quirk unless deliberately redesigned later).

---

## 24. Important Unresolved / Conflicting Rules

1. Manage Routes exposes synthetic Others for edit/delete.  
2. Demo SE: listed filtered vs builder unfiltered.  
3. Total Villages counting may double-count overlapping official villages.  
4. Village uniqueness across routes not enforced; farmer route assignment ambiguous.  
5. `temp_dealers` vs `dealers` — only temp used in territory dealer views.  
6. otherVillages authoring path not in admin builder.  
7. No local DDL for `routes` / polygon schemas in repo migrations.  
8. Effect of deleting route on `shifts.assigned_route_id` unknown.  
9. Global map not route-scoped despite living on Routes page.

---

## 25. Cross-Module Dependencies

**Depends on:** Location Master, Sales Executives / profiles, Roles & Access (`routes`), Auth session (`created_by`).

**Depended on by:** Farmers (route column), Attendance timeline, Territory analytics consumers of farm cards/diaries/visits, operational understanding of SE coverage.

---

## 26. Evidence / Source Index

| Concern | Source |
|---|---|
| SE list, orphans, unassign/delete, global analytics/map | `src/pages/RoutesPage.tsx` |
| Create/update validation, locations JSON, SE assign | `src/components/RouteBuilderDialog.tsx` |
| Manage routes UI | `src/components/SERoutesSheet.tsx` |
| Territory drill-down, dealers, analytics, products, maps | `src/components/TerritoryViewSheet.tsx` |
| Polygon rendering | `src/components/PolygonMap.tsx` |
| Farmer village→route map | `src/pages/FarmersPage.tsx`, `FarmerTable.tsx` |
| Shift assigned route | `src/components/AttendanceTimelineSheet.tsx` |
| Permission key `routes` | `AppSidebar.tsx`, `RolesPage.tsx` |

---

*End of Territory Routes business rules extraction.*
