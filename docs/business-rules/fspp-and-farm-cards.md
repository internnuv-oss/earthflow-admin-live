# Business Rules — FSPP & Farm Cards

**Source system:** Field Commander Admin (`earthflow-admin-live`)  
**Module:** FSPP evaluation + Farm Cards + FSPP Farm Card Approvals  
**Related routes / keys:** `/fspp-approvals` (`fspp_approvals`); farmer detail surfaces under `/farmers`; consumers in Routes, Attendance, Farm Diary  
**Primary sources:** `src/pages/FsppApprovals.tsx`, `src/components/FarmerDetailSheet.tsx`, `src/components/FarmerTable.tsx`, `src/pages/FarmersPage.tsx`, `src/components/AttendanceTimelineSheet.tsx`, Territory/Routes analytics, Settings farmer template (non-persisting)

This document describes **business behavior** for FSPP and Farm Cards as implemented in the reference project. It is not a redesign.

Legend:

- **Confirmed** — directly supported by implementation  
- **Implementation Detail** — how the old app encodes the rule  
- **Unconfirmed** — referenced or suspected but not provable here  
- **`UNCONFIRMED — likely implemented outside this admin repository`** — mobile / remote DB / edge logic  

---

## 1. Module Purpose

### Confirmed

Two related concerns:

1. **FSPP (farmer evaluation)** — JSON stored on the farmer (`farmers.fspp_details`). Admin **displays** it; does not create, score, or edit it.  
2. **Farm Cards (plots)** — rows in `farm_cards` linked to a farmer (and SE). Admin **views** cards (and nested diaries/observations) and runs **FSPP Farm Card Approvals** to set `fspp_approval_status`.

UI title on approvals: **“FSPP Farm Card Approvals”**  
Subtitle: *“Review and approve Farm Cards based on the farmer's FSPP Category.”*

Admin does **not** create Farm Cards or Farm Diaries in this repository.

---

## 2. Actual Lifecycle (Confirmed from Code — Not Assumed)

### Confirmed observable chain

```
Farmer (profiles/onboarding)
  └─ optional fspp_details on farmer  →  "FSPP" stage in directory
  └─ zero or more farm_cards (farmer_id)
        ├─ farm_cards.status (e.g. DRAFT vs completed)
        ├─ farm_cards.fspp_approval_status (PENDING | APPROVED | REJECTED)
        └─ zero or more farm_diary (via farm_card_id and/or farmer_id)
              └─ crop_observation_sessions …
```

### Confirmed — what the admin lifecycle is **not**

| Assumed rule | Evidence in this repo |
|---|---|
| FSPP must be approved before a Farm Card can exist | **False in admin.** Cards are listed/approved independently; no check that FSPP exists before card fetch. |
| Approving FSPP (farmer) unlocks cards | **False.** Approval mutates **`farm_cards.fspp_approval_status`**, not farmer FSPP. |
| Category A is auto-approved in admin | **Conflict:** UI copy claims auto-approve; **code does not** auto-set APPROVED (see §12). |
| Admin computes score/category | **False.** No scoring formula in repo. |

### Confirmed stage labels on Farmers directory (derived)

1. **Onboarding** — no FSPP object, no farm card  
2. **FSPP** — nonempty `fspp_details`  
3. **Farm Card** — ≥1 `farm_cards` row for farmer  

Priority: Farm Card > FSPP > Onboarding. This is independent of `fspp_approval_status`.

---

## 3. FSPP Entity / Data Structure

### Confirmed

FSPP is **not** a separate table. It is JSON on the farmer:

- Submitted: `farmers.fspp_details`  
- Drafts: may appear inside `drafts.draft_data.fspp_details` when present  

### Confirmed fields displayed / consumed

