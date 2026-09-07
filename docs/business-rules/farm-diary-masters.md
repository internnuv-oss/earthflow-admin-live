# Business Rules — Farm Diary Masters

**Source system:** Field Commander Admin (`earthflow-admin-live`)  
**Module:** Farm Diary Masters (SOP configuration)  
**Related routes / keys:** `/farm-diary-masters`, permission `farm_diary_masters`  
**Consumers:** `/farm-diary-approvals` (Farm Diary ops page — **uses `farm_diary_masters` permission in code**), Farmer detail farm-diary observation timeline  
**Primary sources:** `src/pages/FarmDiaryMasters.tsx`, `src/pages/FarmDiaryPage.tsx`, `src/components/FarmerDetailSheet.tsx`, `supabase/functions/auto-translate-parameter/index.ts`

This document describes **business behavior** for Farm Diary Masters as implemented in the reference project. It is not a redesign.

Legend:

- **Confirmed** — directly supported by implementation  
- **Implementation Detail** — how the old app encodes the rule  
- **Unconfirmed** — not proven in this repository  
- **`UNCONFIRMED — likely implemented outside this admin repository`** — mobile, DB triggers, remote schema  

---

## 1. Module Purpose

### Confirmed

Farm Diary Masters is the **admin configuration console** for field SOP (Standard Operating Procedure) content used when Sales Executives run Farm Diaries / crop observation visits.

It manages:

1. **Global masters:** Crops, Crop Stages, GLS Products, Observation Parameters, UOMs  
2. **SOP Groups:** Named sets of crops that share / inherit SOP configuration  
3. **SOP Builder (Layout tab):** Attach ordered stages to selected crops; per stage define applications (product, DAS, dosage…) and observation parameters  
4. **Preview** of a crop’s or group’s full SOP table  

Mobile/field execution of visits is **not** implemented here; this module configures the templates those visits use.

---

## 2. Configuration Hierarchy (Confirmed)

```
Global Masters
├── master_crops (crop_name, crop_category, status)
├── master_crop_stages (stage_name, stage_code)     ← GLOBAL stages, not crop-owned
├── master_gls_products (product + Cloudinary image)
├── master_parameters (label, ui_input_type, options_data)
├── master_uom (uom_name, uom_symbol)
└── parameter_uom_mapping (parameter_id ↔ uom_id, is_default_uom)

SOP organization
└── sop_groups (group_name, category, crop_ids[])

Per-crop SOP (the executable template)
└── sop_crop_stages (crop_id, stage_id, stage_sequence, chemical_recommendation_and_dosage)
      ├── sop_applications (das, product, dosage, method, chemicals, …)
      └── sop_parameters (parameter_id, is_mandatory)
```

### Confirmed answers to hierarchy questions

| Question | Answer |
|---|---|
| Do stages belong globally or per SOP? | **Global** master list (`master_crop_stages`). **Per-crop** attachment & sequence live in `sop_crop_stages`. |
| How is stage order determined? | `sop_crop_stages.stage_sequence` (1-based index of builder stage list). |
| How is DAS stored/used? | On each **`sop_applications.das`**. Forecasts use **minimum DAS** among apps for that stage; target date = `sowing_date + DAS`. |
| Products ↔ stages? | Via `sop_applications.gls_product_id` → `master_gls_products` under a `sop_crop_stage`. |
| Dosage representation? | Free-text `dosage_value`, plus optional `chemical_name` / `chemical_dosage`; stage-level `chemical_recommendation_and_dosage` textarea. |
| Observation params ↔ stages? | `sop_parameters` rows under `sop_crop_stage_id`. |
| Multiple UOMs per parameter? | **Yes**, via `parameter_uom_mapping`; one may be `is_default_uom`. |

---

## 3. Crop Master Rules

### Confirmed fields

| Field | Behavior |
|---|---|
| `crop_name` | Required (trim) |
| `crop_category` | Required; used to filter SOP Builder and name SOP groups |
| `status` | Set to `'Active'` on **create** only; no deactivate UI found |

