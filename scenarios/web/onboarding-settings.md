# WEB Test Scenarios — onboarding-settings

**Module ID**: `onboarding-settings`  
**Layer**: WEB  
**Primary sources analyzed**:
- `src/pages/SettingsTemplatePage.tsx` (active routes)
- `src/pages/SettingsPage.tsx` (legacy `/settings/legacy`)
- `src/components/AppSidebar.tsx` (Settings nav visibility)
- `src/pages/Index.tsx` (routes)

**UI Entry**:
- `/settings` → redirects to `/settings/dealer`
- `/settings/dealer` | `/settings/farmer` | `/settings/distributor` → `SettingsTemplatePage`
- `/settings/legacy` → `SettingsPage` (tabbed dealer/farmer/distributor editor without Legal Agreement)

**Permission module key**: none via `getModulePerm` — neither settings page calls `usePermissions`.

**Code notes**:
- Sidebar shows Settings children **only when `role === 'Super Admin'`**. Route `guard` is session-only (`session ? page : login`); non–Super Admin can still open `/settings/*` by URL if logged in.
- **Save does not persist to Supabase** in either page. Template page: builds payload, `console.log`, `toast.success(\`${typeLabel} onboarding template saved\`)` with TODO upsert. Legacy page: TODO upsert per type, `console.log`, `toast.success(\`${title} saved\`)`; catch would show `Failed to save ${title}` but no throw path exists today.
- Dealer seeds annexures/terms/final commitments; farmer/distributor seed **empty** agreement arrays (Legal Agreement tab still editable via Add).
- No field-required validation on Save (empty labels/tiers allowed).
- `maxScore` clamped with `Math.max(1, Number(value) || 0)`. Tier `scoreThreshold` uses `Number(value) || 0`.

---

# Test Scenario: Onboarding Settings — Navigation & Access

## Operation Overview
- **Module ID**: onboarding-settings
- **UI Entry**: Sidebar Settings / direct URLs
- **Primary files**: `AppSidebar.tsx`, `Index.tsx`, `SettingsTemplatePage.tsx`
- **Handler / function**: role check in sidebar; `guard` in Index
- **API / data ops**: none
- **Layer**: WEB

## Code Analysis

### Permissions / Visibility
1. Settings collapsible only if `role === 'Super Admin'`
2. Page itself has no Access Denied / `can_view` check

## Test Cases

### Success Scenarios

#### WEB-TC-001: Super Admin sees Settings nav and opens dealer template
- **Preconditions**: logged in; `role === 'Super Admin'`
- **Expected UI behavior**: Settings → Dealer/Farmer/Distributor Onboarding links; `/settings/dealer` shows "Manage Dealer Onboarding Template"

#### WEB-TC-002: `/settings` redirects to dealer template
- **Code Path**: Index Navigate replace
- **Expected UI behavior**: Lands on `/settings/dealer`

### Business Logic Failure / Branch Scenarios

#### WEB-TC-003: Non–Super Admin does not see Settings in sidebar
- **Condition**: `role !== 'Super Admin'`
- **Expected UI behavior**: Settings collapsible absent from sidebar

#### WEB-TC-004: Unauthenticated user redirected from settings routes
- **Condition**: no `session`
- **Expected UI behavior**: `guard` → Navigate to `/login`

#### WEB-TC-005: Settings pages do not enforce module permissions
- **Based On**: no `usePermissions` in SettingsTemplatePage / SettingsPage
- **Expected UI behavior**: If logged-in non–Super Admin hits URL directly, editor UI still renders (sidebar may hide link)

---

# Test Scenario: SettingsTemplatePage — Load Seeded Templates by Type

## Operation Overview
- **Module ID**: onboarding-settings
- **UI Entry**: `/settings/{dealer|farmer|distributor}`
- **Primary files**: `src/pages/SettingsTemplatePage.tsx`
- **Handler / function**: `seedCategories` / `seedCommitments` / `seedAnnexures` / `seedTerms` / `seedFinalCommitments`
- **API / data ops**: none (in-memory defaults only; no fetch)
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Three tabs: Scoring Criteria, GLS Commitments, Legal Agreement
2. Dealer: multiple scoring categories + commitments + annexures/terms/final commitments
3. Farmer/Distributor: fewer seeded scoring/commitment defaults; agreement seeds empty `[]`
4. `totalMax` = sum of category `maxScore`