| Field | Admin usage |
|---|---|
| `score` | Detail view; Approvals “Score: n/100”; territory avg; Attendance event |
| `category` | `Category A`–`D` or missing → “Uncategorized”; filters; badge colors; analytics counts |
| `statusLabel` | Badge (default display “Qualified” if missing); analytics bio-stage fallback |
| `committedLand` | Display; Approvals min-land filter; Attendance text |
| `committedLandUnit` | Default `Acres` if missing; filter must match unit exactly |
| `totalLand` | FSPP detail panel (shown as Acres; may differ from `farm_details.totalLand`) |
| `mindsetA` | “Mindset A (Innovator)” |
| `mindsetB` | “Mindset B (Investment)” |
| `mindsetC` | “Mindset C (Sustainability)” |
| `mindsetD` | “Mindset D (Compliance)” |
| `bioAwareness` | Biofertilizer Awareness |
| `glsKnowledge` | GLS Knowledge |
| `seasonalExpense` | Seasonal Expense |
| `isKnockout` | If truthy → “Yes (Disqualified)” else “No” |
| `evaluationDate` | Display; Attendance “Added FSPP Details” when date matches shift day |

### Confirmed — FSPP “exists”

`Object.keys(fspp_details).length > 0` → farmer has FSPP for stage/UI hub card.

### Confirmed — admin cannot edit FSPP

Farmer profile save updates personal/farm/history only; submitted update does not touch `fspp_details`. Draft admin save rebuilds `draft_data` **without** re-including `fspp_details` (risk of wiping draft FSPP).

---

## 4. Farm Card Entity / Data Structure

### Confirmed fields used by admin

| Field | Role |
|---|---|
| `id` | Primary key |
| `farmer_id` | Owning farmer |
| `se_id` | Owning SE (`profiles`); Approvals join `profiles:se_id(name)` |
| `status` | Plot completion state; defaulted to `DRAFT` in UI if null; analytics: DRAFT vs ≠ DRAFT = Completed |
| `fspp_approval_status` | `PENDING` (null coalesced), `APPROVED`, `REJECTED` |
| `created_at` | Approvals date filter & sort; Attendance “Farm Card Generated” |
| `card_data` | JSON plot payload |
| `boundary_polygon` | Map polygons (Routes/Territory); require array length > 2 |
| `media_urls` | Object of labeled image/video URLs |

### Confirmed `card_data` keys shown in FarmerDetailSheet

**Plot geography:** `state`, `district`, `taluka`, `village`, `surveyNo`, `landStatus`, `cultivatedArea`, `cultivatedAreaUnit`, `fieldNumber` (plot label), also `totalLandArea` used as area fallback in Attendance  

**Soil & water:** `soilType`, `soilPh`, `soilEc`, `organicMatter`, `waterSource`, `waterPh`, `waterTds`, `irrigationMethod`, `dripArea`, `dripAreaUnit`, `pumpHp`  

**Livestock & assets:** `milchCows`, `buffaloes`, `draftAnimals`, `goatsSheepPoultry`, `fymGenerated`, `labourType`  

**Yield history:** `yieldHistory[]` with `year`, `season`, `cropGrown`, `area`, `areaUnit`, `yieldQtl`, `priceQtl`  

**Other:** `farmerName` (Attendance fallback name)

### Confirmed — no local DDL for `farm_cards`

Table not in checked-in migration; schema inferred from app usage (**remote Supabase**).

---

## 5. Relationship: Farmer ↔ FSPP

### Confirmed

- 0..1 FSPP payload per farmer record (JSON object; empty = none).  
- FSPP is farmer-level, **not** plot-level.  
- Multiple farm cards for one farmer **share** the same farmer `fspp_details` when Approvals displays category/score/land.  

### Unconfirmed

Whether mobile allows re-evaluation / overwrite of `fspp_details`.

---

## 6. Relationship: Farmer ↔ Farm Cards

### Confirmed

- Farmer can have **multiple** Farm Cards (`select * where farmer_id`; UI “N Registered Plots”).  
- Each card is a **plot** (labeled by `card_data.fieldNumber`).  
- Cards also store `se_id` (may mirror farmer’s SE; not validated in admin).  
- Directory `has_farm_card` = any card for that farmer id exists (ignores approval status and card `status`).  

### Confirmed — cards without FSPP

Approvals can show cards whose farmer has no category (“Uncategorized”). No admin gate requiring FSPP before card existence.

---

## 7. Relationship: Farm Cards ↔ Farm Diaries