### Confirmed CRUD

- Create/update via dialog; edit updates name + category.  
- Delete: confirm; removes crop from `sop_groups.crop_ids` (delete empty groups / rename remaining); then `DELETE master_crops`. Does **not** explicitly wipe `sop_crop_stages` for that crop — DB FK may block delete.  
- Client uniqueness of crop names: **not enforced**.

### Confirmed consumer dependency

Farm Diary ops map `farm_diary.farm_name` → `master_crops` by **case-insensitive name equality** to find crop SOP. Renaming a crop can break upcoming-stage forecast if diary farm_name is not updated.

---

## 4. Stage Master Rules

### Confirmed

- Global list: `stage_name` required.  
- On create: `stage_code` = first 3 chars of name uppercased.  
- Edit updates `stage_name` only (code not refreshed on edit).  
- Delete: removes from local builder selection; then DB delete (FK may block if used in `sop_crop_stages`).  
- No client uniqueness.  

Stages are **selected into** an SOP layout; they do not inherently belong to a crop until `sop_crop_stages` rows exist.

---

## 5. Crop → Stage Relationships

### Confirmed

Relationship is **only** through `sop_crop_stages`:

- Unique pairing conceptually: lookup by `crop_id` + `stage_id` (`maybeSingle`).  
- `stage_sequence` orders stages for that crop.  
- Saving “Lock Global Stage Order” upserts sequence for every selected crop × every layout stage.  
- Stages not in the layout list are **not** deleted from DB by “Lock Order” — only listed stages are upserted. Orphan stage rows for that crop may remain (**edge case**).

---

## 6. Product Master Rules (`master_gls_products`)

### Confirmed fields

`product_name` (required), `active_ingredients`, `description`, `benefits`, `impact`, `image_url`.

### Confirmed media

- Images uploaded to **Cloudinary** (`VITE_CLOUDINARY_CLOUD_NAME`, `VITE_CLOUDINARY_UPLOAD_PRESET`).  
- Stored URL = Cloudinary `secure_url` on `image_url`.  
- Accept `image/*`.  

### Confirmed SOP usage

Application row may set `gls_product_id` or `'NONE'` → persisted as `null`.

---

## 7. UOM Master Rules

### Confirmed

- `uom_name` + `uom_symbol` both required.  
- Used by Numeric parameters via mapping table.  
- Display in observations uses `master_uom.uom_symbol`.  

---

## 8. Parameter Master Rules

### Confirmed `ui_input_type` values

| Type | Options / UOM |
|---|---|
| `Numeric` | May map multiple UOMs; if any UOM selected, **default UOM required** |
| `Dropdown Choice` | `options_data` string array; duplicate options blocked in UI |
| `Boolean` | Yes/No (no options/UOM in admin form) |
| `Textarea` | Long text |
| `Upload Image` | Media path; observation UI treats as link |

### Confirmed save behavior

- Label required.  
- On edit: replace parameter fields; **delete all** `parameter_uom_mapping` for that parameter, then re-insert if Numeric + UOMs.  
- Non-Numeric clears options to `[]` except Dropdown which stores options.  
- Separate “Map UOM” dialog for Numeric parameters (same mapping rules).  

### Confirmed — multiple UOMs

Yes. Exactly one default among selected (`is_default_uom`). Empty UOM list allowed for Numeric (no mapping rows).

---

## 9. Parameter → UOM Mapping (`parameter_uom_mapping`)

### Confirmed

| Column | Role |
|---|---|
| `parameter_id` | FK to master parameter |
| `uom_id` | FK to UOM |
| `is_default_uom` | Boolean; one expected among selected |

Replace-all pattern on save (delete then insert).

---

## 10. SOP Group Rules

### Confirmed entity `sop_groups`

| Field | Role |
|---|---|
| `group_name` | Auto-derived often as `{category}: {crop1}, {crop2} +N` |
| `category` | From builder category or first crop’s `crop_category` or `'Mixed'` |
| `crop_ids` | UUID array of crops in the group |

### Confirmed create/update paths

