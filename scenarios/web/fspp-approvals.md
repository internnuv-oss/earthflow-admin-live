# WEB Test Scenarios — fspp-approvals

**Module ID**: `fspp-approvals`  
**Layer**: WEB  
**Primary sources analyzed**:
- `src/pages/FsppApprovals.tsx`
- `src/components/FarmerDetailSheet.tsx` (opened from Eye action with `canEdit={false}`)
- `src/hooks/useAuth.ts` / `src/hooks/usePermissions.ts`

**UI Entry**: `/fspp-approvals`  
**Permission module key**: `fspp_approvals`

**Code notes**:
- Approvals update `farm_cards.fspp_approval_status` only (`APPROVED` | `REJECTED`). No create/delete farm card here.
- “Category A farmers are Auto-Approved” is **display copy only** in `CardDescription` — this page does not auto-set status for Category A.
- Detail sheet is opened with `canEdit={false}`, but Edit on profile still keys off **`getModulePerm('farmers').can_edit`** (`hasEditAccess`), not the `canEdit` prop.
- Approve/Reject buttons only when `activeTab === 'PENDING' && access.can_edit`.

---

# Test Scenario: FSPP Approvals — Access Gate

## Operation Overview
- **Module ID**: fspp-approvals
- **UI Entry**: `/fspp-approvals`
- **Primary files**: `src/pages/FsppApprovals.tsx`
- **Handler / function**: `getModulePerm('fspp_approvals')`
- **API / data ops**: via `usePermissions`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. `authLoading || permLoading` → full-screen spinner
2. `!access.can_view` → Access Denied + `You do not have permission to view FSPP Approvals.`
3. Approve/Reject require `access.can_edit` (in addition to Pending tab)

## Test Cases

### Success Scenarios

#### WEB-TC-001: User with fspp_approvals.can_view sees approvals page
- **Code Path**: permission check → main UI
- **Based On**: `FsppApprovals.tsx`
- **Preconditions**: `access.can_view === true`
- **Expected UI behavior**: "FSPP Farm Card Approvals"; date filter, smart filters, Pending/Approved/Rejected tabs

### Business Logic Failure / Branch Scenarios

#### WEB-TC-002: Auth/perm loading shows spinner
- **Condition**: `authLoading || permLoading`
- **Expected UI behavior**: Centered spinner

#### WEB-TC-003: Missing can_view shows Access Denied
- **Condition**: `!access.can_view`
- **Expected UI behavior**: Access Denied for FSPP Approvals

#### WEB-TC-004: can_edit false hides Approve/Reject on Pending
- **Condition**: `activeTab === 'PENDING' && !access.can_edit`
- **Expected UI behavior**: Eye (view) still available; no Approve/Reject buttons

---

# Test Scenario: FSPP Approvals — Fetch Farm Cards by Date

## Operation Overview
- **Module ID**: fspp-approvals
- **UI Entry**: Date range picker (defaults to current calendar month)
- **Primary files**: `src/pages/FsppApprovals.tsx`
- **Handler / function**: `fetchFarmCards` (effect on `date`)
- **API / data ops**: `farm_cards.select('id, status, fspp_approval_status, created_at, card_data, farmers(*), profiles:se_id(name)').gte('created_at', startISO).lte('created_at', endISO).order('created_at', { ascending: false })`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Default `date.from` = first day of month; `date.to` = last day of month
2. If `!date?.from` → **do not fetch** (early return)
3. If only `from` (no `to`) → end = same day as from, hours 23:59:59.999
4. From start-of-day / to end-of-day ISO bounds
5. Null `fspp_approval_status` normalized to `'PENDING'`
6. Error → toast `Error fetching farm cards` / `error.message`

## Test Cases

### Success Scenarios

#### WEB-TC-005: Initial load fetches current month farm cards
- **Code Path**: mount → default date → `fetchFarmCards`
- **Based On**: `FsppApprovals.tsx`
- **Preconditions**: `can_view`
- **Expected UI behavior**: Loading then table for current month range
- **Expected API call**: farm_cards filtered by `created_at` between month start/end

#### WEB-TC-006: Changing date range refetches
- **User steps**: Pick new from/to in calendar
- **Expected UI behavior**: Reload with new ISO bounds; description shows selected dates

#### WEB-TC-007: Single-day selection uses same day for end
- **Condition**: `date.to` undefined → `toDate = new Date(date.from)`
- **Expected UI behavior**: Fetch covers that calendar day start→end

### Business Logic Failure / Branch Scenarios

#### WEB-TC-008: Cleared date.from skips fetch
- **Condition**: `!date?.from`
- **Expected UI behavior**: No fetch; card description may show `Please select a date range.`

#### WEB-TC-009: Fetch error toast
- **Condition**: select returns error
- **Expected UI behavior**: Toast `Error fetching farm cards`; loading cleared

---

# Test Scenario: FSPP Approvals — Search & Filters