### Confirmed

| Loader | Link used |
|---|---|
| FarmerDetailSheet | `farm_diary.farm_card_id = card.id` |
| Territory / Routes product & map metrics | `farm_diary.farmer_id` in farmer id set |

So diaries are associated with a **plot (farm card)** in the farmer detail UX and also with the **farmer** in analytics.

### Confirmed

Admin does not create diaries. No check in Farmers/Approvals that `fspp_approval_status === 'APPROVED'` before listing diaries.

**`UNCONFIRMED — likely implemented outside this admin repository`:** whether mobile requires approved card before diary creation.

---

## 8. FSPP Fields, Sections, Validation, Scoring

### Confirmed admin presentation sections

1. Score circle + category + `statusLabel`  
2. Committed Land + Total Land  
3. Evaluation Metrics (mindsets A–D, awareness, GLS knowledge, seasonal expense, knockout, evaluation date)  

### Confirmed — validation / scoring in admin

**None.** No required-field checks on FSPP; no formula; score shown as `/100` in Approvals without verifying max.

### Confirmed — Settings template mismatch

`/settings/farmer` seeds a single scoring category “Land Holding Size” (tiers by acres) and commitments (KYC, land ownership, bio inputs, field visits). Persist is **TODO** — not wired to `fspp_details`. Does **not** define mindsets/knockout/category A–D.

### Unconfirmed

**`UNCONFIRMED — likely implemented outside this admin repository`:**

- Questionnaire questions and scoring weights  
- How `category` and `score` are derived  
- When `isKnockout` is set and whether it blocks cards  
- Mapping from Settings land tiers to live FSPP  

---

## 9. Land / Area / Committed Land Rules

### Confirmed (admin)

| Rule | Behavior |
|---|---|
| Committed land filter | Card passes if `committedLandUnit` **equals** selected unit (`Acres` or `Bigha`) **and** `parseFloat(committedLand) >= min` |
| Missing committed land | Filter with min set → fails (treated as 0); display shows `--` |
| Default unit | `Acres` if `committedLandUnit` absent |
| No conversion | Acres vs Bigha are **not** converted in Approvals filter |
| Plot cultivated area | From `card_data`; independent of FSPP committed land |
| Territory analytics | Sums farmer `fspp_details.committedLand` across FSPP farmers; uses `farm_details.totalLand` for land holdings |

### Unconfirmed

Business rule that committed land must be ≤ total land; unit consistency with farm_details.

---

## 10. Approval Status Values

### Confirmed

On **`farm_cards.fspp_approval_status`**:

| Value | Meaning in UI |
|---|---|
| `PENDING` | Default when null/undefined; “Awaiting Admin Approval” |
| `APPROVED` | Approved tab |
| `REJECTED` | Rejected tab |

### Confirmed — separate from card `status`

`farm_cards.status` (`DRAFT` vs other) is a **different** axis (plot draft vs completed). Approvals fetch includes `status` but tabs filter only on `fspp_approval_status`. Analytics “Farm Card Built” uses `status`, not approval.

---

## 11. Approval Lifecycle

### Confirmed transitions (admin UI)

```
null / missing  → treated as PENDING
PENDING  --Approve--> APPROVED
PENDING  --Reject-->  REJECTED
```

- Approve/Reject buttons appear **only** on PENDING tab and only if `fspp_approvals.can_edit`.  
- No UI to move APPROVED → REJECTED, REJECTED → PENDING, or REJECTED → APPROVED.  
- No rejection reason / remarks field.  
- Mutation: `UPDATE farm_cards SET fspp_approval_status = 'APPROVED'|'REJECTED' WHERE id = ?`  
- Does **not** change `farm_cards.status`, farmer `fspp_details`, or diaries.  

### Confirmed post-approval / post-rejection in admin

| Event | Observable effect in this repo |
|---|---|
| After APPROVED | Card moves to Approved tab; toast “Card APPROVED” |
| After REJECTED | Card moves to Rejected tab; toast “Card REJECTED” |
| Downstream gating | **None implemented** in admin (maps, diaries, analytics still include cards regardless of approval) |