1. **Lock Global Stage Order** or **Save Stage SOP** → find groups whose `crop_ids` **intersect** current selection → keep first as primary (update name/category/`crop_ids` to **exactly** current selection), **delete** other intersecting groups; else insert new group.  
2. **Edit Group** modal → change membership only (`crop_ids`).

### Confirmed add/remove crops in group edit

| Event | Behavior |
|---|---|
| Removed crops | Wipe those crops’ SOP: delete apps → params → `sop_crop_stages` for that `crop_id` |
| Newly added crops | **Clone** SOP from `sourceCropId` = first old crop (or first new if old empty) onto new crops |
| Delete group | Confirm: *crops keep their SOPs*; only group row deleted |

### Confirmed crop assignment exclusivity (builder UI)

In SOP Builder, a crop already in another group is disabled unless currently selected in `layoutCrops` (`allAssignedCropIds`). Edit-group modal can still reassign (clone/wipe rules apply).

### Confirmed “intersection / merge”

Not a stage-set intersection algorithm. It is **group row merge**: any existing groups sharing at least one selected crop are collapsed into one group whose `crop_ids` become the **current builder selection** (crops dropped from selection leave their prior groups when those groups are deleted/overwritten — careful: primary group’s crop_ids replaced wholesale).

**Conflict risk:** Saving a partial selection that intersects a larger group **shrinks** that group’s `crop_ids` to the selection and deletes sibling intersecting groups — crops not in the selection lose their **group** membership (but keep per-crop SOP rows unless removed via group edit wipe).

---

## 11. SOP Crop Stage Rules

### Confirmed `sop_crop_stages`

| Field | Role |
|---|---|
| `crop_id` | Target crop |
| `stage_id` | Global master stage |
| `stage_sequence` | Order (1…n) |
| `chemical_recommendation_and_dosage` | Free-text stage recommendation |

Parent for applications and observation parameters.

---

## 12. Stage Sequence Rules

### Confirmed

1. Builder maintains ordered `layoutStages[]`.  
2. Move up/down buttons reorder.  
3. **Lock Global Stage Order** writes `stage_sequence = index + 1` for each layout stage × each selected crop.  
4. Saving active stage SOP also writes `stage_sequence` from current layout index for that stage.  
5. Consumers sort by `stage_sequence` ascending.  

---

## 13. SOP Application Rules

### Confirmed fields on `sop_applications`

| Field | Required in admin? |
|---|---|
| `das` | **Yes** if any application rows exist (empty string/null rejected) |
| `application_type` | Optional; seeded list + custom types learned from data |
| `application_method` | Optional |
| `gls_product_id` | Optional (`NONE` → null) |
| `dosage_value` | Optional free text (e.g. `1L/Ton`) |
| `benefit`, `impact`, `recommendation` | Optional |
| `chemical_name`, `chemical_dosage` | Optional |

### Confirmed default application types (client seed)

`Spray`, `Drench`, `Broadcasting`, `Basal Dose`, `Seed Treatment`, `Foliar` — extended by any types found when loading existing apps.

### Confirmed save semantics

- Replace-all: delete all apps for parent stage, then insert current rows.  
- `das` cast with `Number(a.das)`.  
- Zero application rows allowed (skip insert); DAS validation only fails when a row lacks DAS.  

### Confirmed ordering

Loaded/sorted by `das` ascending in preview; save does not store separate app sequence beyond DAS order.

---

## 14. DAS / Day-After-Sowing Logic

### Confirmed storage

`sop_applications.das` — numeric days after sowing for that application event.

### Confirmed operational use (`FarmDiaryPage`)

For each `sop_crop_stages` with ≥1 application:

- Stage DAS for forecast = **`min(application.das)`**  
- Stages with **no** applications are **excluded** from upcoming-event map  

**Upcoming stage** (requires `is_sowing_done` + `sowing_date`):

