# WEB Test Scenarios — dealers

**Module ID**: `dealers`  
**Layer**: WEB  
**Primary sources analyzed**:
- `src/pages/DealersPage.tsx`
- `src/components/DealerTable.tsx`
- `src/components/DealerDetailSheet.tsx`
- `src/components/DataTable.tsx` (search/filter/sort/pagination)
- `src/hooks/useAuth.ts` / `src/hooks/usePermissions.ts`

**UI Entry**: `/dealers`  
**Permission module key**: `dealers`

**Code notes**:
- No create/delete/approve flows in this UI.
- `DealersPage` passes `onFilteredDataChange` and `canEdit` into `DealerTable`, but `DealerTable` does **not** forward them to `DataTable`. Edit still works via `canEdit` on `DealerDetailSheet`. Exports use `filteredData` set on load (not updated by table filters under current wiring).
- Draft save does **not** persist scoring/category into `draft_data`. Submitted save recomputes `total_score` / `category`. Submitted annexures update omits `seWillShareSales` (draft path includes it).

---

# Test Scenario: Dealers — Access Gate

## Operation Overview
- **Module ID**: dealers
- **UI Entry**: `/dealers`
- **Primary files**: `src/pages/DealersPage.tsx`
- **Handler / function**: `getModulePerm('dealers')`
- **API / data ops**: via `usePermissions`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. `authLoading || permLoading` → full-screen spinner
2. `!dealerAccess.can_view` → Access Denied + `You do not have permission to view the dealer directory.`
3. `can_edit` passed to detail sheet (Edit Profile)

## Test Cases

### Success Scenarios

#### WEB-TC-001: User with dealers.can_view sees Dealer Directory
- **Code Path**: permission check → main UI
- **Based On**: `DealersPage.tsx`
- **Preconditions**: `dealerAccess.can_view === true`
- **Expected UI behavior**: "Dealer Directory"; table/export when loaded

### Business Logic Failure / Branch Scenarios

#### WEB-TC-002: Auth/perm loading shows spinner
- **Condition**: `authLoading || permLoading`
- **Expected UI behavior**: Centered spinner

#### WEB-TC-003: Missing can_view shows Access Denied
- **Condition**: `!dealerAccess.can_view`
- **Expected UI behavior**: Access Denied message for dealer directory

---

# Test Scenario: Dealers — List (Submitted + Drafts)

## Operation Overview
- **Module ID**: dealers
- **UI Entry**: Directory after `can_view`
- **Primary files**: `src/pages/DealersPage.tsx`, `src/components/DealerTable.tsx`
- **Handler / function**: mount `useEffect`
- **API / data ops**:
  - `profiles.select('name').eq('role','SE')`
  - `dealers.select('*, profiles:se_id(name)').order('created_at', { ascending: false })`
  - `drafts.select('*, profiles:se_id(name)').eq('entity_type','dealer')`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Draft flattened from `draft_data` (shop/owners/location/scoring/annexures/etc.); forced `status:'DRAFT'`, `category:'—'`, `total_score:0`, `id=entity_id`
2. Combine + sort by `created_at` desc
3. Empty: `No dealers found.`
4. DRAFT badge → "Saved Draft"; APPROVED → default badge; else secondary / Pending

### Error / Edge Paths Handled in UI
1. Dealers error → toast `Failed to load` / `dealersError.message`
2. Drafts fetch has no error toast

## Test Cases

### Success Scenarios

#### WEB-TC-004: Load merges dealers and drafts
- **Code Path**: page effect → table
- **Based On**: `DealersPage.tsx` combine/sort
- **Preconditions**: `can_view`
- **Expected UI behavior**: Combined rows newest first; drafts show Saved Draft
- **Expected API call**: SE names + dealers + drafts `entity_type='dealer'`

#### WEB-TC-005: Draft defaults when draft_data incomplete
- **Based On**: draft formatter
- **Expected UI behavior**: Shop falls back to `Incomplete Dealer` (table may show `Unnamed` if null); contact/mobile/address `—` as mapped

#### WEB-TC-006: Empty list message
- **Condition**: no rows
- **Expected UI behavior**: `No dealers found.`

### Business Logic Failure / Branch Scenarios

#### WEB-TC-007: Dealers query error toast
- **Condition**: `dealersError`
- **Expected UI behavior**: Toast `Failed to load`

---

# Test Scenario: Dealers — Search, Filter, Sort

