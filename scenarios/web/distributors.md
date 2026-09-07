# WEB Test Scenarios — distributors

**Module ID**: `distributors`  
**Layer**: WEB  
**Primary sources analyzed**:
- `src/pages/DistributorsPage.tsx`
- `src/components/DistributorTable.tsx`
- `src/components/DistributorDetailSheet.tsx`
- `src/components/DataTable.tsx` (search/filter/sort/pagination)
- `src/hooks/useAuth.ts` / `src/hooks/usePermissions.ts`

**UI Entry**: `/distributors`  
**Permission module key**: `distributors`

**Code notes**:
- **View-only module in this UI**: `distributorAccess.can_edit` is read but never used; detail sheet has no edit/save; no create/delete/approve handlers.
- Draft rows are thinly mapped (`firmName`, `contactPerson`, `contactMobile`, `city` only) — detail tabs for drafts mostly lack scoring/network/annexure fields unless present on submitted rows.
- `DistributorsPage` passes `onFilteredDataChange={setFilteredData}` into `DistributorTable`, but `DistributorTable` does **not** destructure/forward it to `DataTable`, so exports use the initial full combined list unless something else updates `filteredData`.

---

# Test Scenario: Distributors — Access Gate

## Operation Overview
- **Module ID**: distributors
- **UI Entry**: `/distributors`
- **Primary files**: `src/pages/DistributorsPage.tsx`
- **Handler / function**: `getModulePerm('distributors')`
- **API / data ops**: via `usePermissions`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. `authLoading || permLoading` → full-screen spinner
2. `!distributorAccess.can_view` → Access Denied + `You do not have permission to view the distributor directory.`
3. Directory UI (and data fetch effect) not gated by `can_edit`

### Permissions / Visibility
1. **`can_view`** required for directory
2. **`can_edit`** unused in page/table/sheet

## Test Cases

### Success Scenarios

#### WEB-TC-001: User with distributors.can_view sees directory
- **Code Path**: permission check → main return
- **Based On**: `DistributorsPage.tsx`
- **Preconditions**: `distributorAccess.can_view === true`
- **User steps**: Open `/distributors`
- **Expected UI behavior**: "Distributor Directory"; count subtitle; table/export when loaded

### Business Logic Failure / Branch Scenarios

#### WEB-TC-002: Auth/perm loading shows spinner
- **Condition**: `authLoading || permLoading`
- **Expected UI behavior**: Centered spinner; no Access Denied / directory yet

#### WEB-TC-003: Missing can_view shows Access Denied
- **Condition**: `!distributorAccess.can_view`
- **Expected UI behavior**: Access Denied UI with distributor directory permission message

---

# Test Scenario: Distributors — List (Submitted + Drafts)

## Operation Overview
- **Module ID**: distributors
- **UI Entry**: Directory after `can_view`
- **Primary files**: `src/pages/DistributorsPage.tsx`, `src/components/DistributorTable.tsx`
- **Handler / function**: mount `useEffect` load
- **API / data ops**:
  - `profiles.select('name').eq('role','SE')` (filter options)
  - `distributors.select('*, profiles:se_id(name)').order('created_at', { ascending: false })`
  - `drafts.select('*, profiles:se_id(name)').eq('entity_type','distributor')`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Draft mapping: `id=entity_id`, `firm_name` from `draft_data.firmName` or `Incomplete Distributor`, contact fields/`city` with `—` defaults, `status:'DRAFT'`, `total_score:0`, `band:'—'`, `created_at: updated_at`
2. Combine distributors + drafts; sort by `created_at` desc
3. Subtitle: `(rows).length` total records
4. Empty table: `No distributors found.`
5. Status badge: DRAFT → "Saved Draft"; APPROVED/REJECTED/SUBMITTED colored outline badges; else Pending/gray

### Error / Edge Paths Handled in UI
1. Distributors query error → toast `Failed to load` / `error.message`
2. Drafts fetch has no error toast

## Test Cases

### Success Scenarios

#### WEB-TC-004: Successful load merges distributors and drafts
- **Code Path**: page effect → supabase → `DistributorTable`
- **Based On**: `DistributorsPage.tsx` combine/sort
- **Preconditions**: `can_view`
- **Expected UI behavior**: Table shows submitted + draft rows newest first; drafts show "Saved Draft"
- **Expected API call**: SE names + distributors select + drafts where `entity_type='distributor'`