1. Resolve crop via `farm_name` ≈ `master_crops.crop_name`.  
2. If observation sessions exist: next stage = first with `stage_sequence` **greater than** max completed stage’s sequence.  
3. If no sessions: first stage whose `sowing_date + das ≥ today`; if all past, fallback to **first** stage (overdue).  
4. If no next → “All Stages Completed”.  
5. `isOverdue` if target date &lt; today.  

Detail accordions also show `Target: date (DAS: minDas)` per stage.

### Confirmed observation sessions

Store their own `days_after_sowing_das` (logged value) — separate from template DAS.

### Unconfirmed

Whether mobile enforces visiting only at DAS window; admin forecast is display/filter only.

---

## 15. Observation Parameter Rules (SOP)

### Confirmed `sop_parameters`

| Field | Role |
|---|---|
| `sop_crop_stage_id` | Parent stage config |
| `parameter_id` | Master parameter |
| `is_mandatory` | Checkbox “(Req)” in previews |

### Confirmed save

- Replace-all delete/insert.  
- Deduplicate by `parameter_id` (first occurrence wins for mandatory flag if duplicates in UI).  
- Empty parameter_id rows not explicitly filtered — empty ids could fail DB (**edge**).  

### Confirmed consumption

Observation UI shows logged values with parameter label/type; Upload Image as link. Admin masters do not enforce which params mobile must collect beyond `is_mandatory` storage.

**`UNCONFIRMED — likely implemented outside this admin repository`:** mobile mandatory enforcement.

---

## 16. SOP Builder Workflow

### Confirmed steps

1. Open **SOP Builder** tab.  
2. Choose category filter (or All).  
3. Select one or more **unassigned** crops (or already in current selection).  
4. Check stages; reorder; **Lock Global Stage Order**.  
5. Select active stage; edit applications + stage recommendation + observation params.  
6. **Save Stage SOP** → writes identical config to **all** selected crops; upserts/merges SOP group.  

### Confirmed load behavior

- Changing selection/stage loads SOP from **`layoutCrops[0]`** only into the editor.  
- Multi-crop save overwrites all selected crops with that editor state (broadcast).  

### Confirmed “Edit Group SOP”

Loads group category, valid crop ids, **union** of stage_ids across those crops (ordered by sequence from query), then loads apps/params from first crop + first stage.

---

## 17. SOP Cloning Rules

### Confirmed `cloneSopToNewCrops(sourceCropId, targetCropIds)`

For each target:

1. **Delete all** `sop_crop_stages` for target crop (note: code deletes stages by `eq('crop_id')` without first deleting child apps/params in this function — **may rely on DB CASCADE** or fail; group-remove path explicitly deletes children first).  
2. For each source stage: insert new stage row (same `stage_id`, `stage_sequence`, recommendation).  
3. Copy all `sop_applications` (strip id, new parent).  
4. Copy all `sop_parameters` (strip id, new parent).  

### Confirmed what cloning copies

**Stages + applications + parameters + recommendation text + product FKs** — full per-crop SOP tree. Does **not** copy SOP group membership (handled separately).

### Confirmed conflict / risk

Clone’s `delete().eq('crop_id')` on `sop_crop_stages` without deleting children first vs remove-from-group path that deletes children first — **conflicting delete strategies**; outcome depends on remote FK ON DELETE behavior (**Unconfirmed** without DDL).

---

## 18. Create / Edit / Delete Summary

| Entity | Create | Edit | Delete |
|---|---|---|---|
| Crop | Yes | Name/category | Group cleanup + delete; FK may block |
| Stage | Yes (+ auto stage_code) | Name | Layout cleanup + delete; FK may block |
| UOM | Yes | Name/symbol | Delete; FK may block |
| Parameter | Yes | Label/type/options + remap UOMs | Delete; FK may block |
| GLS Product | Yes + image | All fields | Delete; FK may block |
| SOP Group | Via builder save | Crop membership (+ clone/wipe) | Group only; SOPs kept |
| sop_crop_stages / apps / params | Via builder / clone | Replace-all on save | Via crop remove from group / clone wipe |

### Confirmed delete messaging

Foreign key errors → toast “Delete Blocked by Database… actively linked to other records.”

No pre-check against farm diaries / observation sessions in app code.

