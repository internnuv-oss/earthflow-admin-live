# Business Rules — Farmers

**Source system:** Field Commander Admin (`earthflow-admin-live`)  
**Module:** Farmers (Farmer Directory)  
**Related routes / keys:** `/farmers`, permission module `farmers`; related consumers `/fspp-approvals`, `/routes`, `/farm-diary-approvals`, Attendance, Dashboard, Settings `/settings/farmer`  
**Primary sources:** `src/pages/FarmersPage.tsx`, `src/components/FarmerTable.tsx`, `src/components/FarmerDetailSheet.tsx`, `src/components/FarmerMapView.tsx`, plus migration, FSPP Approvals, Territory Routes, Attendance

This document describes **business behavior** for Farmers as implemented in the reference project. It is not a redesign.

Legend:

- **Confirmed** — directly supported by implementation  
- **Implementation Detail** — how the old app encodes the rule  
- **Unconfirmed** — referenced or suspected but not provable from this repository  
- **`UNCONFIRMED — likely implemented outside this admin repository`** — creation/scoring/submission likely in mobile app or remote DB  

---

## 1. Module Purpose

### Confirmed

The Farmers module is an **admin directory and review surface** for farmers onboarded in the field. Admins can:

1. List **submitted** farmers (`farmers` table) merged with **draft** onboardings (`drafts` where `entity_type = 'farmer'`)  
2. Filter/search by status, lifecycle **stage**, geography, SE, date  
3. View a **map** of farmers by village geocoding  
4. Open a detail sheet: Core Profile, FSPP Evaluation (read-only), Farm Cards → Farm Diaries → Crop Observations  
5. **Edit** farmer profile (draft or submitted) when `farmers.can_edit`  
6. Export CSV / Full Data CSV / printable PDF of the **filtered** set  

UI copy: “Farmer Directory” — “total records onboarded by field SEs.”

### Confirmed — what this admin app does **not** do

- No “Create Farmer” UI  
- No “Submit draft → submitted” workflow button  
- No FSPP scoring calculator in admin  
- No Farm Card / Farm Diary create/edit in Farmers module (view only)  
- No farmer delete/deactivate UI  

Those behaviors are **`UNCONFIRMED — likely implemented outside this admin repository`** (mobile + Supabase).

---

## 2. Farmer Entity and Important Fields

### Confirmed — `farmers` table (local migration + app usage)

From migration `supabase/migrations/20260511052322_…sql` and runtime usage:

| Field | Role |
|---|---|
| `id` | Primary key |
| `se_id` | Owning Sales Executive (`profiles.id`); ON DELETE SET NULL |
| `dealer_id` | Optional FK to `dealers`; ON DELETE SET NULL |
| `full_name` | Top-level name |
| `mobile` | Top-level mobile |
| `village` | Top-level village **name string** |
| `status` | Default `'DRAFT'` in migration; directory treats drafts table rows as `DRAFT` and typically shows submitted rows as `SUBMITTED` |
| `personal_details` | JSONB |
| `farm_details` | JSONB |
| `history_details` | JSONB |
| `pdf_url` | Optional dossier URL (typed; little UI use in Farmers list) |
| `created_at` | Onboard timestamp used for sorting/filters/exports |

### Confirmed — fields used at runtime but **not** in local migration

These appear in selects/updates and are therefore live schema (remote):

| Field | Role |
|---|---|
| `fspp_details` | JSON FSPP evaluation payload |
| `update_history` | Array of admin edit audit entries |
| `comments` | Array used by Attendance timeline (visit comments) |

### Confirmed — `personal_details` keys (admin edit + draft mapping)

- `fatherName`, `alternateMobile`, `state`, `city` (**district stored as `city`**), `taluka`, `pincode`  
- Draft display may also use village from flat `draft_data.village`

### Confirmed — `farm_details` keys

- `totalLand`, `landUnit` (`Acres` \| `Bigha`), `irrigatedLand`, `rainFedLand`  
- `majorCrops` (string[]), `soilType` / `otherSoilType`, `waterSource` / `otherWaterSource`  
- `irrigationType`, `farmEquipments` / `otherFarmEquipment`  
- `biofertilizer` (`Don't Know` \| `He knows` \| `Using`)  
- `isIntercropping` (`Yes` \| `No`)  
- `sideTrees`: `{ type, quantity }[]`  
- `cattles`: `{ type, quantity }[]`

### Confirmed — `history_details`