## Test Cases

### Success Scenarios

#### WEB-TC-006: Dealer page loads seeded scoring, commitments, and legal blocks
- **Preconditions**: open `/settings/dealer`
- **Expected UI behavior**: Criteria accordion with dealer categories; commitments list; Legal Agreement shows annexures/terms/final commitments counts &gt; 0

#### WEB-TC-007: Farmer page loads farmer seeds; empty agreement until add
- **Preconditions**: `/settings/farmer`
- **Expected UI behavior**: Land Holding (and other farmer seeds) + farmer commitments; Annexures/Terms counts 0 until user adds

#### WEB-TC-008: Distributor page loads distributor seeds
- **Preconditions**: `/settings/distributor`
- **Expected UI behavior**: Turnover category (seeded) + distributor commitments; empty agreement seeds

---

# Test Scenario: SettingsTemplatePage — Scoring Criteria CRUD

## Operation Overview
- **Module ID**: onboarding-settings
- **UI Entry**: Scoring Criteria tab
- **Primary files**: `SettingsTemplatePage.tsx`
- **Handler / function**: `addCategory` / `updateCategory` / `deleteCategory` / `addTier` / `updateTier` / `deleteTier`
- **API / data ops**: local React state only until Save
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. New category defaults: label `New criterion`, headers Column 1 / Remarks, maxScore 10, one tier threshold 2
2. New tier threshold = last tier threshold + 2 (or 2 if none)
3. Max score input min UI 1; onChange clamps ≥ 1
4. Deleting category/tier updates accordion immediately; totalMax recalculates

## Test Cases

### Success Scenarios

#### WEB-TC-009: Add new scoring category
- **User steps**: Add new category
- **Expected UI behavior**: New accordion item "New criterion"; totalMax increases by 10

#### WEB-TC-010: Edit category label/headers and tier values
- **User steps**: Change inputs for label, col headers, score ≤, col1/col2
- **Expected UI behavior**: State updates in UI; no API

#### WEB-TC-011: Add tier with threshold last+2
- **Based On**: `addTier`
- **Expected UI behavior**: New empty tier; threshold = previous + 2

#### WEB-TC-012: Delete tier and delete category
- **Expected UI behavior**: Removed from list; totalMax updates when category deleted

#### WEB-TC-013: Max score cannot go below 1 via input handler
- **Input**: 0 or invalid → `Math.max(1, Number(...) || 0)`
- **Expected UI behavior**: Stored maxScore ≥ 1

---

# Test Scenario: SettingsTemplatePage — GLS Commitments CRUD

## Operation Overview
- **Module ID**: onboarding-settings
- **UI Entry**: GLS Commitments tab
- **Handler / function**: `addCommitment` / `updateCommitment` / `deleteCommitment`
- **API / data ops**: local state
- **Layer**: WEB

## Test Cases

### Success Scenarios

#### WEB-TC-014: Toggle checked-by-default and edit commitment text
- **Expected UI behavior**: Checkbox and text update in state

#### WEB-TC-015: Add and delete commitment
- **Expected UI behavior**: New row `New commitment` unchecked by default; delete removes row

---

# Test Scenario: SettingsTemplatePage — Legal Agreement CRUD

## Operation Overview
- **Module ID**: onboarding-settings
- **UI Entry**: Legal Agreement tab
- **Handler / function**: annexure/term/final commitment CRUD + `toggleObligations`
- **API / data ops**: local state
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Annexure fields: label + `Requires SE Input?` (`isInput`)
2. Terms: title, content; optional obligations textarea when `obligations !== undefined`; toggle adds `''` or removes (`undefined`)
3. Final commitments: text list with add/delete

## Test Cases

### Success Scenarios

#### WEB-TC-016: Add/edit/delete annexure and fields
- **Expected UI behavior**: Title/fields/`isInput` persist in UI; counts update

