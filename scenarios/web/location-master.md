# WEB Test Scenarios — location-master

**Module ID**: `location-master`  
**Layer**: WEB  
**Primary sources analyzed**:
- `src/pages/LocationMasterPage.tsx`
- `src/hooks/useAuth.ts` / `src/hooks/usePermissions.ts` (access gates)
- `src/components/AppLayout.tsx` (shell)

**UI Entry**: `/locations`  
**Permission module key**: `locations`

**Code notes**:
- Hierarchy is District → Taluka → Village via `districts` / `talukas` / `villages` tables.
- Access Denied UI shows title only (no descriptive paragraph).
- District/taluka/village list fetches do **not** toast on query errors (`if (data)` only).
- Village rows are not selectable (`onClick={() => {}}`).

---

# Test Scenario: Location Master — Access Gate

## Operation Overview
- **Module ID**: location-master
- **UI Entry**: `/locations`
- **Primary files**: `src/pages/LocationMasterPage.tsx`
- **Handler / function**: `getModulePerm('locations')`
- **API / data ops**: via `usePermissions`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. `authLoading || permLoading` → full-screen spinner
2. `!locAccess.can_view` → Access Denied (Shield + "Access Denied")
3. `fetchDistricts` runs when `locAccess.can_view`
4. Add / Edit / Delete controls only when `locAccess.can_edit`

### Permissions / Visibility
1. `can_view` — page + district list load
2. `can_edit` — Add buttons, edit/delete icons; taluka Add needs active district; village Add needs active taluka

## Test Cases

### Success Scenarios

#### WEB-TC-001: User with locations.can_view sees Location Master
- **Code Path**: permission check → main layout → fetchDistricts
- **Based On**: `LocationMasterPage.tsx`
- **Preconditions**: `locAccess.can_view === true`
- **User steps**: Open `/locations`
- **Expected UI behavior**: "Location Master" heading; 3-column Districts/Talukas/Villages UI

### Business Logic Failure / Branch Scenarios

#### WEB-TC-002: Auth/perm loading shows spinner
- **Condition**: `authLoading || permLoading`
- **Expected UI behavior**: Centered spinner; no master UI yet

#### WEB-TC-003: Missing can_view shows Access Denied
- **Condition**: `!locAccess.can_view`
- **Expected UI behavior**: Access Denied; no district fetch from the can_view effect

#### WEB-TC-004: can_edit false hides Add/Edit/Delete controls
- **Condition**: `can_view` true, `can_edit` false
- **Expected UI behavior**: No Add buttons; list items without Edit/Trash icons; selection still works

#### WEB-TC-005: can_edit true shows district Add
- **Condition**: `locAccess.can_edit`
- **Expected UI behavior**: Districts column "Add" button visible

---

# Test Scenario: Location Master — List Districts

## Operation Overview
- **Module ID**: location-master
- **UI Entry**: Column 1 after `can_view`
- **Primary files**: `src/pages/LocationMasterPage.tsx`
- **Handler / function**: `fetchDistricts`
- **API / data ops**: `from('districts').select('*').order('name')`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. `loadingInitial` spinner in districts column
2. Empty: `No districts added yet.`
3. Items ordered by `name`

### Error / Edge Paths Handled in UI
1. No destructive toast if select fails (only sets data when `data` truthy)

## Test Cases

### Success Scenarios

#### WEB-TC-006: Successful load lists districts by name
- **Code Path**: `can_view` → `fetchDistricts` → list
- **Based On**: `fetchDistricts`
- **Preconditions**: `can_view`
- **Expected UI behavior**: District names listed alphabetically by `name` order
- **Expected API call**: `districts.select('*').order('name')`

#### WEB-TC-007: Empty districts message
- **Condition**: `districts.length === 0` after load
- **Expected UI behavior**: `No districts added yet.`

#### WEB-TC-008: Initial loading spinner in districts column
- **Condition**: `loadingInitial` true
- **Expected UI behavior**: Spinner inside Districts scroll area

---

# Test Scenario: Location Master — Cascade Select Talukas / Villages

## Operation Overview
- **Module ID**: location-master
- **UI Entry**: Click district / taluka rows
- **Primary files**: `src/pages/LocationMasterPage.tsx`
- **Handler / function**: `handleSelectDistrict`, `handleSelectTaluka`
- **API / data ops**:
  - `talukas.select('*').eq('district_id', dist.id).order('name')`
  - `villages.select('*').eq('taluka_id', tal.id).order('name')`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Select district: set active; clear active taluka + villages; load talukas
2. Select taluka: set active; load villages
3. Without district: talukas show `Select a district first.`
4. Empty talukas: `No talukas found.`
5. Without taluka: villages show `Select a taluka first.`
6. Empty villages: `No villages found.`
7. Headers show active parent name in parentheses when set
8. Active district/taluka get highlight styles