- `pastCrops`: array of `{ cropName, area, areaUnit, yield, yieldUnit, inputUsed[], otherInputUsed, problemsFaced, … }`

### Confirmed — `fspp_details` keys (displayed / consumed)

| Key | Usage |
|---|---|
| `score` | Display; analytics average |
| `category` | e.g. Category A/B/C/D; FSPP Approvals filter/highlight |
| `statusLabel` | Badge; analytics “bio stage” fallback |
| `committedLand`, `committedLandUnit` | FSPP Approvals land filter; display |
| `totalLand` | FSPP view (distinct from farm_details.totalLand) |
| `mindsetA`–`mindsetD` | Evaluation metrics display |
| `bioAwareness`, `glsKnowledge`, `seasonalExpense` | Display |
| `isKnockout` | Display as disqualified flag |
| `evaluationDate` | Display; Attendance timeline FSPP event |

### Confirmed — draft entity (`drafts`)

| Field | Role |
|---|---|
| `entity_type` | `'farmer'` |
| `entity_id` | Used as farmer `id` in directory merge |
| `se_id` | Owning SE |
| `draft_data` | Flat/nested JSON of in-progress profile |
| `updated_at` | Shown as `created_at` in directory for drafts |
| `update_history` | Updated on admin draft save |
| `profiles` via `se_id` | “Onboarded By” |

### Confirmed related entities

| Entity | Link |
|---|---|
| `farm_cards` | `farmer_id`, `se_id`, `status`, `card_data`, `boundary_polygon`, `media_urls`, `fspp_approval_status` |
| `farm_diary` | `farmer_id` and/or `farm_card_id`; plot/soil fields; polygons; sowing flags |
| `crop_observation_sessions` | `farm_diary_id` → samples/parameters; SOP stages |
| `routes` | Village name → route name mapping (not FK) |
| `profiles` | SE name via `se_id` |

---

## 3. Lifecycle Overview (as visible in admin)

### Confirmed progression (UI “Stage”)

Derived by `getFarmerStage` — **not** a stored column:

1. **Onboarding** — default  
2. **FSPP** — `fspp_details` exists and has ≥1 key  
3. **Farm Card** — at least one `farm_cards` row for `farmer_id`  

Priority: Farm Card > FSPP > Onboarding.

### Confirmed status labels in directory

- Rows from `drafts` → `status: 'DRAFT'` → badge “Saved Draft”  
- Rows from `farmers` → typically `SUBMITTED` (or whatever is stored) → badge shows status or “Pending” if empty  

### Confirmed — draft → submitted transition

**Not implemented in this admin repository.**  
Admin never inserts into `farmers` or deletes drafts on “submit.”

**`UNCONFIRMED — likely implemented outside this admin repository`:** mobile completes onboarding, writes `farmers` (status SUBMITTED), populates JSON fields, removes/updates draft.

---

## 4. Farmer Creation / Onboarding Rules

### Confirmed (admin)

Admin **cannot create** farmers. Directory is read + edit of existing records.

### Unconfirmed (outside repo)

Full mobile onboarding rules, required fields at first save, when draft is created, photo/KYC capture, scoring questionnaire, dealer selection, etc.

**Settings page** (`/settings/farmer`) defines UI templates for farmer scoring/commitments but **does not persist** (`form_templates` upsert is TODO). Seed content includes land-holding scoring tiers and commitments (KYC, land ownership, bio inputs, field visit consent). Whether mobile uses these is **`UNCONFIRMED — likely implemented outside this admin repository`**.

---

## 5. Required / Optional Fields (Admin Edit Validation)

### Confirmed — `validateForm` in `FarmerDetailSheet`

**Required**

| Rule |
|---|
| Full Name — trim, min 2 chars |
| Father’s Name — min 2 |
| Mobile — exactly 10 digits |
| Village — min 2 |
| State — min 2 |
| District (`pd.city`) — min 2 |
| Taluka — min 2 |
| Total Land — present and `parseFloat > 0` |
| ≥1 Major Crop |
| ≥1 Soil Type |
| ≥1 Water Source |
| If Soil includes `Others` → `otherSoilType` required |
| If Water includes `Others` → `otherWaterSource` required |
| If Equipments includes `Others` → `otherFarmEquipment` required |

**Optional / conditional**

| Field | Rule |
|---|---|
| Alternate Mobile | If present, must be 10 digits |
| Pincode | If present, must be 6 digits |
| Irrigated / rain-fed land, irrigation, equipment, biofertilizer, intercropping, trees, cattle, past crops | Not required by validator |