#### WEB-TC-017: Add/edit/delete terms; toggle obligations block
- **Expected UI behavior**: Obligations section appears/disappears per `toggleObligations`

#### WEB-TC-018: Add/edit/delete final commitments
- **Expected UI behavior**: List updates locally

#### WEB-TC-019: Farmer/distributor can still add annexures from empty seed
- **Preconditions**: type farmer or distributor
- **User steps**: Add annexure / Add term / Add final commitment
- **Expected UI behavior**: Items created despite empty seeds

---

# Test Scenario: SettingsTemplatePage — Save Template (Client-Only)

## Operation Overview
- **Module ID**: onboarding-settings
- **UI Entry**: Save Template (header or footer)
- **Primary files**: `SettingsTemplatePage.tsx`
- **Handler / function**: `handleSave`
- **API / data ops**: **none implemented** — TODO `form_templates` upsert; payload logged
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Payload shape: `{ type, scoring_schema, commitments_schema, agreement_schema: { annexures, terms, final_commitments } }` with snake_case keys
2. Success toast always: `` `${typeLabel} onboarding template saved` ``
3. No validation before save; no error toast path in this handler

## Test Cases

### Success Scenarios

#### WEB-TC-020: Save builds payload and shows success toast (no DB write)
- **Code Path**: Save Template → `handleSave`
- **Based On**: TODO + `console.log` + `toast.success`
- **Expected UI behavior**: Toast e.g. `Dealer onboarding template saved`; console contains payload for current type
- **Expected API call**: none (upsert not executed)

#### WEB-TC-021: Save includes agreement_schema even when empty
- **Preconditions**: farmer/distributor with no annexures
- **Expected UI behavior**: Logged payload still has `agreement_schema` with empty arrays; success toast

---

# Test Scenario: SettingsPage (Legacy) — Form Settings

## Operation Overview
- **Module ID**: onboarding-settings
- **UI Entry**: `/settings/legacy`
- **Primary files**: `src/pages/SettingsPage.tsx`
- **Handler / function**: `TemplateEditor` / `handleSave`
- **API / data ops**: TODO upsert per type; not executed
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Single page with tabs Dealer / Farmer / Distributor Template (in-page, not separate routes)
2. Editor covers scoring + commitments only (no Legal Agreement / annexures)
3. Save builds `{ type, scoring_schema, commitments_schema }` only; success toast `` `${title} saved` ``; catch → `Failed to save ${title}`
4. Same local CRUD patterns (add/delete category/tier/commitment; maxScore clamp)

## Test Cases

### Success Scenarios

#### WEB-TC-022: Legacy page shows three template tabs
- **Expected UI behavior**: Form Settings; Dealer/Farmer/Distributor Template tabs switch independent state

#### WEB-TC-023: Legacy save dealer/farmer/distributor shows success without API
- **User steps**: Save Dealer/Farmer/Distributor Template
- **Expected UI behavior**: Toast `{title} saved`; console log payload without agreement_schema
- **Expected API call**: none

#### WEB-TC-024: Legacy scoring and commitments CRUD mirrors template editor
- **Expected UI behavior**: Add/edit/delete categories, tiers, commitments update local state; totalMax updates

### Business Logic Failure / Branch Scenarios

#### WEB-TC-025: Legacy save error toast only if handleSave throws
- **Condition**: catch block in `handleSave`
- **Expected UI behavior**: `Failed to save ${title}` — **not reachable** with current code (no throw after TODO)

---

## Backend/App Mapping Hints
- WEB-TC-001 → navigate_settings_super_admin
- WEB-TC-006 → view_dealer_onboarding_template
- WEB-TC-007 → view_farmer_onboarding_template
- WEB-TC-008 → view_distributor_onboarding_template
- WEB-TC-009 → edit_scoring_criteria_local
- WEB-TC-014 → edit_commitments_local
- WEB-TC-016 → edit_agreement_local
- WEB-TC-020 → save_onboarding_template_client_stub (form_templates upsert TODO)
- WEB-TC-022 → view_legacy_form_settings
- WEB-TC-023 → save_legacy_template_client_stub