### Unconfirmed

**`UNCONFIRMED — likely implemented outside this admin repository`:**

- Whether rejected cards can be resubmitted (new card vs status reset)  
- Whether APPROVED unlocks mobile diary/SOP flows  
- Notifications to SE  

---

## 12. Category A “Auto-Approved” Conflict

### Confirmed conflict

- **CardDescription** text: *“Category A farmers are Auto-Approved.”*  
- **Implementation:** Category A only changes **badge styling**. Approve/Reject remain manual for PENDING Category A cards. No `useEffect` or fetch-time update sets `APPROVED` for Category A.

Treat auto-approve as **documented intent in UI copy only**, not as implemented admin behavior, unless proven in mobile/DB triggers (**Unconfirmed** outside repo).

---

## 13. Who Can Approve / Reject

### Confirmed

| Permission | Effect |
|---|---|
| `fspp_approvals.can_view` | See Approvals page |
| `fspp_approvals.can_edit` | See Approve/Reject on PENDING |
| Open farmer from Approvals | `FarmerDetailSheet` with `canEdit={false}` (profile edit suppressed via that path’s intent; sheet still uses internal `farmers.can_edit` for Edit button — see conflict below) |

### Confirmed conflict

`FarmerDetailSheet` Edit button uses `getModulePerm('farmers').can_edit`, **ignoring** the `canEdit={false}` prop passed from Approvals. An admin with farmers edit + fspp view could still edit profile from Approvals eye icon.

### Confirmed scoping

Approvals lists cards globally (all SEs) within date range — no TH territory filter.

---

## 14. Preconditions for Approve / Reject

### Confirmed

**None** beyond:

- Card in current filtered PENDING set  
- User has `fspp_approvals.can_edit`  
- Card id exists for update  

No checks for: FSPP present, Category A–D, knockout flag, min land, card `status` ≠ DRAFT, farmer SUBMITTED, etc.

---

## 15. Farm Card Creation / Activation / Editing

### Confirmed (admin)

- No create, edit, delete, or “activate” Farm Card APIs in this repo.  
- Viewing only in FarmerDetailSheet + Approvals list.  

### Confirmed attendance signal

When a card’s `created_at` falls on an SE shift date → timeline event **“Farm Card Generated”** with plot/area/`status`.

### Unconfirmed

**`UNCONFIRMED — likely implemented outside this admin repository`:** creation rules, required `card_data` fields, polygon capture, media upload, when `status` leaves DRAFT, default `fspp_approval_status`.

---

## 16. Multiple Cards, Crops, Plots

### Confirmed

- Multiple cards per farmer allowed.  
- Plot identity = card row + `fieldNumber` (and survey/geo in `card_data`).  
- Yield history embeds past crops per plot; not the same as farmer `history_details.pastCrops`.  
- Crop tracking for SOP/observations hangs off **Farm Diary** / `crop_observation_sessions`, not off FSPP.  

### Unconfirmed

Whether one card = one crop season; limits on card count.

---

## 17. What Is Carried from FSPP into Farm Cards?

### Confirmed

**No admin copy** of FSPP fields into `card_data`. Join is **read-time**: Approvals loads `farmers(*)` with each card and reads `fspp_details` for display/filters.

Committed land on Approvals is farmer FSPP, not sum of plot cultivated areas.

---

## 18. Search / Filter Behavior (Approvals)

### Confirmed

| Control | Business meaning |
|---|---|
| Date range | Filters by **`farm_cards.created_at`** (default: current calendar month). Single day → that day only. Empty from → no fetch. |
| Search | Farmer `full_name` substring or `mobile` substring |
| SE Name | Card’s `profiles.name` via `se_id` |
| FSPP Category | Farmer category or `Uncategorized` if missing |
| Min. Committed Land + unit | Farmer committed land threshold (exact unit match) |
| Tabs | PENDING / APPROVED / REJECTED counts after filters |
| Pagination | 10 per page |

Reset restores filters and current month.

---

## 19. Permissions & Visibility

### Confirmed