## Operation Overview
- **Module ID**: fspp-approvals
- **UI Entry**: Smart filter bar + Reset
- **Primary files**: `src/pages/FsppApprovals.tsx`
- **Handler / function**: `baseFilteredCards` client filter; `handleResetFilters`
- **API / data ops**: None (client-side on loaded `farmCards`)
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Search: farmer `full_name` includes (case-insensitive) OR `mobile` includes query
2. SE: `ALL` or exact `profiles.name`
3. Category: `ALL` or `farmers.fspp_details.category` (missing → `Uncategorized`)
4. Min land: if `minLandFilter` set, require `committedLandUnit === landUnitFilter` AND `committedLand >= parseFloat(minLandFilter)` (unit default Acres)
5. Reset: clear search/SE/category/min land; land unit → Acres; date → current month
6. Any filter/tab/date change resets `currentPage` to 1

## Test Cases

### Success Scenarios

#### WEB-TC-010: Search by farmer name or mobile
- **Based On**: `matchesSearch`
- **User steps**: Type name or mobile fragment
- **Expected UI behavior**: Rows matching name includes or mobile includes

#### WEB-TC-011: Filter by SE Name
- **Condition**: `seFilter !== 'ALL'`
- **Expected UI behavior**: Only cards for that SE name

#### WEB-TC-012: Filter by FSPP Category including Uncategorized
- **Based On**: category select values Category A–D / Uncategorized
- **Expected UI behavior**: Matching `fspp_details.category` (or Uncategorized when missing)

#### WEB-TC-013: Min committed land with unit match
- **Condition**: `farmerLandUnit === landUnitFilter && committedLand >= min`
- **User steps**: Enter min land + Acres/Bigha
- **Expected UI behavior**: Farmers with different unit excluded even if numeric land is higher

#### WEB-TC-014: Reset Filters restores defaults
- **Based On**: `handleResetFilters`
- **Expected UI behavior**: Filters cleared; date back to current month (triggers refetch)

#### WEB-TC-015: Changing filters resets pagination to page 1
- **Based On**: effect on filter deps
- **Expected UI behavior**: `currentPage` becomes 1

---

# Test Scenario: FSPP Approvals — Status Tabs & Pagination

## Operation Overview
- **Module ID**: fspp-approvals
- **UI Entry**: Pending / Approved / Rejected tabs
- **Primary files**: `src/pages/FsppApprovals.tsx`
- **Handler / function**: `tabFilteredCards` + page slice
- **API / data ops**: None
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Tab filter: `fspp_approval_status === activeTab` (`PENDING` | `APPROVED` | `REJECTED`)
2. Counts from `baseFilteredCards` (search/filters applied, before tab)
3. Empty: `No {activeTab.toLowerCase()} farm cards found matching your filters.`
4. Pagination `ITEMS_PER_PAGE = 10`
5. Table shows date, farmer, category/score, committed land, SE, actions
6. Category A styling flagged via `fspp.category === 'Category A'` (visual only)

## Test Cases

### Success Scenarios

#### WEB-TC-016: Pending tab lists PENDING cards only
- **Condition**: `activeTab === 'PENDING'`
- **Expected UI behavior**: Only pending statuses; badge count matches pending in filtered set

#### WEB-TC-017: Approved / Rejected tabs list matching statuses
- **Expected UI behavior**: Rows for APPROVED / REJECTED respectively; counts in tab labels

#### WEB-TC-018: Empty tab message
- **Condition**: `paginatedCards.length === 0`
- **Expected UI behavior**: Empty message includes active tab name

#### WEB-TC-019: Pagination previous/next
- **Preconditions**: >10 cards in tab
- **Expected UI behavior**: 10 per page; Prev/Next disabled at bounds

---

# Test Scenario: FSPP Approvals — Approve / Reject

## Operation Overview
- **Module ID**: fspp-approvals
- **UI Entry**: Approve / Reject on Pending row
- **Primary files**: `src/pages/FsppApprovals.tsx`
- **Handler / function**: `handleUpdateStatus`
- **API / data ops**: `farm_cards.update({ fspp_approval_status: newStatus }).eq('id', cardId)`
- **Layer**: WEB

## Code Analysis

### Validations Found in Code
None beyond button visibility (`PENDING` + `can_edit`).

### Business Logic Found in Code
1. Optimistic local map update on success
2. Toast success: title `Card APPROVED` or `Card REJECTED`; description `Farm card has been approved/rejected.`
3. Closes detail sheet if open (`setIsDetailsOpen(false)`)
4. Error toast: `Update Failed` / `error.message`
5. No confirm dialog before approve/reject

## Test Cases

### Success Scenarios

#### WEB-TC-020: Approve pending card
- **Code Path**: Approve → update → local state
- **Based On**: `handleUpdateStatus(cardId, 'APPROVED')`
- **Preconditions**: Pending tab; `can_edit`
- **User steps**: Click Approve
- **Expected UI behavior**: Toast `Card APPROVED`; row leaves Pending after status update; details dialog closed if open
- **Expected API call**: `farm_cards.update({ fspp_approval_status: 'APPROVED' }).eq('id', cardId)`