---

## 19. Required / Optional / Validation

### Confirmed

| Context | Rules |
|---|---|
| Crop | name + category |
| Stage | name |
| UOM | name + symbol |
| Parameter | label; Numeric+UOMs ⇒ default UOM; Dropdown options optional but duplicate options blocked |
| Product | name |
| Stage SOP save | ≥1 valid crop + active stage; every application row has DAS |
| Lock order | ≥1 valid crop + ≥1 stage |
| UOM map dialog | If any UOM selected ⇒ default required |

No uniqueness validation for master names in UI.

---

## 20. Activation / Inactivation

### Confirmed

Crops inserted as `status: 'Active'`. No UI to set Inactive or filter by status in masters list.

---

## 21. Translation Behavior

### Confirmed edge function `auto-translate-parameter`

- Payload: `{ table, record }` (comment: from **SQL trigger**).  
- Collects English strings by table:

| Table | Strings |
|---|---|
| `master_parameters` | `parameter_label` + each `options_data` string |
| `master_crops` | `crop_name`, `crop_category` |
| `master_crop_stages` | `stage_name` |
| `master_gls_products` | `product_name` |
| `master_uom` | `uom_name` |

- Skips keys already in `dynamic_translations.english_key`.  
- Gemini translates to Hindi (`hindi_val`) + Gujarati (`gujarati_val`).  
- Upserts on `english_key`.  

### Confirmed

Admin React app **does not** call this function. Enforcement is **not** in the SPA.

### Unconfirmed

Exact SQL triggers/timing; whether updates re-translate changed strings; whether mobile reads `dynamic_translations`.

**`UNCONFIRMED — likely implemented outside this admin repository`:** trigger wiring and mobile consumption.

---

## 22. Permissions & Visibility

### Confirmed

| Key | Effect on Masters page |
|---|---|
| `farm_diary_masters.can_view` | Access page |
| `farm_diary_masters.can_edit` | Add/edit/delete masters; builder mutations; group edit/delete |

### Confirmed conflict

Sidebar has separate **Farm Diary** item (`farm_diary_approvals`), but `FarmDiaryPage.tsx` gates with **`getModulePerm('farm_diary_masters')`**. Roles label `farm_diary_masters` as “Farm Diary & SOPs” and `farm_diary_approvals` as “Farm Diary”.

---

## 23. Search / Filter Behavior

### Confirmed on Masters

- Category filter in SOP Builder.  
- Crop checkboxes; stages checklist.  
- No free-text search across masters tables.  

### Confirmed on Farm Diary ops (consumer)

Filters by SE, crop name, stage (upcoming), forecast date range — all depend on masters + SOP DAS map.

---

## 24. Edge Cases

### Confirmed

1. Multi-crop editor loads only first crop’s SOP but saves to all.  
2. Lock Order does not prune stages removed from layout.  
3. Clone delete strategy may differ from group-remove cascade.  
4. Group merge overwrites `crop_ids` to selection (can drop crops from group without wiping SOP).  
5. Stages without applications ignored by upcoming forecast.  
6. Farm diary crop match by **name string**, fragile to rename.  
7. Empty `parameter_id` on SOP param rows possible if user adds blank row.  
8. Custom application types accumulate in client state only for session (+ loaded from DB).  
9. Stage_code stale after rename.  
10. Permission key mismatch Farm Diary page vs sidebar.  

---

## 25. Cross-Module Effects

| Module | Dependency |
|---|---|
| Farm Diary operations | Crops/stages lists; `sop_crop_stages` + min DAS for upcoming events; observation timeline |
| Farmer Farm Diary detail | `sop_crop_stages` timeline by `selected_crop_id` / farm_name mapping |
| Observations | `master_parameters`, `master_uom` for labels/symbols |
| Translations | Edge fn → `dynamic_translations` for mobile (assumed) |
| Roles | `farm_diary_masters` / `farm_diary_approvals` |

---

## 26. Calculations / Derived Values

