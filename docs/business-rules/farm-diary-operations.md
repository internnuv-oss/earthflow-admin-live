# Business Rules — Farm Diary (Operations)

**Source system:** Field Commander Admin (`earthflow-admin-live`)  
**Module:** Farm Diary (Operations) — UI label **“Farm Diaries Directory”** / nav **“Farm Diary”**  
**Route:** `/farm-diary-approvals` (component `FarmDiaryPage.tsx`, imported as `FarmDiaryApprovals`)  
**Also surfaced in:** Farmer detail → Farm Card → Farm Diaries; Territory Routes analytics/maps  
**Primary sources:** `src/pages/FarmDiaryPage.tsx`, `src/components/FarmerDetailSheet.tsx`, `src/pages/RoutesPage.tsx`, `src/components/TerritoryViewSheet.tsx`, masters in `FarmDiaryMasters.tsx`

This document describes **operational** Farm Diary behavior as implemented in the reference project. It is not a redesign. Configuration rules live in `docs/business-rules/farm-diary-masters.md`.

Legend:

- **Confirmed** — directly supported by implementation  
- **Implementation Detail** — how the old app encodes the rule  
- **Unconfirmed** — not proven here  
- **`UNCONFIRMED — likely implemented outside this admin repository`** — mobile / remote DB  

---

## 1. Module Purpose

### Confirmed

Admin **monitor and inspect** field Farm Diaries:

1. Directory of all `farm_diary` rows with farmer/SE context  
2. Filter/sort by upcoming SOP stage event (forecast)  
3. Export filtered CSV  
4. Open a detail sheet: plot/soil/water/history + **Crop Observation Timeline** (SOP stages vs logged visits)  

Admin does **not** create, edit, delete, or submit diaries/visits in this repository (no `insert`/`update`/`delete` on `farm_diary` or observation tables).

---

## 2. Operational Relationship (Confirmed)

```
Farm Diary Masters
  master_crops / master_crop_stages
  sop_crop_stages → sop_applications (DAS) + sop_parameters
        ↓ (read at forecast / timeline time)
Farm Card (optional path in Farmer UI)
  → farm_diary (farm_card_id and/or farmer_id)
        → crop_observation_sessions (selected_stage_id, selected_crop_id, …)
              → plant_sample_sets
                    → sample_parameter_values → master_parameters / master_uom
        → mandatory_base_visits (product usage; Territory analytics, not Diary directory)
```

---

## 3. Farm Diary Entity — Important Fields

### Confirmed fields used by admin

| Field | Usage |
|---|---|
| `id` | PK |
| `farmer_id` | Join to farmer; Territory diary ownership |
| `farm_card_id` | FarmerDetailSheet lists diaries **by card** |
| `farm_name` | Display name; **also treated as crop name** for SOP lookup |
| `is_sowing_done` | Boolean; Pre-Sowing vs Sowing Done / Planning vs Sown |
| `sowing_date` | Required (with sowing done) for upcoming forecast |
| `plot_area`, `plot_area_unit` | Area display (default unit Acres) |
| `land_status`, `soil_type`, `soil_ph`, `soil_ec_ms_cm`, `organic_matter_percentage`, `drainage_condition`, `soil_test_status` | Plot & soil profile |
| `nitrogen_kg_ha`, `phosphorus_kg_ha`, `potassium_kg_ha` | Nutrients |
| `water_source`, `irrigation_method`, `water_tds`, `water_ph` | Water metrics |
| `decision_making_factor` | Historical context |
| `multi_season_yield_history` | Array; count displayed |
| `historical_input_preferences` | Object; “Customized” if non-empty |
| `diary_polygon` | Map polygons (Routes/Territory); length > 2 |
| `created_at` | Directory sort/display |

### Confirmed related entities

| Entity | Role |
|---|---|
| `crop_observation_sessions` | Field visits; `farm_diary_id`, `selected_crop_id`, `selected_stage_id`, health/yield/action/notes/DAS |
| `plant_sample_sets` | Samples under a session; `sample_set_index`, `sample_photo_file_path` |
| `sample_parameter_values` | `logged_value_raw` + parameter + UOM |
| `mandatory_base_visits` | Fertilizers/pesticides JSON; product analytics on Routes — **not** shown on Farm Diary directory |