### Confirmed conflict — required village / full name without edit controls

- Validation requires **Village** and **Full Name**, but the Personal edit form has **no Full Name input** and **no Village picker/input** (though `dbVillages` is loaded).  
- Changing District/Taluka **clears** `village` in state → subsequent Save can fail validation with no UI to re-enter village.  

---

## 6. Draft vs Submitted Behavior

### Confirmed load merge (`FarmersPage`)

1. Load all `farmers` (chunked 1000) with `profiles:se_id(name)`  
2. Load all `drafts` where `entity_type = 'farmer'`  
3. Map drafts into farmer-shaped rows (`id = entity_id`, status DRAFT, flatten `draft_data`)  
4. Concatenate; set `has_farm_card` from global `farm_cards.farmer_id` set  
5. Normalize district/taluka display:  
   - DRAFT: use mapped `district`/`taluka` from draft_data  
   - else: `personal_details.city` / `personal_details.taluka`  
6. Sort by `created_at` descending  

### Confirmed save targets

| Status | Persist to |
|---|---|
| `DRAFT` | `drafts.update({ draft_data, updated_at, update_history })` matching `id` **or** `entity_id` |
| not DRAFT (submitted) | `farmers.update({ full_name, mobile, village, personal_details, farm_details, history_details, update_history })` |

### Confirmed draft_data rewrite shape on admin save

Admin writes a **flat** object:

`{ fullName, mobile, village, ...pd, ...fd, sideTrees, cattles, pastCrops }`

Does **not** re-include `fspp_details` or other prior `draft_data` keys → **risk of wiping FSPP (or other) draft fields** if they existed.

### Confirmed submitted save

Does **not** update `fspp_details`, `se_id`, `dealer_id`, `status`, or `pdf_url`.

---

## 7. Status / State Values and Transitions

### Confirmed values used in UI

- `DRAFT` (directory drafts; farm card status; farm_cards default display)  
- `SUBMITTED` (farmers; badge default)  
- Farm card `fspp_approval_status`: `PENDING` (default if null), `APPROVED`, `REJECTED`  
- Farm diary: `is_sowing_done` → “Sown” vs “Planning” / “Pre-Sowing”  

### Confirmed admin transitions

- Admin **does not** change farmer `status` DRAFT↔SUBMITTED.  
- Admin **can** change farm card `fspp_approval_status` in FSPP Approvals module (not Farmers page).  

### Unconfirmed

When `farmers.status` is set; whether drafts and farmers rows can coexist for same person; cascade rules.

---

## 8. Profile Completeness

### Confirmed

There is **no** `is_profile_complete` flag on farmers (unlike SE `sales_executive.is_profile_complete`).

“Completeness” in admin is implied by:

- Being in `farmers` vs `drafts`  
- Stage progress (Onboarding → FSPP → Farm Card)  
- Admin edit validator when saving  

Dashboard KPI: total farmers = `farmers` count + `drafts` (farmer) count; pending = drafts only.

---

## 9. Sales Executive Assignment

### Confirmed

- Ownership field: `se_id` (and draft `se_id`).  
- Displayed as **“Onboarded By”** via `profiles.name`.  
- Admin edit **does not** reassign `se_id`.  
- Territory/Routes analytics filter farmers by `se_id`.  

### Confirmed conflict — “Assigned SE” in exports

`villageToSE` state is declared but **never populated**. Full Data CSV and PDF columns labeled “Assigned SE” therefore resolve to **“Unassigned”** always, while “Onboarded By” correctly uses `profiles.name`.

True SE ownership is **`se_id`**, not village→SE map.

---

## 10. Dealer Relationship

### Confirmed schema

`farmers.dealer_id` → `dealers.id` (nullable, SET NULL on dealer delete).

### Confirmed in Farmers UI

`dealer_id` is on `FarmerRow` type but **not displayed, edited, or filtered** in Farmers module.

### Confirmed related (Dealers module)

Dealers store `demo_farmers_data` JSON — **not** the same as `farmers.dealer_id` links.

### Unconfirmed

When/how `dealer_id` is set (mobile); business meaning of linking a farmer to a dealer.

---

## 11. District / Taluka / Village Relationship

### Confirmed

