# Business Rules — Location Master

**Source system:** Field Commander Admin (`earthflow-admin-live`)  
**Module:** Location Master  
**Related routes / keys:** `/locations`, permission module `locations`  
**Primary sources:** `src/pages/LocationMasterPage.tsx`, `src/components/RouteBuilderDialog.tsx`, `src/components/FarmerDetailSheet.tsx`, `src/pages/FarmersPage.tsx`, `src/pages/RoutesPage.tsx`, `src/components/TerritoryViewSheet.tsx`, `src/components/AttendanceTimelineSheet.tsx`, `src/components/SERoutesSheet.tsx`

This document describes **business behavior** for Location Master as implemented in the reference project. It is not a redesign.

Legend:

- **Confirmed** — directly supported by implementation  
- **Implementation Detail** — how the old app encodes the rule  
- **Unconfirmed** — referenced or suspected but not provable from this repository  

---

## 1. Module Purpose

### Confirmed

Location Master maintains the **territory hierarchy** used as the geographic catalog for the admin/mobile ecosystem:

**District → Taluka → Village**

UI copy: “Manage your territory hierarchy: Districts, Talukas, and Villages.”

It is the **authoritative master list** for district/taluka/village names consumed when:

- Building **Territory Routes** (cascading pickers)  
- Editing **Farmer** district/taluka (and loading villages for a taluka)  

### Confirmed — what Location Master does *not* own

- **State** is **not** an entity in Location Master. States are hard-coded lists elsewhere (`INDIAN_STATES`).  
- Routes do **not** store FKs to `districts`/`talukas`/`villages`; they store **name strings** inside `routes.locations` JSON.  
- Farmers store location as **strings** (`farmers.village`, `personal_details.city` = district, `personal_details.taluka`), not FKs to master tables.  
- **Dealer** location pickers in admin use an **external GitHub Indian cities/villages JSON**, not Location Master tables (conflict / dual source — see §20).

---

## 2. Hierarchy

### Confirmed hierarchy

```
District (districts)
  └── Taluka (talukas.district_id → districts.id)
        └── Village (villages.taluka_id → talukas.id)
```

### Confirmed parent requirements (application behavior)

| Question | Answer from code |
|---|---|
| Must a Taluka belong to a District? | **Yes** — create payload always sets `district_id = activeDistrict.id`; Add Taluka only when a district is selected |
| Must a Village belong to a Taluka? | **Yes** — create payload always sets `taluka_id = activeTaluka.id`; Add Village only when a taluka is selected |
| Is State part of this hierarchy? | **No** in Location Master tables |

### Unconfirmed

Whether DB enforces NOT NULL FKs / ON DELETE CASCADE (no local DDL for these tables).

---

## 3. Entities and Relationships

### Confirmed entities (from usage)

| Entity | Table | Fields used by app |
|---|---|---|
| District | `districts` | `id`, `name` (+ `select *`) |
| Taluka | `talukas` | `id`, `name`, `district_id` |
| Village | `villages` | `id`, `name`, `taluka_id` |

### Confirmed relationships

1. Taluka → District via `district_id`  
2. Village → Taluka via `taluka_id`  
3. **Consumers store names, not ids:**
   - `routes.locations[]`: `{ state, district, taluka, villages: string[] }`  
   - Farmer: `village` column + `personal_details.city` (district name) + `personal_details.taluka`

### Confirmed lookup pattern in consumers

Route Builder and Farmer edit resolve master rows by **matching `name` strings**, then load children by id:

- Find district where `d.name === selectedDistrictName` → use `d.id` to load talukas  
- Find taluka where `t.name === selectedTalukaName` → use `t.id` to load villages  

---

## 4. District Creation / Edit / Delete

### Confirmed create

1. Requires `locations.can_edit`.  
2. Payload: `{ name: trimmedName }`.  
3. No parent.  
4. Name required (non-empty after trim; form `required`).  

### Confirmed edit

1. Updates `name` (and only name in payload) for the district id.  
2. Does not touch child talukas/villages in client code.  

### Confirmed delete

1. Requires confirm:  
   `Are you sure you want to delete {name}? This will also delete all data inside it.`  
2. Client executes: `DELETE FROM districts WHERE id = …` **only** (single-row delete).  
3. If deleted district was active, UI clears active district/taluka and child lists.  

### Confirmed conflict — delete message vs client behavior

The confirm dialog **claims** cascading delete of “all data inside it.” The client **does not** delete talukas/villages explicitly. Whether the database cascades is **Unconfirmed**. If DB does not cascade, delete may fail on FK or leave orphans — not handled specially in UI beyond showing `error.message`.