#### WEB-TC-021: Reject pending card
- **Code Path**: Reject → update
- **Based On**: `handleUpdateStatus(cardId, 'REJECTED')`
- **Preconditions**: Pending tab; `can_edit`
- **Expected UI behavior**: Toast `Card REJECTED`; status set REJECTED locally
- **Expected API call**: `fspp_approval_status: 'REJECTED'`

### Business Logic Failure / Branch Scenarios

#### WEB-TC-022: Update failure toast
- **Condition**: update returns error
- **Expected UI behavior**: Toast `Update Failed` / `error.message`; no local status flip

#### WEB-TC-023: Approved/Rejected tabs have no Approve/Reject actions
- **Condition**: `activeTab !== 'PENDING'`
- **Expected UI behavior**: Only Eye button in action column

---

# Test Scenario: FSPP Approvals — View Farmer Detail Sheet

## Operation Overview
- **Module ID**: fspp-approvals
- **UI Entry**: Eye icon → `FarmerDetailSheet`
- **Primary files**: `src/pages/FsppApprovals.tsx`, `src/components/FarmerDetailSheet.tsx`
- **Handler / function**: set `selectedCard` / `isDetailsOpen`; sheet uses `farmer={selectedCard.farmers}`
- **API / data ops**: Sheet may load farm_cards / diaries / observations as coded in FarmerDetailSheet
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Opens with `canEdit={false}`
2. On close: `isDetailsOpen` false then clear `selectedCard` after 300ms
3. Dashboard can open FSPP Evaluation view when `fspp_details` has keys — score, category, committed land, mindsets, knockout, etc. (read-only display)
4. Profile Edit still appears if viewer has **`farmers.can_edit`** (`hasEditAccess`)

### Permissions / Visibility
1. Intended view-only from approvals via `canEdit={false}`, but edit gate is farmers module permission

## Test Cases

### Success Scenarios

#### WEB-TC-024: Eye opens FarmerDetailSheet for card’s farmer
- **Code Path**: Eye → sheet open
- **Based On**: `FsppApprovals` + `FarmerDetailSheet`
- **User steps**: Click Eye
- **Expected UI behavior**: Sheet opens with farmer dashboard (name/status/hub cards)

#### WEB-TC-025: Navigate to FSPP Evaluation from dashboard when fspp_details present
- **Condition**: `hasFspp` (keys on `fspp_details`)
- **Expected UI behavior**: FSPP view shows score, category, committed/total land, mindset fields, knockout flag

#### WEB-TC-026: Close sheet clears selection after delay
- **Based On**: onClose timeout 300ms
- **Expected UI behavior**: Sheet closes; `selectedCard` cleared

### Business Logic Failure / Branch Scenarios

#### WEB-TC-027: Profile Edit depends on farmers.can_edit not approvals canEdit prop
- **Condition**: `view === 'profile' && hasEditAccess` where `hasEditAccess = getModulePerm('farmers').can_edit`
- **Expected UI behavior**: Edit may appear even though approvals passed `canEdit={false}`, if user has farmers edit; no Edit if farmers.can_edit false

---

## Operations Not Present in Code (no TCs)

- Auto-approve Category A on this page (copy only)
- Create/delete farm cards
- Approve/Reject from inside FarmerDetailSheet
- Changing `farm_cards.status` (only `fspp_approval_status` is updated)

---

## Backend/App Mapping Hints

| WEB-TC | Operation key |
|--------|----------------|
| WEB-TC-001 | view_fspp_approvals |
| WEB-TC-002 | fspp_approvals_loading |
| WEB-TC-003 | deny_fspp_approvals_without_can_view |
| WEB-TC-004 | hide_approve_reject_without_can_edit |
| WEB-TC-005 | list_farm_cards_by_month |
| WEB-TC-006 | refetch_farm_cards_by_date |
| WEB-TC-007 | single_day_date_range |
| WEB-TC-008 | skip_fetch_without_date_from |
| WEB-TC-009 | list_farm_cards_error |
| WEB-TC-010 | search_fspp_farmers |
| WEB-TC-011 | filter_fspp_by_se |
| WEB-TC-012 | filter_fspp_by_category |
| WEB-TC-013 | filter_fspp_by_min_land |
| WEB-TC-014 | reset_fspp_filters |
| WEB-TC-015 | reset_fspp_pagination |
| WEB-TC-016 | tab_pending_farm_cards |
| WEB-TC-017 | tab_approved_rejected_farm_cards |
| WEB-TC-018 | empty_fspp_tab |
| WEB-TC-019 | paginate_fspp_cards |
| WEB-TC-020 | approve_farm_card_fspp |
| WEB-TC-021 | reject_farm_card_fspp |
| WEB-TC-022 | update_fspp_status_error |
| WEB-TC-023 | no_actions_on_non_pending_tab |
| WEB-TC-024 | view_farmer_from_fspp_approvals |
| WEB-TC-025 | view_fspp_evaluation_in_sheet |
| WEB-TC-026 | close_farmer_detail_from_approvals |
| WEB-TC-027 | farmer_edit_gated_by_farmers_perm |