---

## 4. Cardinality & Ownership

### Confirmed

| Question | Answer from repo |
|---|---|
| Farm Card required before diary? | **Not enforced in admin.** Diaries loadable by `farmer_id` alone (directory/Territory). Farmer UI also loads by `farm_card_id`. |
| Multiple diaries per card? | **Yes** — list all diaries for a card. |
| Multiple diaries per farmer? | **Yes** — Territory/Routes count by `farmer_id`. |
| Crop identity | **`farm_name` string** matched to `master_crops.crop_name` (case-insensitive). Sessions also store `selected_crop_id`. |
| SE ownership | Via **`farmers.se_id`** → `profiles.name` (not a direct `se_id` on diary in queries used here). |

### Unconfirmed

Whether mobile always sets both `farmer_id` and `farm_card_id`; whether diary can exist without a card.

**`UNCONFIRMED — likely implemented outside this admin repository`:** creation ownership and required FKs.

---

## 5. Crop Association

### Confirmed

1. Directory/timeline crop resolution: `getCropIdFromName(farm_name)` → first master crop with equal name (ignore case).  
2. If no match → no upcoming stage (“Awaiting Sowing Date” only if sowing missing; if sown but no crop match → upcoming null → same italic empty state).  
3. FarmerDetailSheet timeline alternatively loads SOP by **`sessions[0].selected_crop_id`** if sessions exist — **conflict** with FarmDiaryPage which uses `farm_name` even when sessions exist.

### Confirmed conflict

| Surface | SOP crop source |
|---|---|
| `FarmDiaryPage` detail | `farm_name` → master_crops |
| `FarmerDetailSheet` detail | First observation’s `selected_crop_id` (else empty stages if no sessions) |

If `farm_name` ≠ selected crop’s name, timelines/forecasts can disagree.

---

## 6. Sowing Rules

### Confirmed

| Condition | Behavior |
|---|---|
| `is_sowing_done` false / missing | Badge “Pre-Sowing” / “Planning”; **upcoming stage = null** → “Awaiting Sowing Date” |
| `is_sowing_done` true but no `sowing_date` | Upcoming = null |
| Both set | Forecast enabled |

Admin cannot toggle sowing fields.

---

## 7. Current Stage / Stage Progression

### Confirmed — no stored “current_stage” column

**Derived:**

- **Completed stage:** any `crop_observation_sessions` with that `selected_stage_id`  
- **Visits count (directory):** `size` of **unique** `selected_stage_id`s (repeat visits to same stage do not increase count)  
- **Upcoming stage:** algorithm in §8  
- Timeline badge: Completed if ≥1 session for stage; else Pending/Overdue by target date  

### Confirmed progression after visits exist

Next stage = first SOP stage with `stage_sequence` **strictly greater than** the maximum `stage_sequence` among stages that have at least one session.

Implications:

- Completing stage 3 without stage 2 still advances max to 3 → next is after 3 (**skips not re-required**).  
- Repeating stage 2 after stage 3 does not change max if 3 already completed.  
- Stages without applications are absent from forecast map but may still appear in timeline if present in `sop_crop_stages`.  

### Confirmed “All Stages Completed”

When visits exist and no stage has higher sequence → `{ stage_id: 'COMPLETED', name: 'All Stages Completed', date: null, isOverdue: false }`.

---

## 8. Upcoming Stage / Visit Forecasting (Verified Algorithm)

### Confirmed prerequisites for non-null upcoming

1. `is_sowing_done` truthy  
2. `sowing_date` present  
3. `farm_name` maps to a `master_crops.id`  
4. That crop has ≥1 `sop_crop_stages` entry that has ≥1 `sop_applications` (stages without apps excluded from map)

### Confirmed stage DAS used in forecast

For each included stage: **`das = min(Number(application.das))`** across that stage’s applications.

Stages sorted by `stage_sequence`.

### Confirmed hybrid logic (`getUpcomingStage`)