## Operation Overview
- **Module ID**: dealers
- **UI Entry**: DealerTable / DataTable
- **Primary files**: `src/components/DealerTable.tsx`
- **Handler / function**: client-side DataTable logic
- **API / data ops**: None
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Search: shop, contact, mobile, address, SE name
2. Filters: Status, Category (excludes `'—'`), Onboarded By
3. Sortable columns for shop/contact/mobile/address/SE/category/status
4. Default page size 10

## Test Cases

### Success Scenarios

#### WEB-TC-008: Search by shop/contact/mobile/address/SE
- **Based On**: `searchAccessor`
- **Expected UI behavior**: Case-insensitive includes filter

#### WEB-TC-009: Filter by Status
- **Condition**: `values.includes(row.status)`
- **Expected UI behavior**: Matching status rows only

#### WEB-TC-010: Filter by Category
- **Condition**: category filter; options exclude `'—'`
- **Expected UI behavior**: Matching categories only

#### WEB-TC-011: Filter by Onboarded By
- **Condition**: `values.includes(row.profiles?.name)`
- **Expected UI behavior**: Matching SE name rows

#### WEB-TC-012: Sort sortable columns
- **Based On**: column `sortValue`
- **Expected UI behavior**: Asc/desc reorder

---

# Test Scenario: Dealers — Export CSV / PDF

## Operation Overview
- **Module ID**: dealers
- **UI Entry**: Excel (CSV) / PDF when `!loading`
- **Primary files**: `src/pages/DealersPage.tsx`
- **Handler / function**: `handleExportExcel`, `handleExportPDF`
- **API / data ops**: None — client Blob / print window from `filteredData`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. CSV headers include Address; filename `dealers_export_${date}.csv`
2. PDF table omits Address; auto print/close; popup blocked → silent return

## Test Cases

### Success Scenarios

#### WEB-TC-013: Export CSV downloads dealers_export_<date>.csv
- **Based On**: `handleExportExcel`
- **Expected UI behavior**: CSV download from `filteredData`

#### WEB-TC-014: Export PDF opens print window
- **Based On**: `handleExportPDF`
- **Expected UI behavior**: "Dealer Directory Export" then print

### Business Logic Failure / Branch Scenarios

#### WEB-TC-015: PDF popup blocked — no toast
- **Condition**: `!printWindow`
- **Expected UI behavior**: Silent return

---

# Test Scenario: Dealers — View / Edit Visibility

## Operation Overview
- **Module ID**: dealers
- **UI Entry**: Row click → `DealerDetailSheet`
- **Primary files**: `src/components/DealerDetailSheet.tsx`
- **Handler / function**: open sheet; `canEdit` gate for Edit Profile
- **API / data ops**: Location catalog fetch when editing + state selected
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Tabs: Basic, Scoring, Business, Docs, Annexures, View
2. Edit Profile only if `!isEditing && canEdit`
3. Cancel exits edit; close resets editing
4. Conditional editors: additional locations / distributors / demo farmers / credit refs when Yes
5. State change clears city/taluka; fetches github state JSON for districts/talukas

## Test Cases

### Success Scenarios

#### WEB-TC-016: Open row shows detail sheet tabs
- **Expected UI behavior**: Sheet with shop title, status, tabs

#### WEB-TC-017: canEdit false hides Edit Profile
- **Condition**: `!canEdit`
- **Expected UI behavior**: No Edit Profile button

#### WEB-TC-018: canEdit true shows Edit Profile
- **Condition**: `canEdit`
- **Expected UI behavior**: Edit Profile visible

#### WEB-TC-019: Selecting State cascades city/taluka reset and loads districts
- **Based On**: location `useEffect` + state onChange
- **Expected UI behavior**: City/taluka cleared; districts load (or empty on fetch fail, no toast)

#### WEB-TC-020: Yes branches show nested editors
- **Conditions**: `hasAdditionalLocations` / `isLinkedToDistributor` / `willingDemoFarmers` / `seHasCreditReferences` === `'Yes'`
- **Expected UI behavior**: Corresponding add/remove UIs appear

#### WEB-TC-021: Cancel exits edit without API save
- **Expected UI behavior**: `isEditing` false; no save call

#### WEB-TC-022: View tab shows score/category/commitments snapshot
- **Based On**: TabsContent `eval`
- **Expected UI behavior**: Total Score /80, category, GLS/compliance lists or None

---

# Test Scenario: Dealers — Document Upload

## Operation Overview
- **Module ID**: dealers
- **UI Entry**: Docs tab while editing
- **Primary files**: `src/components/DealerDetailSheet.tsx`
- **Handler / function**: `handleFileUpload`
- **API / data ops**: `POST` Cloudinary `.../YOUR_CLOUD_NAME/auto/upload` with FormData file + upload_preset
- **Layer**: WEB