| Surface | Module key |
|---|---|
| Approvals page | `fspp_approvals` |
| Farmer directory / FSPP read / cards list | `farmers` |
| Mobile (labels only in Roles) | `mobile_farmer` includes Farm Card, Diary, FSPP |

Sidebar: “FSPP Approvals” → `/fspp-approvals`.

Farmers without view cannot open directory; Approvals is separate.

---

## 20. Admin vs Mobile Responsibilities

### Confirmed admin

- Display FSPP  
- List/filter Farm Cards for approval  
- Set `fspp_approval_status`  
- View card details, media, diaries, observations  
- Use FSPP/cards in analytics, maps, attendance injection  

### Confirmed not in admin

- Create/update FSPP scores  
- Create/update Farm Cards  
- Create Farm Diaries / observations  
- Auto-approve Category A (despite copy)  

### Unconfirmed outside repo

Everything in §31.

---

## 21. History / Audit

### Confirmed

- No dedicated approval audit table in admin.  
- Approvals only overwrite `fspp_approval_status` (no approver id, no timestamp column update in code).  
- Farmer `update_history` is for profile edits, not FSPP approval.  
- Attendance reconstructs FSPP/card events from `evaluationDate` / `created_at`.  

---

## 22. Calculations / Derived Values

| Derived | Rule |
|---|---|
| Effective approval status | `fspp_approval_status \|\| 'PENDING'` |
| Farmer stage Farm Card | Any card exists |
| FSPP enrolled (analytics) | Nonempty `fspp_details` |
| Category breakdown | Count A/B/C/D from `fspp_details.category` |
| Avg FSPP score | Mean of scores among FSPP farmers |
| Farm card draft/completed metrics | `status === 'DRAFT'` vs else |
| Polygon usable | `boundary_polygon` array length > 2 |
| Score display | `score \|\| 0` with “/100” label (denominator not validated) |

---

## 23. Edge Cases

### Confirmed

1. Category A auto-approve copy vs manual buttons.  
2. Cards without FSPP still appear (Uncategorized).  
3. Knockout farmers not blocked from Approvals actions.  
4. Rejected cards have no admin “resubmit” path.  
5. Approving does not flip `farm_cards.status` out of DRAFT.  
6. Land filter unit mismatch silently excludes (no conversion).  
7. Multiple cards → repeated same FSPP category/score on each row.  
8. Diaries loadable for unapproved cards in admin.  
9. `canEdit={false}` from Approvals ineffective against sheet’s farmers permission check.  
10. Global map plots cards regardless of approval.  
11. Draft farmer FSPP may be wiped if admin saves draft profile.  

---

## 24. Cross-Module Effects

| Module | Effect |
|---|---|
| Farmers | Stage, FSPP hub, cards directory, `has_farm_card` |
| FSPP Approvals | Primary approval workflow |
| Territory Routes | Card counts, polygons, FSPP metrics, product visits via diaries |
| Attendance | FSPP enrollment + Farm Card Generated timeline events |
| Farm Diary ops | Diaries/observations (no approval gate in admin page) |
| Roles | `fspp_approvals`, `mobile_farmer` |
| Settings farmer | Unrelated non-persisted scoring seed |

---

## 25. Answers to Explicit Determination Questions

| Question | Answer from this repo |
|---|---|
| Where does FSPP data originate? | Written into `farmers.fspp_details` / draft_data **outside** admin create/update paths |
| Admin or mobile create/update FSPP? | Admin display-only; create/update **`UNCONFIRMED — likely mobile`** |
| Is FSPP approval required before a card can exist/activate? | **No** gate in admin; cards exist and are what get approved |
| Statuses & transitions? | PENDING↔APPROVED/REJECTED from PENDING only (admin); card `status` separate |
| After approval? | Status flag only; no further admin side effects |
| After rejection? | Status flag only; no remarks; no admin reopen |
| Rejected FSPP resubmit? | N/A for farmer FSPP; rejected **cards** not reopenable in admin — mobile unknown |
| Multiple Farm Cards per farmer? | **Yes** |
| Cards tied to crops/plots? | **Plots** via `card_data`; crops mainly via diary/yieldHistory |
| Cards independent of approved FSPP? | **Yes** in admin |
| Cards → diaries? | `farm_card_id` (detail) and `farmer_id` (analytics) |
| Fields carried FSPP → card? | **None** copied; join at read time |
| Rules on land/category/score? | Display + Approvals filters; analytics aggregates; no hard approval preconditions |