- Location Master: District → Taluka → Village (name strings on farmer).  
- Farmer stores district as **`personal_details.city`** (naming quirk).  
- Top-level `village` column + optional village inside personal/draft data.  
- Admin edit: district/taluka options from Location Master by **name**; changing district clears taluka and village.  
- No FK from farmer to `villages.id`.  

### Confirmed conflict

Villages loaded into `dbVillages` during edit but **no village select control** is rendered.

---

## 12. Route Relationship / Mapping

### Confirmed

- Not a DB FK.  
- `FarmersPage` builds `villageToRoute`: for each route’s `locations[].villages[]`, map `village.trim().toLowerCase()` → `route.name`.  
- **Last write wins** if the same village appears on multiple routes.  
- Table column “Route Name”; CSV export uses same map; missing → “Unassigned”.  

### Confirmed consumers elsewhere

Territory Views match SE’s farmers to routes by village name; Attendance builds village→route maps from SE routes.

---

## 13. FSPP Information and Relationship

### Confirmed

- Stored on farmer as `fspp_details` JSON (not a separate table).  
- Admin FSPP view is **read-only**.  
- Presence of non-empty object advances stage to FSPP (unless Farm Card exists).  
- FSPP Approvals filters farm cards using farmer’s `fspp_details.category`, `committedLand`, `committedLandUnit`.  
- Category A highlighted specially in Approvals UI.  

### Confirmed — scoring algorithm

**Not present** in this repository. Settings farmer template is non-persisted seed UI and does not match the rich FSPP fields shown in detail (mindsets, knockout, etc.).

**`UNCONFIRMED — likely implemented outside this admin repository`:** how score/category/knockout are computed and written.

---

## 14. Farm Card Relationship

### Confirmed

- `farm_cards.farmer_id` associates plots to farmer.  
- Also has `se_id`, `status` (`DRAFT` vs non-DRAFT treated as completed in analytics), `card_data` (geography, soil/water, livestock, yieldHistory, fieldNumber, areas), `boundary_polygon`, `media_urls`, `fspp_approval_status`.  
- Farmers directory sets `has_farm_card` if any card exists for id.  
- Detail: list cards → card detail tabs (Details | Farm Diaries).  
- Admin does not create/edit/delete cards here.  

### Confirmed — FSPP Approvals (cross-module)

Approving/rejecting updates **`farm_cards.fspp_approval_status` only** — does not mutate farmer `fspp_details`.

### Unconfirmed

When cards are created; required fields; how status leaves DRAFT.

---

## 15. Farm Diary Relationship

### Confirmed dual linkage patterns

| Context | How diaries are loaded |
|---|---|
| FarmerDetailSheet | `.eq('farm_card_id', selectedFarmCard.id)` |
| Territory / Routes analytics | `.in('farmer_id', farmerIds)` or global by farmer |

So diaries are associated with **farmer** and optionally **farm card**. Exact create-time rules: **`UNCONFIRMED — likely implemented outside this admin repository`**.

### Confirmed diary fields shown

Farm name, plot area/unit, land status, soil/water nutrients, sowing date / `is_sowing_done`, historical fields, `diary_polygon`, nested `crop_observation_sessions` (health score, DAS, samples, parameters), SOP stage timeline from `sop_crop_stages` for selected crop.

### Confirmed

Admin Farmers module does not create/edit diaries or observations.

---

## 16. Farmer Editing Rules (Admin)

### Confirmed

1. Requires `farmers.can_edit` (sheet uses `getModulePerm('farmers').can_edit`; prop `canEdit` is passed but unused for the Edit button).  
2. Edit only in **Core Profile** view (Personal / Farm / History tabs).  
3. FSPP and Farm Cards/Diaries are view-only.  
4. Same validation for draft and submitted.  
5. Appends `update_history` entry: `{ timestamp, action: 'Admin Edited Profile', updated_status: f.status }`.  
6. `onSaved` callback supported but **FarmersPage does not pass it** → list may stay stale until reload.  

### Confirmed — cannot edit via admin

`se_id`, `dealer_id`, `status`, `fspp_details`, farm cards, diaries.

---

## 17. Delete / Deactivation

### Confirmed

No delete, archive, or deactivate action in Farmers UI.

Schema: deleting a dealer sets `farmers.dealer_id` null; deleting an SE profile sets `se_id` null — **no cascade delete of farmers**.

---

## 18. Permissions and Access

### Confirmed

| Permission | Effect |
|---|---|
| `farmers.can_view` | Access directory; Access Denied otherwise |
| `farmers.can_edit` | Show Edit/Save on profile |