## Code Analysis

### Validations Found in Code
1. Requires `newDocName.trim()` and `newDocFile` — else toast Missing info
2. Button disabled when `uploadingDoc || !newDocName || !newDocFile`

## Test Cases

### Success Scenarios

#### WEB-TC-023: Successful upload attaches secure_url
- **Expected UI behavior**: Toast `Upload Success`; doc listed; inputs cleared
- **Expected API call**: Cloudinary POST FormData

### Validation Failure Scenarios

#### WEB-TC-024: Missing name or file shows Missing info
- **Validation Rule**: `!newDocName.trim() || !newDocFile`
- **Expected UI behavior**: Toast `Missing info` / `Please provide a document name and select a file.`

### Business Logic Failure / Branch Scenarios

#### WEB-TC-025: Upload failure toast
- **Condition**: no `secure_url` or fetch throws
- **Expected UI behavior**: Toast `Upload Failed` / `err.message`

---

# Test Scenario: Dealers — Save Validation

## Operation Overview
- **Module ID**: dealers
- **UI Entry**: Save Changes
- **Primary files**: `src/components/DealerDetailSheet.tsx`
- **Handler / function**: `validateForm` then `handleSave`
- **API / data ops**: Blocked until validation returns `null`
- **Layer**: WEB

## Code Analysis

### Validations Found in Code
1. Shop name trim length ≥ 2
2. Firm type required
3. Est year `/^\d{4}$/`
4. State / city / taluka / village required
5. Address trim length ≥ 5
6. Mobile `/^\d{10}$/`
7. Landline optional; if set must `/^[0-9]{3,5}[- ]?[0-9]{6,8}$/`
8. GST / PAN format regexes
9. Each bank account: all fields required; account number 9–18 digits; IFSC `/^[A-Z]{4}0[A-Z0-9]{6}$/`
10. If credit refs Yes: name required; contact if present must 10 digits
11. If security deposit `parseInt > 0`: need proof text or `documentsObj['se_payment_proof']`

**Not validated on save** (despite some UI asterisks): proposedStatus, scoring range, owners names, etc.

### Error / Edge Paths Handled in UI
1. Any failure → toast `Validation Error` + exact message; no API update

## Test Cases

### Validation Failure Scenarios

#### WEB-TC-026: Shop name too short
- **Validation Rule**: trim length &lt; 2
- **Expected UI behavior**: `Shop Name is required (Min 2 characters).`

#### WEB-TC-027: Missing firm type
- **Expected UI behavior**: `Type of Firm is required.`

#### WEB-TC-028: Invalid establishment year
- **Expected UI behavior**: `Establishment Year must be a 4-digit number.`

#### WEB-TC-029: Missing state
- **Expected UI behavior**: `State is required.`

#### WEB-TC-030: Missing city
- **Expected UI behavior**: `City/District is required.`

#### WEB-TC-031: Missing taluka
- **Expected UI behavior**: `Taluka/Tehsil is required.`

#### WEB-TC-032: Missing village
- **Expected UI behavior**: `Village is required.`

#### WEB-TC-033: Address too short
- **Expected UI behavior**: `Shop Address is required (Min 5 characters).`

#### WEB-TC-034: Mobile not 10 digits
- **Expected UI behavior**: `Mobile Number must be exactly 10 digits.`

#### WEB-TC-035: Invalid landline when provided
- **Expected UI behavior**: `Invalid Landline format.`

#### WEB-TC-036: Invalid GST
- **Expected UI behavior**: `Invalid GST format pattern.`

#### WEB-TC-037: Invalid PAN
- **Expected UI behavior**: `Invalid PAN format pattern.`

#### WEB-TC-038: Incomplete bank account fields
- **Preconditions**: ≥1 bank account
- **Expected UI behavior**: `All fields are strictly required for Bank Account N.`

#### WEB-TC-039: Invalid bank account number
- **Expected UI behavior**: `Account Number must be 9-18 digits for Bank Account N.`

#### WEB-TC-040: Invalid IFSC
- **Expected UI behavior**: `Invalid IFSC format pattern for Bank Account N.`

#### WEB-TC-041: Credit reference name required when Yes
- **Expected UI behavior**: `Name is required for Credit Reference N.`

#### WEB-TC-042: Credit reference contact must be 10 digits when set
- **Expected UI behavior**: `Contact number must be 10 digits for Reference N.`

#### WEB-TC-043: Deposit &gt; 0 without payment proof
- **Expected UI behavior**: `Payment proof (Text reference or attachment) is required for deposits matching greater than ₹0.`

