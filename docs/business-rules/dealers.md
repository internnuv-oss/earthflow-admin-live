# Business Rules — Dealers

**Source system:** Field Commander Admin (`earthflow-admin-live`)  
**Module:** Dealers  
**Related routes / keys:** `/dealers`, permission `dealers`; Settings `/settings/dealer`; mobile key `mobile_dealer`  
**Primary sources:** `src/pages/DealersPage.tsx`, `src/components/DealerTable.tsx`, `src/components/DealerDetailSheet.tsx`, `src/pages/SettingsTemplatePage.tsx`, migration `dealers` table, Dashboard/SE consumers

This document describes **business behavior** for Dealers as implemented in the reference project. It is not a redesign.

Legend:

- **Confirmed** — directly supported by implementation  
- **Implementation Detail** — how the old app encodes the rule  
- **Unconfirmed** — not proven here  
- **`UNCONFIRMED — likely implemented outside this admin repository`** — mobile / remote DB  

---

## 1. Module Purpose

### Confirmed

Admin **directory and editing surface** for agri-channel dealers onboarded in the field:

1. List **submitted** `dealers` merged with **drafts** (`entity_type = 'dealer'`)  
2. Filter/search; export CSV / print PDF  
3. Open detail sheet: Basic, Scoring, Business, Docs, Annexures, View  
4. Edit draft or submitted records when `dealers.can_edit`  

Admin does **not** create new dealers or run a separate approval workflow page (unlike FSPP Farm Cards).

---

## 2. Dealer Entity and Important Fields

### Confirmed — `dealers` table (migration + runtime)

| Field | Role |
|---|---|
| `id` | PK |
| `se_id` | Owning Sales Executive (`profiles.id`) |
| `primary_shop_name` | Shop name |
| `contact_person` | Primary contact (often first owner) |
| `contact_mobile` | Mobile |
| `primary_address` | Address |
| `gst_number`, `pan_number` | Tax IDs |
| `est_year`, `firm_type` | Firm meta |
| `bank_details` | JSON (`bankAccounts[]`, …) |
| `scoring` | JSON of per-aspect scores + remarks + `redFlags` |
| `total_score` | Numeric sum |
| `category` | Elite / A / B / C labels (see §10) |
| `commitments` | JSON business commitments flags + checklists |
| `documents` | JSON map name → URL |
| `status` | Default `'DRAFT'` in migration; directory uses DRAFT from drafts table vs submitted rows |
| `annexures` | JSON annexure answers |
| `owners_list` | JSON array of owners |
| `additional_locations` | Shops/godowns (shape varies: object with arrays in UI) |
| `distributor_links` | Linked distributors JSON |
| `demo_farmers_data` | Demo farmers JSON (not `farmers` FK rows) |
| `primary_shop_location` | state/city/taluka/village/landmark/landline |
| `pdf_url` | Optional dossier URL |
| `created_at` | Timestamp |
| `update_history` | Runtime audit array (not in local migration) |

### Confirmed — draft (`drafts`, `entity_type = 'dealer'`)

Flat/nested `draft_data` mapped into dealer-shaped rows for the directory (shopName → primary_shop_name, owners[0].name → contact_person, scoring keys, annexure keys, etc.). Display forces `category: '—'`, `total_score: 0`, `status: 'DRAFT'`, `id = entity_id`.

---

## 3. Onboarding Lifecycle

### Confirmed in admin

```
Mobile/field creates draft and/or submitted dealer
        ↓
Admin lists drafts + dealers together
        ↓
Admin may edit draft → updates drafts.draft_data
Admin may edit submitted → updates dealers (+ recalculates total_score/category)
```

### Confirmed — what admin does **not** do

- Insert into `dealers`  
- Promote draft → submitted  
- Delete dealers  

**`UNCONFIRMED — likely implemented outside this admin repository`:** when main `dealers` row is created, status values at submit (`SUBMITTED` / `APPROVED` / etc.), mobile validation at submit.

### Confirmed status display

- Drafts → badge “Saved Draft”  
- Other statuses shown as-is; badge treats `APPROVED` specially (default variant)  

---

## 4. Draft vs Submitted Behavior

| Aspect | Draft | Submitted (`dealers` row) |
|---|---|---|
| Storage | `drafts` | `dealers` |
| List category/score | Forced `—` / `0` | Stored `category` / `total_score` |
| Admin save target | `drafts.update({ draft_data, updated_at, update_history })` | `dealers.update({… fields …})` |
| Recalc total/category on save | **No** | **Yes** (from scoring aspects) |
| Scoring included in admin draft rewrite | **No** (see conflict §23) | Yes (`scoring` JSON) |

Match draft rows with `.or(id.eq.{id},entity_id.eq.{id})`.

---

## 5. Creation Rules

### Confirmed