## Test Cases

### Success Scenarios

#### WEB-TC-009: Selecting district loads talukas and clears villages
- **Code Path**: district click → `handleSelectDistrict`
- **Based On**: `LocationMasterPage.tsx`
- **User steps**: Click a district
- **Expected UI behavior**: District highlighted; taluka list loads for that district; active taluka cleared; villages emptied; header shows district name
- **Expected API call**: `talukas.select('*').eq('district_id', <id>).order('name')`

#### WEB-TC-010: Selecting taluka loads villages
- **Code Path**: taluka click → `handleSelectTaluka`
- **User steps**: With district selected, click a taluka
- **Expected UI behavior**: Taluka highlighted; villages list for that taluka; header shows taluka name
- **Expected API call**: `villages.select('*').eq('taluka_id', <id>).order('name')`

#### WEB-TC-011: Talukas placeholder before district selection
- **Condition**: `!activeDistrict`
- **Expected UI behavior**: `Select a district first.`

#### WEB-TC-012: Villages placeholder before taluka selection
- **Condition**: `!activeTaluka`
- **Expected UI behavior**: `Select a taluka first.`

#### WEB-TC-013: Empty child lists show found-empty messages
- **Condition**: district selected with zero talukas / taluka with zero villages
- **Expected UI behavior**: `No talukas found.` / `No villages found.`

#### WEB-TC-014: Taluka Add only when can_edit and district active
- **Condition**: `locAccess.can_edit && activeDistrict`
- **Expected UI behavior**: Talukas "Add" visible; hidden if no district

#### WEB-TC-015: Village Add only when can_edit and taluka active
- **Condition**: `locAccess.can_edit && activeTaluka`
- **Expected UI behavior**: Villages "Add" visible; hidden if no taluka

---

# Test Scenario: Location Master — Create / Update Location

## Operation Overview
- **Module ID**: location-master
- **UI Entry**: Add or Edit → Save dialog
- **Primary files**: `src/pages/LocationMasterPage.tsx`
- **Handler / function**: `openModal`, `handleSave`
- **API / data ops**:
  - Create: `from(table).insert([payload])`
  - Update: `from(table).update(payload).eq('id', editItem.id)`
  - Tables: `districts` | `talukas` | `villages`
- **Layer**: WEB

## Code Analysis

### Validations Found in Code
1. **Name required**: `if (!itemName.trim()) return;` + Input `required`
2. No other format/uniqueness checks in UI

### Business Logic Found in Code
1. Payload always `{ name: itemName.trim() }`
2. Taluka create/update adds `district_id: activeDistrict.id`
3. Village create/update adds `taluka_id: activeTaluka.id`
4. Modal title: `Add|Edit {modalType}` (capitalize class)
5. Context text for taluka/village shows parent name
6. Success toast: `Success` / `${modalType} saved successfully.`
7. Refresh: district → `fetchDistricts`; taluka → reselect district; village → reselect taluka
8. Cancel closes modal

### Error / Edge Paths Handled in UI
1. Save error — toast `Error saving location` / `error.message`

## Test Cases

### Success Scenarios

#### WEB-TC-016: Create district with name
- **Code Path**: Add district → Save → insert → refresh
- **Based On**: `handleSave` insert, `modalType === 'district'`
- **Preconditions**: `can_edit`; non-empty trimmed name
- **User steps**: Districts Add → enter name → Save
- **Input / payload**: `{ name: trimmed }`
- **Expected UI behavior**: Toast `${modalType} saved successfully.` (district); modal closes; districts refresh
- **Expected API call**: `districts.insert([{ name }])`

#### WEB-TC-017: Create taluka under active district
- **Preconditions**: `activeDistrict` set; `can_edit`
- **User steps**: Talukas Add → name → Save
- **Input / payload**: `{ name, district_id: activeDistrict.id }`
- **Expected API call**: `talukas.insert([payload])`; then `handleSelectDistrict(activeDistrict)`

#### WEB-TC-018: Create village under active taluka
- **Preconditions**: `activeTaluka` set; `can_edit`
- **User steps**: Villages Add → name → Save
- **Input / payload**: `{ name, taluka_id: activeTaluka.id }`
- **Expected API call**: `villages.insert([payload])`; then `handleSelectTaluka(activeTaluka)`

#### WEB-TC-019: Edit existing location updates name
- **Code Path**: Edit icon → change name → Save
- **Based On**: `editItem` truthy update branch
- **Preconditions**: `can_edit`
- **User steps**: Click Edit on item → change name → Save
- **Expected UI behavior**: Success toast; modal closes; correct column refreshed
- **Expected API call**: `from(table).update(payload).eq('id', editItem.id)`