---

# Test Scenario: Dealers — Save Draft

## Operation Overview
- **Module ID**: dealers
- **UI Entry**: Save when `d.status === 'DRAFT'`
- **Primary files**: `src/components/DealerDetailSheet.tsx`
- **Handler / function**: `handleSave` draft branch
- **API / data ops**: `drafts.update({ draft_data, updated_at, update_history }).or('id.eq.<id>,entity_id.eq.<id>')`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Builds flat `draft_data` (includes `seWillShareSales` boolean); no scoring/category write
2. Appends update_history `Admin Edited Profile`
3. Success → toast `Draft updated successfully.` → `onSaved` (page reload) → close
4. Error → `Failed to save draft`

## Test Cases

### Success Scenarios

#### WEB-TC-044: Valid draft save updates drafts
- **Preconditions**: `status === 'DRAFT'`; validation passes
- **Expected UI behavior**: Success toast; close; reload
- **Expected API call**: drafts update with `.or(id/entity_id)`

### Business Logic Failure / Branch Scenarios

#### WEB-TC-045: Draft save error toast
- **Condition**: update error
- **Expected UI behavior**: `Failed to save draft` / `error.message`

---

# Test Scenario: Dealers — Save Submitted

## Operation Overview
- **Module ID**: dealers
- **UI Entry**: Save when status is not `DRAFT`
- **Primary files**: `src/components/DealerDetailSheet.tsx`
- **Handler / function**: `handleSave` dealers branch
- **API / data ops**: `dealers.update({...}).eq('id', d.id)`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. `contact_person` = first owner name
2. `total_score` = sum of 8 scoring aspects
3. Category: `>60` Elite; `>=46` A-Category; `>=26` B-Category; else C-Category
4. Success → `Dealer details updated successfully.` + reload/close
5. Error → `Failed to save`

## Test Cases

### Success Scenarios

#### WEB-TC-046: Valid submitted save updates dealers
- **Preconditions**: `status !== 'DRAFT'`; validation passes
- **Expected UI behavior**: Success toast; close; reload
- **Expected API call**: `dealers.update` with shop/contact/location/scoring/total_score/category/documents/etc.

#### WEB-TC-047: Category Elite when total_score &gt; 60
- **Expected API body**: `category: 'Elite'`

#### WEB-TC-048: Category A when 46–60
- **Expected API body**: `category: 'A-Category'`

#### WEB-TC-049: Category B when 26–45
- **Expected API body**: `category: 'B-Category'`

#### WEB-TC-050: Category C when &lt; 26
- **Expected API body**: `category: 'C-Category'`

### Business Logic Failure / Branch Scenarios

#### WEB-TC-051: Submitted save error toast
- **Condition**: dealers update error
- **Expected UI behavior**: `Failed to save` / `error.message`

---

## Backend/App Mapping Hints

| WEB-TC | Operation key |
|--------|----------------|
| WEB-TC-001 | view_dealers_directory |
| WEB-TC-002 | dealers_perm_loading |
| WEB-TC-003 | deny_dealers_without_can_view |
| WEB-TC-004 | list_dealers_and_drafts |
| WEB-TC-005 | map_dealer_draft_row |
| WEB-TC-006 | list_dealers_empty |
| WEB-TC-007 | list_dealers_error |
| WEB-TC-008 | search_dealers |
| WEB-TC-009 | filter_by_status |
| WEB-TC-010 | filter_by_category |
| WEB-TC-011 | filter_by_se |
| WEB-TC-012 | sort_dealers |
| WEB-TC-013 | export_csv |
| WEB-TC-014 | export_pdf |
| WEB-TC-015 | export_pdf_popup_blocked |
| WEB-TC-016 | view_dealer_detail |
| WEB-TC-017 | hide_edit_without_can_edit |
| WEB-TC-018 | show_edit_with_can_edit |
| WEB-TC-019 | cascade_location_on_edit |
| WEB-TC-020 | branch_conditional_editors |
| WEB-TC-021 | cancel_edit |
| WEB-TC-022 | view_dealer_eval_tab |
| WEB-TC-023 | upload_dealer_document |
| WEB-TC-024 | upload_document_missing_info |
| WEB-TC-025 | upload_document_failed |
| WEB-TC-026–043 | validate_dealer_form_* |
| WEB-TC-044 | update_dealer_draft |
| WEB-TC-045 | update_dealer_draft_error |
| WEB-TC-046 | update_dealer_submitted |
| WEB-TC-047–050 | compute_dealer_category |
| WEB-TC-051 | update_dealer_submitted_error |