---

## 5. Taluka Creation / Edit / Delete

### Confirmed create

1. Requires `can_edit` **and** an active District.  
2. Payload: `{ name, district_id: activeDistrict.id }`.  
3. UI shows “Adding to District: {activeDistrict.name}”.  

### Confirmed edit

1. Opens with existing name.  
2. Save payload still includes `district_id: activeDistrict.id` (current selected parent), not a free choice of new parent.  
3. **No UI to re-parent** a taluka to another district.

### Confirmed delete

Same confirm wording about cascading; client deletes only the taluka row; refreshes taluka list for active district; clears villages if that taluka was active.

---

## 6. Village Creation / Edit / Delete

### Confirmed create

1. Requires `can_edit` **and** an active Taluka.  
2. Payload: `{ name, taluka_id: activeTaluka.id }`.  
3. UI shows “Adding to Taluka: {activeTaluka.name}”.  

### Confirmed edit

1. Name-only intent; payload also re-asserts `taluka_id: activeTaluka.id`.  
2. **No UI to re-parent** village to another taluka.

### Confirmed delete

Single-row delete from `villages`; refresh village list for active taluka.

### Confirmed UI note

Village rows are not “selected” for a fourth level (`onClick` empty; `isActive` always false). Edit/Delete icons still work when `can_edit`.

---

## 7. Required / Optional Fields

### Confirmed

| Entity | Required fields in UI | Optional |
|---|---|---|
| District | `name` | none in UI |
| Taluka | `name`, parent District (via selection) | none |
| Village | `name`, parent Taluka (via selection) | none |

No codes, aliases, geo coordinates, status flags, or state fields on master entities in this module.

---

## 8. Validation Rules

### Confirmed (Location Master page)

1. Name must be non-empty after trim (empty submit returns early / HTML `required`).  
2. No client-side max length.  
3. No client-side uniqueness check (duplicate names allowed unless DB rejects).  
4. No format/regex on names.  
5. Cannot add taluka without selecting district; cannot add village without selecting taluka.

### Unconfirmed

DB unique constraints (global or per-parent).

---

## 9. Uniqueness Rules

### Confirmed from application code

**None enforced in the SPA.** Duplicate district names, or duplicate taluka names under the same district, or duplicate village names under the same taluka, are not prevented client-side.

### Confirmed risk for consumers

Consumers resolve parents by **first name match** (`find(d => d.name === …)`). Duplicate district names would make taluka loading **ambiguous** (first match wins).

### Unconfirmed

Server/DB uniqueness.

---

## 10. Parent–Child Dependency Rules

### Confirmed

1. Children are always created under the **currently selected** parent.  
2. Selecting a district resets taluka selection and clears village list, then loads that district’s talukas.  
3. Selecting a taluka loads that taluka’s villages.  
4. Editing does not provide changing parent; parent id is re-sent from current selection on save.  
5. Renaming a district/taluka/village **does not** update existing `routes.locations` strings or farmer string fields (no sync job in repo).

### Confirmed cascading selection (Location Master UI)

```
Select District → load Talukas(district_id); clear Taluka & Villages
Select Taluka   → load Villages(taluka_id)
```

---

## 11. Cascading Selection Behavior (Consumers)

### Confirmed — Route Builder (`RouteBuilderDialog`)

Territory block fields:

1. **State*** — from hard-coded `INDIAN_STATES` (Gujarat, Maharashtra, Rajasthan, Madhya Pradesh, Karnataka, Punjab, Haryana); default new block state = `Gujarat`  
2. **District*** — names from `districts` table (enabled after state selected; **district list is not filtered by state**)  
3. **Taluka*** — from `talukas` where `district_id` matches district **name**  
4. **Villages*** — multi-select of village **names** from `villages` where `taluka_id` matches  

Cascade clears:

- Change state → clear district, taluka, villages  
- Change district → clear taluka, villages  
- Change taluka → clear villages  

Validation before save: every block must have state, district, taluka, and **at least one** village.

Persisted shape (names only):

```json
{ "state": "Gujarat", "district": "<name>", "taluka": "<name>", "villages": ["<name>", "..."] }
```

### Confirmed conflict — State vs District linkage

District dropdown requires a state to be selected, but districts are loaded **globally** from Location Master with **no state attribute**. Choosing “Maharashtra” still shows the same district list as “Gujarat.”

### Confirmed — Farmer admin edit (`FarmerDetailSheet`)

When editing:

- State from `INDIAN_STATES`  
- District options from `districts.name` stored into `personal_details.city`  
- Taluka options from Location Master; stored in `personal_details.taluka`  
- Changing district clears taluka and village; changing taluka clears village  
- Villages for the selected taluka are **fetched into `dbVillages`**, but **no edit control in the form binds to `dbVillages`** (village selector UI missing despite fetch + village being required on save)

### Confirmed — Dealer admin edit (dual source)

`DealerDetailSheet` loads district/taluka options from external GitHub dataset by state — **not** from `districts`/`talukas`/`villages`. Village is free-text. This diverges from Location Master.

---

## 12. Delete Restrictions

### Confirmed in SPA

1. Delete available only with `locations.can_edit`.  
2. Always asks for confirmation.  
3. No pre-check for child counts, route references, or farmer references.  
4. Relies on DB error toast if delete fails.

### Unconfirmed

- Whether deleting a district used in routes is blocked  
- Whether FK cascade deletes children  
- Soft-delete / archive (none in UI)

---

## 13. Update Restrictions

### Confirmed

1. Only **name** is editable in Location Master UI.  
2. Parent cannot be changed through a dedicated control.  
3. No bulk rename / merge tools.  
4. Rename does not cascade to consumers storing names.

---

## 14. Search / Filter Behavior

### Confirmed (Location Master page)

- Lists ordered by `name` ascending.  
- No search box on Location Master itself.  
- Navigation is browse-by-selection (3 columns).

### Confirmed (downstream filters using location *data*)

Farmers directory filters by district/taluka/village **string fields on farmer records**, and maps village → route name via route location village strings (case-insensitive). That mapping depends on Location Master **only indirectly** (because routes were built from master names).

---

## 15. How Locations Are Used by Territory Routes

### Confirmed

1. Route Builder reads Location Master for cascading district/taluka/village pickers.  
2. Saved routes embed **denormalized names** in `locations` JSON.  
3. Routes page / territory analytics / SE routes sheet display those names.  
4. Village membership of a route is the list of village **name strings** on the route.  
5. “Other” / orphan villages logic on Routes/Territory views compares farmer village strings to route village strings (case-normalized), not master ids.  
6. Attendance timeline builds a village→route map from the SE’s routes’ village name lists.

### Confirmed implication

If a village is renamed or deleted in Location Master, **existing routes keep old names** until manually edited. Farmer–route matching uses string equality on those stored names.

---

## 16. How Locations Are Used by Farmers

### Confirmed storage

| Concept | Farmer field |
|---|---|
| Village | `farmers.village` (text) |
| District | `personal_details.city` (also surfaced as `district` in list views) |
| Taluka | `personal_details.taluka` |
| State | `personal_details.state` (from hard-coded states, not master) |

### Confirmed admin validation (when saving farmer profile)

- Village required (min length 2)  
- State required  
- District (`city`) required  
- Taluka required  

### Confirmed farmer–route relationship

`FarmersPage` builds `villageToRoute`:

- For each route location village name → map `village.trim().toLowerCase()` → route `name`  
- Farmer’s village (lowercased) looks up assigned route; else “Unassigned”

Last route written into the map wins if the same village appears on multiple routes (**Implementation Detail** / edge case).

### Confirmed farm cards

Farm card `card_data` may contain its own district/taluka/village strings (displayed in farmer detail); not verified as FK-linked to master.

---

## 17. Permissions

### Confirmed

Module key: **`locations`** (Roles label: “Location Master”).

| Permission | Effect |
|---|---|
| `can_view` | Access page; load districts |
| no view | Access Denied |
| `can_edit` | Show Add / Edit / Delete controls |

Route Builder / Farmer edit use Location Master **data** under their own module permissions (`routes`, `farmers`); they do not re-check `locations` permission when reading master tables.

---

## 18. Status / State Behavior

### Confirmed

No Active/Inactive status on district/taluka/village in this module. Records are simply present or deleted.

---

## 19. Data Ownership / Scoping

### Confirmed

- Location Master data is **global** (not per-SE, not per-territory).  
- Any admin with `locations` view sees the full hierarchy.  
- Routes assign geographic slices of that catalog (by name) to SEs.  

### Unconfirmed

Multi-tenant isolation.

---

## 20. Edge Cases / Conflicts

### Confirmed