Related mobile permission keys (Roles page; not enforced in this web Farmers page): `mobile_farmer`, `mobile_farmer_onboard`.

FSPP Approvals uses separate key `fspp_approvals`.

Admin scoping: **global** (all SEs’ farmers); no TH territory filter in queries.

---

## 19. Search / Filter Behavior

### Confirmed filters (`FarmerTable`)

| Filter | Meaning |
|---|---|
| Date From/To | `created_at` (drafts use draft `updated_at` as created_at) |
| Status | DRAFT / SUBMITTED / etc. |
| Stage | Single-select: Onboarding / FSPP / Farm Card (derived) |
| District, Taluka, Village | Exact match on display fields |
| Onboarded By | SE profile name |
| Text search | name, mobile, village, taluka, district, SE name |

Exports use **filtered** dataset (`filteredData`).

---

## 20. History / Update Tracking

### Confirmed

- Cultivation history: `history_details.pastCrops`  
- Admin audit: `update_history` array append on save  
- Attendance: `farmers.comments` array of dated comments (read for timeline)  

No full change-diff audit of field values.

---

## 21. Documents / Media

### Confirmed

- Farmer `pdf_url` exists in schema/types; directory does not emphasize it.  
- Farm card `media_urls` object: images/videos in detail view.  
- Observation sample photos via `sample_photo_file_path` / upload parameters.  

### Unconfirmed

Who uploads farmer PDF; storage provider for farmer dossier.

---

## 22. Export Behavior (Business Capability)

### Confirmed three exports

1. **CSV** — Sr, Name, Mobile, Route Name, Village, Taluka, District, Onboarded By, Date, Status  
2. **Full Data CSV** — expands personal/farm/history; dynamic cattle/tree columns; past crop columns; converts Bigha→Acres (`×0.4`) and yield Tonnes/Quintals→Kg for export; BOM UTF-8  
3. **PDF** — print HTML table (includes broken Assigned SE column — always Unassigned)

---

## 23. Map / Geographic Behavior

### Confirmed (`FarmerMapView`)

- Markers for filtered farmers.  
- Green = non-DRAFT; orange = DRAFT.  
- Position from hardcoded village dictionary (`"village, district"` → lat/lng), else Nominatim geocode (`…, Gujarat, India`), else district fallback / Gujarat center.  
- Scatter offset from farmer id hash so overlapping villages don’t stack.  
- Not farm-boundary polygons (those are on Routes / Territory maps via farm_cards/diary polygons).  

---

## 24. Calculations / Derived Values

| Derived | Rule |
|---|---|
| Stage | Farm Card if any card; else FSPP if `fspp_details` nonempty; else Onboarding |
| `has_farm_card` | Existence of any `farm_cards` row for farmer id |
| Route Name | Village lowercased → last matching route name |
| Export land acres | Bigha × 0.4 |
| Export yield kg | Tonnes × 1000; Quintals × 100 |
| Territory analytics | Uses farmer farm/FSPP fields (see Territory Routes doc) |
| Dashboard counts | farmers + farmer drafts; pending = drafts |

---

## 25. Edge Cases

### Confirmed

1. Village/full name required on save but not editable in form; district change clears village.  
2. Admin draft save may drop `fspp_details` from `draft_data`.  
3. Same village on multiple routes → ambiguous Route Name.  
4. `villageToSE` never filled → Assigned SE always Unassigned in some exports.  
5. Draft `id` is `entity_id`; farm cards for drafts unlikely unless mobile uses same id early.  
6. Farmers table may still contain `status = DRAFT` per migration default — directory also injects drafts from `drafts` table (possible dual representation).  
7. Map geocoding assumes Gujarat.  
8. Detail sheet after save may not refresh list.  
9. `dealer_id` unused in Farmers UX.  
10. Farm diaries listed under card (`farm_card_id`) vs analytics by `farmer_id` — possible orphan diaries if card link missing.

---

## 26. Cross-Module Effects

| Module | Interaction |
|---|---|
| Sales Executives | `se_id`; SE detail counts farmers; Onboarded By |
| Location Master | District/taluka (and intended village) names for edit |
| Territory Routes | Village coverage, orphans, analytics, polygons |
| FSPP Approvals | Farm cards + farmer `fspp_details` for review |
| Farm Diary ops | Diaries/observations; farmer join |
| Attendance | Farmer create events, FSPP evaluationDate, comments, farm cards |
| Dealers | Optional `dealer_id`; demo_farmers_data separate |
| Dashboard | Farmer KPIs |
| Retail | Orders store `farmer_name` / `farmer_mobile` text — not necessarily `farmers.id` |
| Roles | `farmers`, mobile farmer keys |
| Settings (farmer) | Non-persisted scoring/commitment templates |