**Scenario A — ≥1 observation session on diary:**

- Compute max completed sequence among stages present in map  
- Upcoming = first stage with sequence &gt; that max  
- Target date always computed as `sowing_date + upcoming.das` (even though selection was sequence-based)  
- Overdue if target date &lt; today (local midnight)

**Scenario B — no sessions:**

- Upcoming = first stage where `sowing_date + das ≥ today`  
- If all such dates are in the past → fallback to **first** stage (typically overdue)  
- Same overdue rule  

### Confirmed detail accordion per-stage target

Independent of “upcoming”: for each SOP stage, `predictedDate = sowing_date + minDas`; overdue if past and stage not completed. Stages with zero apps use `minDas = 0` in detail view (**differs** from forecast map which excludes them).

### Confirmed filters tied to upcoming

| Filter | Rule |
|---|---|
| Upcoming Stage | `upcoming.stage_id === selectedStage` (master stage id). COMPLETED never matches a master stage option. |
| Upcoming Event Date range | Requires **both** start and end; keeps diaries whose upcoming `.date` falls in range (inclusive day bounds). Diaries with null upcoming fail the range filter. |

---

## 9. Overdue Detection

### Confirmed

`isOverdue = (sowing_date + stageDAS) < today` at local midnight, for the **upcoming** stage (directory) or each incomplete stage (timeline).

No separate overdue table/status field.

---

## 10. DAS Calculations

### Confirmed two DAS concepts

| Concept | Source |
|---|---|
| Template DAS | `sop_applications.das` → min per stage for scheduling |
| Logged DAS | `crop_observation_sessions.days_after_sowing_das` — displayed on visit; **not** used by upcoming algorithm |

Admin does not recompute logged DAS from visit date.

---

## 11. SOP Association at Runtime

### Confirmed

- Live read of `sop_crop_stages` (+ applications) when page loads / sheet opens.  
- **No snapshot** of SOP on the diary row.  
- If masters/SOP change after diaries exist, forecasts and timelines reflect **current** config (historical visits remain).  

### Confirmed products/applications

- Stage applications/products are **configured** in Masters.  
- Operations UI does **not** list product rows on the visit; Territory product analytics uses `mandatory_base_visits` instead.  
- FarmerDetailSheet loads `chemical_recommendation_and_dosage` on SOP stages (timeline structure); FarmDiaryPage uses apps mainly for DAS.  

---

## 12. Observation Sessions

### Confirmed fields displayed

| Field | Display |
|---|---|
| `created_at` | Logged date |
| `overall_plant_health_score` | /5; color ≥4 green, ≥3 amber, else red |
| `action_required_tier` | Red / Amber / else green styling |
| `expected_yield_potential` | Text |
| `executive_notes` | Optional block |
| `days_after_sowing_das` | DAS on visit |
| `selected_stage_id` | Maps visit into SOP accordion |
| `selected_crop_id` | Used in FarmerDetailSheet for SOP load |

### Confirmed

- Multiple sessions per same stage allowed → “Visit Record #n” (newest first by query order).  
- Session creates “Completed” for that stage for progression/unique visit count.  
- Admin cannot create/edit sessions.  

**`UNCONFIRMED — likely implemented outside this admin repository`:** session creation rules, mandatory params, which stage may be selected.

---

## 13. Plant Sample Sets & Parameter Values

### Confirmed