#### WEB-TC-005: Draft firm name / contact defaults
- **Based On**: `formattedDrafts` mapping
- **Input**: draft missing firmName / contact fields
- **Expected UI behavior**: Firm `Incomplete Distributor` (or Unnamed in table if null); contact/mobile/city show mapped `—` where coded; band `N/A` / `—` path; score not shown meaningfully (`0` / `—`)

#### WEB-TC-006: Empty list message
- **Condition**: combined length 0
- **Expected UI behavior**: `No distributors found.`

### Business Logic Failure / Branch Scenarios

#### WEB-TC-007: Distributors query error toast
- **Condition**: distributors select returns `error`
- **Expected UI behavior**: Toast `Failed to load` / `error.message` (drafts may still merge if returned)

---

# Test Scenario: Distributors — Search, Filter, Sort

## Operation Overview
- **Module ID**: distributors
- **UI Entry**: DistributorTable / DataTable
- **Primary files**: `src/components/DistributorTable.tsx`, `src/components/DataTable.tsx`
- **Handler / function**: client filter/search/sort
- **API / data ops**: None
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Search: firm_name, owner_name, contact_mobile, city, profiles.name
2. Filters: Status (unique statuses), Band (unique, excludes `'—'`), Onboarded By (`seOptions` / profiles.name)
3. Sortable columns: Firm Name, Owner, Mobile, City (city+state), Onboarded By, Band/Score (`total_score`), Status
4. Band badge variant: green/`a` → default; red/`c` → destructive; else secondary
5. Default page size 10 via DataTable

## Test Cases

### Success Scenarios

#### WEB-TC-008: Search matches firm / owner / mobile / city / SE name
- **Based On**: `searchAccessor`
- **User steps**: Type in "Search distributors..."
- **Expected UI behavior**: Case-insensitive includes filter on concatenated fields

#### WEB-TC-009: Filter by Status
- **Condition**: `values.includes(row.status)`
- **Expected UI behavior**: Only matching status rows remain

#### WEB-TC-010: Filter by Band
- **Condition**: band filter; options exclude `'—'`
- **Expected UI behavior**: Only selected band values

#### WEB-TC-011: Filter by Onboarded By
- **Condition**: `values.includes(row.profiles?.name)`
- **Preconditions**: `seOptions` populated
- **Expected UI behavior**: Rows for selected SE name(s)

#### WEB-TC-012: Sort by Firm Name and Band/Score numeric
- **Based On**: column `sortable` / `sortValue`
- **Expected UI behavior**: Asc/desc reorder; band column sorts by `total_score`

#### WEB-TC-013: Status badge variants for APPROVED / REJECTED / SUBMITTED / DRAFT
- **Based On**: status accessor color map
- **Expected UI behavior**: DRAFT → Saved Draft; named statuses use coded color classes; unknown → Pending/gray

---

# Test Scenario: Distributors — Export Excel (CSV)

## Operation Overview
- **Module ID**: distributors
- **UI Entry**: Excel (CSV) when `!loading`
- **Primary files**: `src/pages/DistributorsPage.tsx`
- **Handler / function**: `handleExportExcel`
- **API / data ops**: None — Blob from `filteredData`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Headers: Sr. No., Firm Name, Contact Person, Mobile, City, Band, Onboarded By, Date, Status
2. Filename: `distributors_export_${YYYY-MM-DD}.csv`
3. Uses `filteredData` (see wiring note)

## Test Cases

### Success Scenarios

#### WEB-TC-014: Export CSV downloads distributors_export_<date>.csv
- **Code Path**: Click Excel → `handleExportExcel`
- **Based On**: `DistributorsPage.tsx`
- **User steps**: Click "Excel (CSV)"
- **Expected UI behavior**: Browser download of CSV built from current `filteredData`

---

# Test Scenario: Distributors — Export PDF (Print)

## Operation Overview
- **Module ID**: distributors
- **UI Entry**: PDF button
- **Primary files**: `src/pages/DistributorsPage.tsx`
- **Handler / function**: `handleExportPDF`
- **API / data ops**: None — `window.open` print HTML from `filteredData`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Print document "Distributor Directory Export" with same columns as CSV body fields
2. Auto print/close after 500ms
3. Popup blocked → silent `return` (no toast)