1. **Delete confirm claims cascade; client deletes one row only.**  
2. **No uniqueness** enforcement in UI; name-based consumer lookups are ambiguous if duplicates exist.  
3. **Rename does not update** routes/farmers/dealers strings.  
4. **State not in master**, yet Route Builder gates district on state while listing all districts.  
5. **Dealer locations use external JSON**, not Location Master — parallel geography sources.  
6. **Farmer edit loads `dbVillages` but does not expose a village picker** in the personal edit grid (village still required/saved).  
7. District stored as `city` on farmers/dealers (legacy field naming).  
8. Village matching for routes is **case-insensitive trim**; Location Master itself does not normalize case on save.  
9. Same village name under different talukas can collide in farmer→route maps (keyed only by village name, not taluka).  
10. Route “otherVillages” / free-text village variants exist on routes analytics paths — villages not necessarily from master.

### Unconfirmed

- DB cascade on delete  
- Whether mobile onboarding always picks villages from the same master tables  

---

## 21. Cross-Module Effects

| Change in Location Master | Effect |
|---|---|
| Add district/taluka/village | Immediately available in Route Builder / Farmer district-taluka pickers (after reload/fetch) |
| Rename entity | Breaks or desyncs existing route JSON / farmer strings until manually fixed |
| Delete entity | May fail or orphan children (DB-dependent); consumer strings remain; pickers lose option |
| Empty master | Routes cannot select villages; farmer district/taluka lists empty |

Downstream modules that **depend on location names** (not necessarily calling master tables live): Territory Routes analytics, Farmers route assignment column, Attendance timeline village→route labeling, Farm Diary village display, FSPP farmer village display.

---

## 22. Calculations / Derived Values

### Confirmed

None inside Location Master CRUD itself.

Downstream derived uses:

- Village count on a route = count of village name strings in `locations`  
- Farmer assigned route = lookup by normalized village name against route village lists  

---

## 23. Rules a New Stack Must Preserve

1. Maintain hierarchy **District → Taluka → Village** with parent ids on children.  
2. Allow CRUD of **name** at each level; create children only under a selected parent.  
3. Gate module with `locations` **view/edit**.  
4. Supply this catalog to Route Builder cascading pickers; persist route geography as **denormalized names** (unless redesign is explicitly approved outside this document).  
5. Preserve farmer storage of district/taluka/village as **strings**, with district historically in `personal_details.city`.  
6. Preserve farmer↔route linkage by **case-insensitive village name** matching against route location villages.  
7. Keep State as a separate hard-coded list where the old app does (not part of Location Master tables), including the quirk that districts are not state-filtered.  
8. Surface the delete warning semantics as implemented (user believes children are removed) **or** document a deliberate fix if cascade is implemented properly.

---

## 24. Important Unresolved / Conflicting Rules

1. Delete cascade: UI message vs single-row client delete vs unknown DB FK behavior.  
2. Uniqueness of names within parent: not enforced in app.  
3. Dual geography sources: Location Master vs Dealer GitHub JSON.  
4. State required in Route Builder but unrelated to district master data.  
5. Farmer village master list fetched but not wired to an edit selector.  
6. Village-only key for route assignment ignores taluka/district context (name collisions).  
7. No sync when master names change.  
8. No local DDL for `districts` / `talukas` / `villages` in repo migrations.

---

## 25. Cross-Module Dependencies

| Depends on | Why |
|---|---|
| **Roles & Access** | `locations` can_view / can_edit |
| **Auth** | Session required for `/locations` |

| Depended on by | Why |
|---|---|
| **Territory Routes** | Cascading pickers; village lists embedded in routes |
| **Farmers** | District/taluka pickers; village string + route mapping |
| **Attendance timeline** | Village→route map from route location names |
| **Territory analytics** | Village membership of routes / orphan villages |
| **Dealers** | *Does not use this master in admin edit* (external JSON) — intentional divergence |

---

## 26. Evidence / Source Index

| Concern | Source |
|---|---|
| Hierarchy CRUD, selection cascade, permissions, delete confirm | `src/pages/LocationMasterPage.tsx` |
| Route consumption of master + name persistence | `src/components/RouteBuilderDialog.tsx` |
| Farmer district/taluka from master; village fetch | `src/components/FarmerDetailSheet.tsx` |
| Village→route mapping for farmers | `src/pages/FarmersPage.tsx`, `src/components/FarmerTable.tsx` |
| Route village extraction / orphans | `src/pages/RoutesPage.tsx`, `src/components/TerritoryViewSheet.tsx` |
| Attendance village→route map | `src/components/AttendanceTimelineSheet.tsx` |
| Display route blocks | `src/components/SERoutesSheet.tsx` |
| Permission catalog key `locations` | `src/pages/RolesPage.tsx`, `src/components/AppSidebar.tsx` |
| Dealer non-master geography | `src/components/DealerDetailSheet.tsx` |
| Route `/locations` | `src/pages/Index.tsx` |

---

*End of Location Master business rules extraction.*