No “Add Dealer” in admin. Creation is external.

---

## 6. Required / Optional Fields & Validation (Admin Edit)

### Confirmed `validateForm` (applies to both draft and submitted saves)

**Required**

| Rule |
|---|
| Shop name ≥ 2 chars |
| Firm type selected |
| Establishment year exactly 4 digits |
| State, City/District, Taluka, Village |
| Address ≥ 5 chars |
| Mobile exactly 10 digits |
| GST regex: `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$` |
| PAN regex: `^[A-Z]{5}[0-9]{4}[A-Z]{1}$` |
| Each bank account: all of accountType, bankName, bankBranch, accountName, accountNumber, bankIfsc |
| Account number 9–18 digits; IFSC `^[A-Z]{4}0[A-Z0-9]{6}$` |

**Conditional**

| Rule |
|---|
| Landline if present: loose pattern `^[0-9]{3,5}[- ]?[0-9]{6,8}$` |
| If credit references = Yes: each ref needs name; contact if present must be 10 digits |
| If security deposit &gt; 0: payment proof text **or** document key `se_payment_proof` required |

**Not validated by admin** (but editable/viewable): scoring values, owners names, distributor links, demo farmers, most annexure free text, document presence (except deposit proof).

### Confirmed location source conflict

Dealer edit loads districts/talukas from **GitHub** `indian-cities-and-villages` by state — **not** Location Master (`districts`/`talukas`/`villages` tables). Village is free text.

---

## 7. Sales Executive Assignment

### Confirmed

- `se_id` on dealer/draft; displayed as “Onboarded By” via `profiles.name`.  
- Admin edit does **not** change `se_id`.  
- SE detail counts dealers with `.eq('se_id', se.id)` (submitted table only — drafts not counted there).  
- Dashboard: dealers count + dealer drafts pending.  

---

## 8. Distributor Relationship

### Confirmed

- `distributor_links` / draft `linkedDistributors` — JSON array edited in Business tab.  
- Flag `commitments.isLinkedToDistributor`.  
- Not a hard FK to `distributors` table in admin code.  

### Unconfirmed

Structure of each link object; whether mobile validates against real distributor IDs.

---

## 9. Farmer Relationship

### Confirmed

| Link | Nature |
|---|---|
| `farmers.dealer_id` | Optional FK to dealer (schema); **unused in Dealers UI** |
| `demo_farmers_data` | JSON demo farmers on dealer record — **not** the Farmers module entities |
| Territory `temp_dealers` | Separate prospect table matched by village — **not** `dealers` |

---

## 10. Scoring Dimensions, Calculation, Category

### Confirmed — eight aspects (`SCORING_ASPECTS` in DealerDetailSheet)

Each aspect has score key + remarks key:

| Score key | Remarks key | Label |
|---|---|---|
| `scoreFinancial` | `remFinancial` | Financial Health & Turnover |
| `scoreReputation` | `remReputation` | Market Reputation |
| `scoreOperations` | `remOperations` | Shop Operations & Infrastructure |
| `scoreFarmerNetwork` | `remFarmerNetwork` | Farmer Network & Reach |
| `scoreTeam` | `remTeam` | Team & Professionalism |
| `scorePortfolio` | `remPortfolio` | Current Portfolio |
| `scoreExperience` | `remExperience` | Experience & Openness to Bio |
| `scoreGrowth` | `remGrowth` | Growth Orientation |

Plus free-text `redFlags`.

### Confirmed — how scores are entered

- **Manual numeric entry** in admin (input min 1, max 10).  
- `getDynamicTableData(scoreKey, score)` only shows **guidance** tier labels for the chosen score — does **not** compute the score from turnover/farmer counts.  

### Confirmed — total score (submitted save)

```
total_score = Σ (Number(scoringData[aspect.key]) || 0)  for all 8 aspects
```

Theoretical max if each is 10 = **80**. Missing aspects count as 0.

### Confirmed — category derivation (submitted save only)

| Condition | Category |
|---|---|
| `total_score > 60` | `Elite` |
| `total_score >= 46` | `A-Category` |
| `total_score >= 26` | `B-Category` |
| else | `C-Category` |

### Confirmed — draft scoring

Directory shows category `—` and score `0` even if draft_data contains scores. Admin draft save **omits** scoring keys from rewritten `draft_data` → **risk of wiping mobile-entered scores**.

### Confirmed — Settings / Templates

`/settings/dealer` seeds **4** scoring categories (Financial, Reputation, Operations, Farmer Network) with tier tables and commitments/annexures/terms. **Persist is TODO** (`form_templates` upsert commented). Not loaded by DealerDetailSheet.

### Confirmed conflicts with Settings tiers