---

## 26. Rules a New Stack Must Preserve

1. Keep FSPP as farmer-level JSON (`fspp_details`) separate from plot-level Farm Cards.  
2. Allow multiple Farm Cards per farmer; expose plot fields from `card_data` and polygons/media.  
3. Maintain `fspp_approval_status` on **farm cards** with PENDING / APPROVED / REJECTED (null → PENDING).  
4. Provide admin approval UX filtered by card created_at, SE, farmer search, FSPP category, committed land+unit.  
5. Approve/Reject only update approval status (unless product deliberately adds side effects).  
6. Do not invent an admin scoring engine unless porting mobile rules; display the same FSPP fields.  
7. Preserve dual card axes: `status` (draft/complete) vs `fspp_approval_status`.  
8. Link diaries to cards (and farmers) for inspection; do not assume admin enforces approval-before-diary unless mobile rules are confirmed.  
9. Gate Approvals with `fspp_approvals` view/edit.  
10. Document Category A auto-approve as **unimplemented in admin** unless external automation is verified.

---

## 27. Important Unresolved / Conflicting Rules

1. UI “Category A Auto-Approved” vs no auto-approve code.  
2. Whether mobile/DB auto-approves Category A.  
3. Whether approval is required for diaries/SOP (not enforced in admin).  
4. Rejection without remarks; no reopen path.  
5. Settings farmer scoring ≠ live `fspp_details` schema.  
6. `canEdit={false}` ignored by FarmerDetailSheet Edit gating.  
7. FSPP scoring / knockout business rules outside repo.  
8. Farm Card create/complete rules outside repo.  
9. Relationship between card `status` DRAFT and approval PENDING (orthogonal in admin).  

---

## 28. Cross-Module Dependencies

**Depends on:** Farmers (`fspp_details`, farmer identity), Profiles/SE (`se_id`), Permissions (`fspp_approvals`).  

**Depended on by:** Farmers stage/UI, Routes/Territory maps & metrics, Attendance timeline, Farm Diary detail chain, mobile ops (**external**).

---

## 29. Evidence / Source Index

| Concern | Source |
|---|---|
| Approve/reject, filters, tabs, Category A copy | `src/pages/FsppApprovals.tsx` |
| FSPP display, cards, diaries, observations | `src/components/FarmerDetailSheet.tsx` |
| Stage / has_farm_card | `src/components/FarmerTable.tsx`, `FarmersPage.tsx` |
| FSPP + card timeline events | `src/components/AttendanceTimelineSheet.tsx` |
| Polygons, card metrics, FSPP analytics | `RoutesPage.tsx`, `TerritoryViewSheet.tsx`, `PolygonMap.tsx` |
| Permission key | `RolesPage.tsx`, `AppSidebar.tsx` |
| Non-persisting farmer scoring seed | `SettingsTemplatePage.tsx` |
| Inventory notes | `docs/module-inventory.md` |

---

## 30. Rules That Appear to Live Outside This Repository

1. Creating/updating `farmers.fspp_details` (questionnaire, score, category, knockout, evaluationDate)  
2. Creating/updating `farm_cards` (card_data, media, boundary_polygon, initial statuses)  
3. Transitioning `farm_cards.status` out of DRAFT  
4. Defaulting or auto-setting `fspp_approval_status` (including any true Category A auto-approve)  
5. Resubmission after rejection  
6. Enforcing approval before Farm Diary / SOP  
7. Writing `mandatory_base_visits` and observation sessions  
8. Remote DDL/RLS/triggers on `farm_cards` / `fspp_details`  
9. Mobile permission enforcement for `mobile_farmer`  

Mark each: **`UNCONFIRMED — likely implemented outside this admin repository`**.

---

*End of FSPP & Farm Cards business rules extraction.*