---

## 27. Rules a New Stack Must Preserve

1. Represent farmers as submitted records plus separate farmer drafts; merge in directory with DRAFT status.  
2. Own farmers by SE (`se_id`); show onboarded-by name.  
3. Store location as name strings; district in personal details as `city`.  
4. Resolve route display by village name against routes.locations (document collision behavior).  
5. Derive lifecycle stage: Onboarding → FSPP (nonempty `fspp_details`) → Farm Card (any card).  
6. Allow admin profile edit of personal/farm/history with the listed validations; persist draft vs submitted to different stores; append update_history.  
7. Do not require admin to create farmers or compute FSPP scores if those remain mobile responsibilities — but preserve read model of `fspp_details` and farm card/diary drill-down.  
8. Link farm cards by `farmer_id`; support farm diaries by farmer and/or farm card; observations under diary.  
9. Gate view/edit with `farmers` permissions; keep admin directory globally scoped unless product changes.  
10. Preserve export semantics (especially land/yield unit conversion in Full Data CSV).  

---

## 28. Important Unresolved / Conflicting Rules

1. Draft→submitted transition and farmer creation: outside this repo.  
2. FSPP scoring algorithm: outside this repo; Settings template unused.  
3. Edit form missing Full Name / Village controls vs required validation.  
4. Admin draft save may wipe nested draft fields (e.g. FSPP).  
5. Assigned SE export column broken (`villageToSE` empty).  
6. `dealer_id` schema vs no Farmers UI.  
7. Dual draft storage (`farmers.status` vs `drafts` table).  
8. Diary association via `farm_card_id` vs `farmer_id` across modules.  
9. Whether `canEdit` prop vs internal `hasEditAccess` should differ (currently prop unused).  
10. Farm card creation/status transitions and farmer `comments` authoring: outside / sparse.

---

## 29. Cross-Module Dependencies

**Depends on:** Profiles/SE, Location Master (edit), Routes (route column), Farm Cards/Diaries/Observations (detail), Permissions.

**Depended on by:** Dashboard, Routes/Territory analytics, FSPP Approvals, Attendance timeline, Farm Diary page, Retail (name/mobile denormalized).

---

## 30. Evidence / Source Index

| Concern | Source |
|---|---|
| Directory merge, exports, route map | `src/pages/FarmersPage.tsx` |
| Filters, stage, columns | `src/components/FarmerTable.tsx` |
| Edit/validation, FSPP view, cards/diaries/observations | `src/components/FarmerDetailSheet.tsx` |
| Map geocoding | `src/components/FarmerMapView.tsx` |
| Base schema | `supabase/migrations/20260511052322_….sql` |
| FSPP card approvals | `src/pages/FsppApprovals.tsx` |
| Territory farmer analytics | `src/components/TerritoryViewSheet.tsx`, `RoutesPage.tsx` |
| Attendance farmer events | `src/components/AttendanceTimelineSheet.tsx` |
| Dashboard KPIs | `src/pages/Dashboard.tsx` |
| Farmer settings templates (non-persist) | `src/pages/SettingsTemplatePage.tsx` |
| Mobile permission labels | `src/pages/RolesPage.tsx` |

---

## 31. Rules That Appear to Live Outside This Repository

Mark these explicitly for the new-stack team:

1. **Creating** farmer drafts and submitted farmers  
2. **Submitting** draft → `farmers` row (status, field mapping, draft cleanup)  
3. **FSPP questionnaire scoring** (score, category, knockout, mindsets, evaluationDate)  
4. **Creating/updating Farm Cards** (card_data, polygons, media, status leaving DRAFT)  
5. **Creating Farm Diaries** and observation sessions / mandatory base visits  
6. Authoring farmer **`comments`**  
7. Setting **`dealer_id`** and any dealer-linked onboarding rules  
8. Generating farmer **`pdf_url`**  
9. Mobile enforcement of `mobile_farmer` / `mobile_farmer_onboard`  
10. Remote RLS policies beyond local migration’s “authenticated ALL”  
11. Persistence of Settings `form_templates` for farmer scoring  

---

*End of Farmers business rules extraction.*