## Test Cases

### Success Scenarios

#### WEB-TC-015: PDF export opens print window
- **Code Path**: Click PDF → `handleExportPDF`
- **User steps**: Click "PDF" (allow popups)
- **Expected UI behavior**: Export window + print triggered

### Business Logic Failure / Branch Scenarios

#### WEB-TC-016: Popup blocked — no toast
- **Condition**: `!printWindow`
- **Expected UI behavior**: No print document; no error toast coded

---

# Test Scenario: Distributors — View Detail Sheet

## Operation Overview
- **Module ID**: distributors
- **UI Entry**: Click table row
- **Primary files**: `src/components/DistributorDetailSheet.tsx`
- **Handler / function**: `onSelect` / sheet open
- **API / data ops**: None (row props only)
- **Layer**: WEB

## Code Analysis

### Validations Found in Code
None (view-only).

### Business Logic Found in Code
1. Header: firm name; onboarded by; status badge; optional band · score badge
2. If `pdf_url` → "View PDF Dossier" link (`target=_blank`)
3. Tabs: Basic Info, Profiling, Network & Bank, Annexures
4. Basic: Firm Details, Address, Statutory KeyValueGrids
5. Profiling: scoring, business_scope, commitments
6. Network: dealer_network, bank_details, documents
7. Annexures: annexures + optional Raw Submission Data if `raw_data` has keys
8. Close via sheet `onOpenChange` when closed

### Permissions / Visibility
1. No edit controls; no `can_edit` gating inside sheet

## Test Cases

### Success Scenarios

#### WEB-TC-017: Row click opens detail sheet
- **Code Path**: `DistributorTable` `onRowClick` → `setSelected` → sheet
- **User steps**: Click a distributor row
- **Expected UI behavior**: Sheet opens with firm title, status, onboarded-by; four tabs available

#### WEB-TC-018: PDF dossier button when pdf_url present
- **Condition**: `d.pdf_url` truthy
- **Expected UI behavior**: "View PDF Dossier" link to `pdf_url` in new tab

#### WEB-TC-019: PDF button hidden when no pdf_url
- **Condition**: `!d.pdf_url`
- **Expected UI behavior**: No dossier button

#### WEB-TC-020: Basic / Profiling / Network / Annexures tabs render fields from row
- **Based On**: TabsContent KeyValueGrids
- **Expected UI behavior**: Sections show mapped distributor fields (may be empty for thinly mapped drafts)

#### WEB-TC-021: Raw Submission Data section only if raw_data non-empty
- **Condition**: `d.raw_data && Object.keys(d.raw_data).length > 0`
- **Expected UI behavior**: Extra "Raw Submission Data" section; otherwise omitted

#### WEB-TC-022: Close sheet clears selection
- **User steps**: Close sheet
- **Expected UI behavior**: `onClose` → `selected` null

---

## Operations Not Present in Code (no TCs)

- Create distributor
- Edit / save / validate distributor
- Delete / approve / reject
- Any UI use of `distributors.can_edit`

---

## Backend/App Mapping Hints

| WEB-TC | Operation key |
|--------|----------------|
| WEB-TC-001 | view_distributors_directory |
| WEB-TC-002 | distributors_perm_loading |
| WEB-TC-003 | deny_distributors_without_can_view |
| WEB-TC-004 | list_distributors_and_drafts |
| WEB-TC-005 | map_distributor_draft_row |
| WEB-TC-006 | list_distributors_empty |
| WEB-TC-007 | list_distributors_error |
| WEB-TC-008 | search_distributors |
| WEB-TC-009 | filter_by_status |
| WEB-TC-010 | filter_by_band |
| WEB-TC-011 | filter_by_se |
| WEB-TC-012 | sort_distributors |
| WEB-TC-013 | status_badge_variants |
| WEB-TC-014 | export_csv |
| WEB-TC-015 | export_pdf |
| WEB-TC-016 | export_pdf_popup_blocked |
| WEB-TC-017 | view_distributor_detail |
| WEB-TC-018 | view_distributor_pdf_dossier |
| WEB-TC-019 | hide_pdf_dossier_without_url |
| WEB-TC-020 | view_distributor_detail_tabs |
| WEB-TC-021 | view_raw_submission_data |
| WEB-TC-022 | close_distributor_detail |