| Derived | Rule |
|---|---|
| Stage sequence | Layout index + 1 |
| Group name | `{category}: {first two crop names} +N` |
| Forecast stage DAS | `min(apps.das)` |
| Target date | `sowing_date + DAS` (calendar days) |
| Upcoming stage | Sequence-after-completed OR first future/overdue by date |
| Overdue | Target date &lt; today (local midnight) |
| stage_code | First 3 letters of stage name on create |

---

## 27. What Must Exist Before a Farm Diary Can Be “Configured”

### Confirmed for admin SOP setup

1. At least one **crop** and one **stage** (to lock order / save).  
2. Optional but needed for rich SOPs: products, parameters, UOMs.  
3. Per-crop `sop_crop_stages` (+ apps with DAS) for forecasting to work.  

### Confirmed for operational upcoming events

- Diary with sowing done + sowing date  
- `farm_name` matching a master crop that has SOP stages **with applications**  

Creating the `farm_diary` row itself: **`UNCONFIRMED — likely implemented outside this admin repository`**.

---

## 28. Rules a New Stack Must Preserve

1. Keep global stage master separate from per-crop `sop_crop_stages` sequencing.  
2. Store DAS on applications; use min DAS per stage for schedule forecasts.  
3. Support multiple applications and observation parameters per crop-stage.  
4. Allow multiple UOMs per Numeric parameter with one default.  
5. Support parameter input types: Numeric, Dropdown Choice, Boolean, Textarea, Upload Image.  
6. SOP group membership with clone-on-add and wipe-on-remove crop behaviors (document FK cascade assumptions).  
7. Builder multi-crop broadcast save of identical stage SOP.  
8. Group merge-on-intersect when saving builder selection.  
9. Product images via durable URL (Cloudinary or equivalent).  
10. Translation pipeline for master English keys → hi/gu (if mobile still depends on it).  
11. Preserve farm_name → crop_name matching used by diary ops **or** explicitly redesign with stable crop_id on diaries.  

---

## 29. Important Unresolved / Conflicting Rules

1. Farm Diary page permission key vs sidebar `farm_diary_approvals`.  
2. Clone stage delete without child cleanup vs explicit child deletes elsewhere.  
3. Lock Order does not remove deselected stages from DB.  
4. Group merge shrinks membership without wiping removed crops’ SOPs.  
5. No inactivation workflow despite `status: Active` on crops.  
6. Trigger-based translation not visible in SPA.  
7. Remote FK/CASCADE DDL unknown.  
8. Mobile mandatory parameter / DAS window enforcement unknown.  

---

## 30. Cross-Module Dependencies

**Depends on:** Auth/permissions; Cloudinary env; Supabase tables; Gemini key (edge).  

**Depended on by:** Farm Diary ops forecasting & filters; Farmer diary observation timelines; presumed mobile Farm Diary.

---

## 31. Evidence / Source Index

| Concern | Source |
|---|---|
| All masters + SOP builder/clone/group | `src/pages/FarmDiaryMasters.tsx` |
| Upcoming stage / DAS forecast | `src/pages/FarmDiaryPage.tsx` |
| Observation + SOP accordion | `FarmerDetailSheet.tsx`, `FarmDiaryPage.tsx` |
| Translations | `supabase/functions/auto-translate-parameter/index.ts` |
| Nav / permissions | `AppSidebar.tsx`, `RolesPage.tsx` |
| Inventory | `docs/module-inventory.md` |

---

## 32. Rules That Appear to Live Outside This Repository

1. SQL triggers invoking `auto-translate-parameter`  
2. Exact FK ON DELETE CASCADE behavior for SOP trees  
3. Mobile Farm Diary creation and stage visit logging  
4. Enforcement of `is_mandatory` and parameter UOM choice on device  
5. Whether `dynamic_translations` is required at runtime on mobile  
6. Any server-side validation beyond what the admin UI checks  
7. Complete DDL for `master_*` / `sop_*` / `dynamic_translations`  

Mark: **`UNCONFIRMED — likely implemented outside this admin repository`**.

---

*End of Farm Diary Masters business rules extraction.*