#### WEB-TC-020: Cancel closes modal without save
- **User steps**: Open modal → Cancel
- **Expected UI behavior**: Modal closes; no insert/update from cancel

### Validation Failure Scenarios

#### WEB-TC-021: Blank name blocks save
- **Validation Rule**: `!itemName.trim()` early return; Input `required`
- **Input**: empty / whitespace-only name
- **Expected UI behavior**: Browser required and/or handler return; no successful save toast

### Business Logic Failure / Branch Scenarios

#### WEB-TC-022: Save API error toast
- **Condition**: insert/update returns `error`
- **Expected UI behavior**: Toast `Error saving location` / `error.message`; modal may remain open

---

# Test Scenario: Location Master — Delete Location

## Operation Overview
- **Module ID**: location-master
- **UI Entry**: Trash icon on list item (`can_edit`)
- **Primary files**: `src/pages/LocationMasterPage.tsx`
- **Handler / function**: `handleDelete`
- **API / data ops**: `from(table).delete().eq('id', id)` for districts/talukas/villages
- **Layer**: WEB

## Code Analysis

### Validations Found in Code
1. `window.confirm(\`Are you sure you want to delete ${name}? This will also delete all data inside it.\`)` — cancel aborts

### Business Logic Found in Code
1. `e.stopPropagation()` so delete does not select row
2. Success toast: `Deleted` / `${name} has been removed.`
3. After district delete: refresh districts; if deleted was active, clear district/taluka/villages state
4. After taluka delete: re-fetch talukas for active district; if deleted was active, clear taluka/villages
5. After village delete: re-fetch villages for active taluka

### Error / Edge Paths Handled in UI
1. Delete error — toast `Error deleting` / `error.message`

## Test Cases

### Success Scenarios

#### WEB-TC-023: Confirm delete district removes and clears active children if needed
- **Code Path**: Trash → confirm → delete → refresh
- **Based On**: `handleDelete` district branch
- **Preconditions**: `can_edit`
- **User steps**: Delete a district → OK confirm
- **Expected UI behavior**: Confirm text includes name and cascade warning; toast `Deleted`; districts refreshed; if it was active, talukas/villages cleared
- **Expected API call**: `districts.delete().eq('id', id)`

#### WEB-TC-024: Confirm delete taluka refreshes taluka column
- **Preconditions**: district active; `can_edit`
- **Expected API call**: `talukas.delete().eq('id', id)` then reselect district
- **Expected UI behavior**: If deleted taluka was active, villages cleared

#### WEB-TC-025: Confirm delete village refreshes village column
- **Preconditions**: taluka active; `can_edit`
- **Expected API call**: `villages.delete().eq('id', id)` then reselect taluka
- **Expected UI behavior**: Toast Deleted; villages list refreshed

### Business Logic Failure / Branch Scenarios

#### WEB-TC-026: Cancel confirm does not delete
- **Condition**: `confirm` returns false
- **Expected UI behavior**: No delete API call

#### WEB-TC-027: Delete API error toast
- **Condition**: delete returns `error`
- **Expected UI behavior**: Toast `Error deleting` / `error.message`

#### WEB-TC-028: Delete button click does not select parent row
- **Condition**: `e.stopPropagation()` on delete handler
- **Expected UI behavior**: Clicking trash does not trigger district/taluka selection side effects beyond delete flow

---

## Backend/App Mapping Hints

| WEB-TC | Operation key |
|--------|----------------|
| WEB-TC-001 | view_location_master |
| WEB-TC-002 | location_master_loading |
| WEB-TC-003 | deny_locations_without_can_view |
| WEB-TC-004 | hide_location_mutations_without_can_edit |
| WEB-TC-005 | show_add_district |
| WEB-TC-006 | list_districts |
| WEB-TC-007 | list_districts_empty |
| WEB-TC-008 | districts_loading |
| WEB-TC-009 | select_district_load_talukas |
| WEB-TC-010 | select_taluka_load_villages |
| WEB-TC-011 | talukas_need_district |
| WEB-TC-012 | villages_need_taluka |
| WEB-TC-013 | empty_child_lists |
| WEB-TC-014 | show_add_taluka |
| WEB-TC-015 | show_add_village |
| WEB-TC-016 | create_district |
| WEB-TC-017 | create_taluka |
| WEB-TC-018 | create_village |
| WEB-TC-019 | update_location |
| WEB-TC-020 | cancel_location_modal |
| WEB-TC-021 | validate_location_name_required |
| WEB-TC-022 | save_location_error |
| WEB-TC-023 | delete_district |
| WEB-TC-024 | delete_taluka |
| WEB-TC-025 | delete_village |
| WEB-TC-026 | delete_location_cancel |
| WEB-TC-027 | delete_location_error |
| WEB-TC-028 | delete_stop_propagation |