| Topic | DealerDetailSheet `getDynamicTableData` | SettingsTemplatePage `DEALER_CATEGORIES` |
|---|---|---|
| Aspects covered | 8 | 4 |
| Farmer network bands | e.g. &lt;40, 40–80, … | &lt;50, 50–150, … |
| Operations descriptors | sq.ft / godown language | Different “Very Basic…Premium” copy |

Treat DealerDetailSheet as the **runtime admin scoring UI**; Settings as **non-persisted design tool**.

### Unconfirmed

Whether mobile uses the same 8 keys, same 1–10 scale, same Elite/A/B/C thresholds at submit time.

**`UNCONFIRMED — likely implemented outside this admin repository`:** initial scoring at onboarding submit.

---

## 11. Commitment Rules

### Confirmed fields used in edit/save

From `commitments` / draft:

- `proposedStatus`, `willingDemoFarmers`, `hasAdditionalLocations`, `isLinkedToDistributor`  

### Confirmed view-only (Eval tab)

- `glsCommitments`, `complianceChecklist` (lists) — mapped from draft on load; **not** rewritten on submitted commitments save (spread keeps prior if present).  

### Confirmed Settings seed commitments (not persisted)

GLS Commitments Accepted, Regulatory Compliance Checklist, Credit Policy Accepted, Exclusivity Agreement, Payment Terms Agreed — UI templates only.

---

## 12. Annexure Rules

### Confirmed editable annexure fields

- `seTerritories[]` (village/majorCrops stored as comma strings in UI, split to arrays on save)  
- `sePrincipalSuppliers`, `seChemicalProducts`, `seBioProducts`, `seOtherProducts` (multi-select from demo option lists)  
- `seHasCreditReferences`, `seCreditReferences[]`  
- `seWillShareSales` (Yes/No → boolean on **draft** save)  
- `seGrowthVision`, `seSecurityDeposit`, `sePaymentProofText`  

### Confirmed conflict

Submitted `annexures` update object **does not include `seWillShareSales`** (draft path does). Prior value may remain only via `...d.annexures` if never cleared.

Settings defines Annexure A–F titles for dealers; not wired to live save.

---

## 13. Documents

### Confirmed

- `documents` object: arbitrary key → Cloudinary `secure_url`.  
- Upload UI: name + file → Cloudinary (`YOUR_UPLOAD_PRESET` / `YOUR_CLOUD_NAME` placeholders in code — **likely broken unless replaced**).  
- Deposit proof may use key `se_payment_proof`.  
- `pdf_url` on schema; little emphasis in Dealers list.  

---

## 14. Edit / Update / History

### Confirmed

- Edit gated by `canEdit` (`dealers.can_edit` from page).  
- Appends `update_history`: `{ timestamp, action: 'Admin Edited Profile', updated_status }`.  
- Submitted save updates listed scalar/JSON columns; does **not** update `se_id`, `status`, `pdf_url`.  
- Contact person on submitted = `owners[0].name`.  

### Confirmed — no delete/deactivate UI

---

## 15. Approval / Review

### Confirmed

No dedicated dealer approval module. Category/score are data fields, not PENDING/APPROVED workflow like farm cards.

Status may show `APPROVED` if stored that way externally.

---

## 16. Permissions & Visibility

### Confirmed

| Permission | Effect |
|---|---|
| `dealers.can_view` | Directory access |
| `dealers.can_edit` | Edit Profile button |

Global admin scope (all SEs). Mobile: `mobile_dealer` label only in Roles.

---

## 17. Search / Filter / Export

### Confirmed filters

Status, Category (excludes `—`), Onboarded By (SE name).

Search: shop, contact, mobile, address, SE name.

### Confirmed exports

CSV and print-PDF of **filtered** rows (Shop, Contact, Mobile, Address/Category, Onboarded By, Date, Status). Note: `DealerTable` does not wire `onFilteredDataChange` in its props usage — DealersPage passes it but DealerTable **ignores** the prop → exports may use stale full list (**conflict**).

Checking DealersPage again... DealerTable props include onFilteredDataChange but DealerTable destructuring only uses `rows, onSelect, seOptions` — confirmed bug/conflict: filtered export may not track filters.

---

## 18. Data Ownership / Scoping

### Confirmed

Owned by `se_id`. No TH geographic filter in queries.

---

## 19. Calculations / Derived Values

| Derived | When | Rule |
|---|---|---|
| `total_score` | Submitted admin save | Sum of 8 aspect scores |
| `category` | Submitted admin save | Elite / A / B / C thresholds |
| Guidance tier text | Edit UI | `getDynamicTableData` by aspect + score |
| List draft score/category | Load | Forced 0 / — |

---

## 20. Edge Cases

### Confirmed