- Nested under session: one or more samples (`sample_set_index` → “Plant #n”).  
- Optional photo `sample_photo_file_path`.  
- Each sample has `sample_parameter_values`: `logged_value_raw`, join `master_parameters` (label, `ui_input_type`), `master_uom` (`uom_symbol`).  
- Upload Image type → raw value treated as URL link; else show `value + symbol`.  

### Confirmed

Admin read-only. No enforcement of `sop_parameters.is_mandatory` in this UI.

---

## 14. Edit / Delete / Status Transitions

### Confirmed admin

- No diary edit/delete/deactivate.  
- No observation CRUD.  
- Status is **derived** (Pre-Sowing / Sowing Done; Pending / Overdue / Completed stages).  

---

## 15. Permissions — Confirmed Conflict

| Location | Key used |
|---|---|
| Sidebar nav “Farm Diary” | `farm_diary_approvals` (visibility of link) |
| Roles WEB_MODULES | both `farm_diary_masters` (“Farm Diary & SOPs”) and `farm_diary_approvals` (“Farm Diary”) |
| **`FarmDiaryPage` access check** | **`getModulePerm('farm_diary_masters')`** only |

### Confirmed conflict behavior

A role can:

- See the Farm Diary nav item (`farm_diary_approvals.can_view`) but get **Access Denied** on the page if `farm_diary_masters.can_view` is false; **or**  
- Reach the page via direct URL with masters view but without the nav key.

`can_edit` is unused on the operations page (view-only). Farmer diary viewing uses `farmers` permission via parent sheet.

---

## 16. Search / Filter / Sort / Export

### Confirmed directory filters

| Control | Business meaning |
|---|---|
| Search | `farm_name`, farmer `full_name`, farmer `village` |
| Executive | Farmer’s `se_id` (demo SEs excluded from dropdown via `is_demo` false/null) |
| Crop | Resolved crop id from `farm_name` |
| Upcoming Stage | Forecast stage id |
| Upcoming Event Date | Forecast target date in range (both ends required) |

### Confirmed sort keys

`created_at`, `farm_name`, `farmer_name`, `executive`, `visits` (unique stages), `upcoming_date`.

### Confirmed pagination

15 rows/page.

### Confirmed CSV export

Filtered+sorted set; columns: Created Date, Farm/Diary Name (Crop), Farmer, Village, SE, Area, Sowing Date, Visits, Upcoming Stage, Upcoming Stage Date, Is Overdue. UTF-8 BOM.

---

## 17. Map / Polygon Behavior

### Confirmed (cross-module)

- `diary_polygon` plotted on Global Territory Map and Territory View when array length &gt; 2.  
- Not shown on Farm Diaries Directory itself.  

---

## 18. Answers to Explicit Determination Questions

| Question | Confirmed answer |
|---|---|
| When is a Farm Diary created? | **Not in this admin app** |
| Who creates/owns it? | Data shows `farmer_id` (+ optional `farm_card_id`); SE via farmer — create path external |
| Must Farm Card exist first? | Not enforced in admin; both link styles used |
| Multiple diaries per card? | Yes |
| Crop/plot identity? | `farm_name` as crop name; plot fields on diary; card is separate plot entity |
| Sowing effect? | Gates all upcoming forecasting |
| Current stage? | Derived from sessions + SOP sequence |
| Upcoming calculation? | §8 hybrid sequence vs calendar |
| DAS source? | Template min app DAS; logged DAS separate |
| Overdue? | Target date &lt; today |
| SOP mapping? | Live `sop_crop_stages` by crop id |
| Products on visits? | Not on Diary page; `mandatory_base_visits` elsewhere |
| Observation params selection? | Stored values only; selection external |
| Samples ↔ visits? | Samples ⊂ sessions ⊂ diary |
| Multiple sessions same stage? | Yes |
| Skip/delay/repeat? | Sequence uses max completed; skips not blocked by admin |
| SOP change after diary? | Forecast uses current SOP |
| Farmer/card/crop change? | Name match / FKs; no admin sync logic |
| Derived vs stored? | Upcoming/overdue/visits-count/completed derived; plot & session fields stored |
| Admin vs mobile? | Admin = monitor; execute = external |

---

## 19. Edge Cases

### Confirmed

1. Permission key mismatch nav vs page.  
2. `farm_name` rename vs master crop rename breaks forecast.  
3. FarmerDetailSheet vs FarmDiaryPage different crop id resolution.  
4. Forecast excludes stages with no applications; detail timeline may still list them with DAS 0.  
5. Visits badge undercounts repeat visits to same stage.  
6. Stage filter cannot select “All Stages Completed”.  
7. Forecast date filter requires both ends.  
8. Demo SEs hidden from filter but diaries for demo farmers may still appear if present.  
9. Changing SOP after visits can make “upcoming” jump oddly vs historical DAS.  
10. `mandatory_base_visits` invisible on Diary module UI.  

---

## 20. Calculations / Derived Values Summary

| Derived | Formula / rule |
|---|---|
| Crop id | Match `farm_name` to `master_crops.crop_name` |
| Stage template DAS | `min(sop_applications.das)` |
| Target date | `sowing_date + DAS` (calendar days) |
| Upcoming | §8 |
| Overdue | target &lt; today |
| Visits count | unique `selected_stage_id` |
| Stage completed | ≥1 session for stage |
| Health badge colors | score thresholds 4 / 3 |
| Yield history summary | array length |
| Input prefs summary | object key count &gt; 0 |

---

## 21. Cross-Module Effects

| Module | Interaction |
|---|---|
| Farm Diary Masters | SOP stages, apps/DAS, parameters/UOM labels |
| Farmers / Farm Cards | Navigation path; `farm_card_id` lists |
| Territory Routes | Diary counts, polygons, product visits via `mandatory_base_visits` |
| Roles | Dual keys; page uses masters key |
| Attendance | Does not load farm_diary events (cards/FSPP only) |

---

## 22. Rules a New Stack Must Preserve

1. Read-only admin directory with upcoming-stage forecasting gated on sowing done + sowing date + crop-name→master match.  
2. Hybrid upcoming algorithm: sequence-after-max-completed if any visits; else first future DAS date (else first stage).  
3. Stage DAS = minimum application DAS; stages without apps omitted from forecast map.  
4. Overdue = target date before today.  
5. Observation model: session → plant samples → parameter values with UOM/type display.  
6. Allow multiple sessions per stage; unique-stage visit counts for directory.  
7. Live SOP binding (no diary-side SOP snapshot) unless redesigning.  
8. Support dual association farmer_id and farm_card_id.  
9. Export of filtered forecast-relevant columns.  
10. Document and reconcile `farm_diary_masters` vs `farm_diary_approvals` permission behavior.  

---

## 23. Important Unresolved / Conflicting Rules

1. **Permission:** sidebar `farm_diary_approvals` vs page check `farm_diary_masters`.  
2. **Crop resolution:** `farm_name` vs `selected_crop_id` across UIs.  
3. **Stages without apps:** excluded from forecast, included in timeline with DAS 0.  
4. Farm Card required or not for diary creation (external).  
5. Whether `mandatory_base_visits` are part of “visits” or separate product logging.  
6. Mobile rules for skipping stages, mandatory params, sowing toggles.  
7. Effect of deleting/renaming master crops on existing diaries.  

---

## 24. Cross-Module Dependencies

**Depends on:** Farmers, Farm Diary Masters (`master_*`, `sop_*`), Profiles/SE, Permissions.  

**Depended on by:** Territory analytics/maps; Farmer detail diary drill-down.

---

## 25. Evidence / Source Index

| Concern | Source |
|---|---|
| Directory, forecast, filters, export, detail timeline | `src/pages/FarmDiaryPage.tsx` |
| Card→diary→observations | `src/components/FarmerDetailSheet.tsx` |
| Polygons, diary counts, base visits | `RoutesPage.tsx`, `TerritoryViewSheet.tsx` |
| Route alias + permission keys | `Index.tsx`, `AppSidebar.tsx`, `RolesPage.tsx` |
| SOP/DAS config | `FarmDiaryMasters.tsx`, `docs/business-rules/farm-diary-masters.md` |

---

## 26. Rules That Appear to Live Outside This Repository

1. Creating/updating `farm_diary` (sowing, soil, polygon, farm_card link)  
2. Creating `crop_observation_sessions` / samples / parameter values  
3. Creating `mandatory_base_visits` and product application payloads  
4. Enforcing SOP parameter mandatory flags and UOM choices  
5. Choosing `selected_stage_id` / preventing skips  
6. Computing or validating logged `days_after_sowing_das`  
7. Remote RLS and DDL for diary tables  

Mark each: **`UNCONFIRMED — likely implemented outside this admin repository`**.

---

*End of Farm Diary Operations business rules extraction.*