1. Draft admin save drops scoring (and possibly other draft-only keys).  
2. Settings scoring incomplete vs live 8 aspects; not persisted.  
3. Location Master unused; GitHub geo catalog used.  
4. Cloudinary placeholders may block uploads.  
5. Export filter sync broken (`onFilteredDataChange` unused).  
6. `demo_farmers_data` ≠ Farmers module; `temp_dealers` ≠ `dealers`.  
7. `farmers.dealer_id` unused in Dealers UI.  
8. SE counts ignore drafts.  
9. Submitted annexures omit `seWillShareSales` in update payload.  
10. Category badge heuristics include “platinum/gold” strings unused by Elite/A/B/C formula.  

---

## 21. Cross-Module Effects

| Module | Interaction |
|---|---|
| Sales Executives | `se_id`; SE dealer counts |
| Distributors | Soft links in `distributor_links` |
| Farmers | Optional `dealer_id`; demo farmers JSON |
| Territory Routes | Uses `temp_dealers`, not this table |
| Dashboard | Dealer + draft KPIs |
| Settings dealer | Non-persisted templates |
| Roles | `dealers`, `mobile_dealer` |

---

## 22. Answers to Scoring Investigation Questions

| Question | Answer |
|---|---|
| Inputs to scoring? | Eight manually entered scores (+ remarks/redFlags); not auto from GST/turnover fields |
| Dimensions? | Financial, Reputation, Operations, Farmer Network, Team, Portfolio, Experience, Growth |
| How each score calculated? | **Entered** 1–10; guidance table only |
| Manual or derived? | Manual in admin |
| Total? | Sum of eight |
| Category from scores? | Elite &gt;60; A ≥46; B ≥26; else C |
| Thresholds? | As above (absolute points, not %) |
| Different dealer types? | `proposedStatus` / firm_type exist; **same** scoring formula |
| Settings config? | Hardcoded seeds; **not** persisted; not consumed by detail sheet |
| Scoring in this repo? | Recalc on **submitted admin save**; initial onboarding scoring external |
| Draft vs submitted? | Draft list hides score; draft save doesn’t recalculate/persist scoring |

---

## 23. Rules a New Stack Must Preserve

1. Merge drafts + submitted dealers in directory with DRAFT status for drafts.  
2. Persist ownership via `se_id`; show onboarded-by name.  
3. Support the eight scoring aspects + remarks + redFlags JSON.  
4. On submitted save: total = sum of aspect scores; category Elite/A/B/C with thresholds &gt;60 / ≥46 / ≥26.  
5. Keep guidance tier copy aligned with product intent (or explicitly replace Settings).  
6. Enforce listed admin validation (GST/PAN/bank/IFSC/deposit proof).  
7. Append update_history on admin edits.  
8. Separate draft update path vs dealers table update.  
9. Represent distributor links and demo farmers as structured JSON unless redesigned to FKs.  
10. Do not assume Location Master for dealer geo unless intentionally migrating off GitHub catalog.  

---

## 24. Important Unresolved / Conflicting Rules

1. Draft save omits scoring → data loss risk.  
2. Settings 4-aspect templates ≠ 8-aspect runtime; no persistence.  
3. Export ignores table filter callback.  
4. `temp_dealers` vs `dealers` dual models.  
5. Mobile submit status vocabulary (`SUBMITTED` vs `APPROVED`).  
6. Whether mobile uses identical category thresholds.  
7. Cloudinary placeholder credentials.  
8. GitHub locations vs Location Master.  
9. `seWillShareSales` dropped on submitted annexure update.  

---

## 25. Cross-Module Dependencies

**Depends on:** Profiles/SE, Auth/permissions, Cloudinary (intended), optional GitHub location JSON.  

**Depended on by:** Dashboard, SE counts, Farmers FK (optional), Settings (conceptual only).

---

## 26. Evidence / Source Index

| Concern | Source |
|---|---|
| List merge, exports | `src/pages/DealersPage.tsx` |
| Filters/columns | `src/components/DealerTable.tsx` |
| Validation, scoring, save paths, docs, annexures | `src/components/DealerDetailSheet.tsx` |
| Schema | `supabase/migrations/20260511052322_….sql` |
| Non-persisted templates | `src/pages/SettingsTemplatePage.tsx` |
| KPIs / SE counts | `Dashboard.tsx`, `SEDetailSheet.tsx` |
| Inventory notes | `docs/module-inventory.md` |

---

## 27. Rules That Appear to Live Outside This Repository

1. Creating dealer drafts and submitted `dealers` rows  
2. Draft → submitted promotion and status assignment  
3. Initial scoring entry / category at mobile submit  
4. Completing `glsCommitments` / compliance checklists  
5. Generating `pdf_url` dossiers  
6. Setting `farmers.dealer_id`  
7. Population/lifecycle of `temp_dealers`  
8. Any live read of `form_templates`  

Mark: **`UNCONFIRMED — likely implemented outside this admin repository`**.

---

*End of Dealers business rules extraction.*
