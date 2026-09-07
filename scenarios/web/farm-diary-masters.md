# WEB Test Scenarios — farm-diary-masters

**Module ID**: `farm-diary-masters`  
**Layer**: WEB  
**Primary sources analyzed**:
- `src/pages/FarmDiaryMasters.tsx` (single-page module; no separate table/sheet components)
- `src/hooks/useAuth.ts` / `src/hooks/usePermissions.ts`
- Cloudinary upload via `fetch` when `VITE_CLOUDINARY_CLOUD_NAME` / `VITE_CLOUDINARY_UPLOAD_PRESET` set

**UI Entry**: `/farm-diary-masters`  
**Permission module key**: `farm_diary_masters`

**Code notes**:
- Seven tabs: Crops, Stages, Products (GLS), UOMs, Parameters, SOP Builder (`layout`), SOP Groups.
- Master CRUD (crops/stages/uoms/params/products) and SOP mutate gates use `access.can_edit`. Eye / View SOP remains available with view-only.
- Crop create insert sets `status: 'Active'`. Stage create derives `stage_code` from first 3 chars of name (uppercased) — no separate code field in UI.
- GLS product name is validated with `.trim()` but payload sends `newGls.name` **without** trim. Dealer rate: empty → `null`, else `Number(dealer_rate)`.
- SOP Groups are auto-created/updated when locking stage order or saving stage SOP (no dedicated “Create Group” button).
- Assigned crops in other groups are disabled in SOP Builder / group crop picker (`isAssignedElsewhere`).

---

# Test Scenario: Farm Diary Masters — Access Gate

## Operation Overview
- **Module ID**: farm-diary-masters
- **UI Entry**: `/farm-diary-masters`
- **Primary files**: `src/pages/FarmDiaryMasters.tsx`
- **Handler / function**: `getModulePerm('farm_diary_masters')`
- **API / data ops**: via `usePermissions`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. `authLoading || permLoading` → full-screen spinner
2. `!access.can_view` → Access Denied + `You do not have permission to view Farm Diary Masters.`
3. Add/Edit/Delete/Save SOP controls gated by `access.can_edit`

## Test Cases

### Success Scenarios

#### WEB-TC-001: User with farm_diary_masters.can_view sees configuration page
- **Code Path**: permission check → main UI
- **Based On**: `FarmDiaryMasters.tsx`
- **Preconditions**: `access.can_view === true`
- **Expected UI behavior**: Title "Farm Diary Configuration"; seven tabs including SOP Builder and SOP Groups

### Business Logic Failure / Branch Scenarios

#### WEB-TC-002: Auth/perm loading shows spinner
- **Condition**: `authLoading || permLoading`
- **Expected UI behavior**: Centered spinner

#### WEB-TC-003: Missing can_view shows Access Denied
- **Condition**: `!access.can_view`
- **Expected UI behavior**: Access Denied for Farm Diary Masters

#### WEB-TC-004: can_edit false hides mutate actions
- **Condition**: `access.can_view && !access.can_edit`
- **Expected UI behavior**: No Add Crop/Stage/Product/Parameter/UOM; no Edit/Delete on master rows; SOP Builder selects/saves disabled or pointer-events-none; groups keep View SOP only

---

# Test Scenario: Farm Diary Masters — Fetch Masters

## Operation Overview
- **Module ID**: farm-diary-masters
- **UI Entry**: Page mount (`useEffect` → `fetchMasters`)
- **Primary files**: `src/pages/FarmDiaryMasters.tsx`
- **Handler / function**: `fetchMasters`
- **API / data ops**: Parallel select:
  - `master_crops` order `crop_name`
  - `master_crop_stages` order `stage_name`
  - `master_uom` order `uom_name`
  - `master_parameters` order `parameter_label`
  - `master_gls_products` order `product_name`
  - `sop_groups` order `created_at` desc
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Sets local state only when each response has `.data` (no explicit error toast on fetch failure)
2. Default `activeTab` = `'crops'`

## Test Cases

### Success Scenarios

#### WEB-TC-005: Page load populates all master lists
- **Code Path**: mount → `fetchMasters` → tabs render tables/cards
- **Based On**: `fetchMasters`
- **Expected UI behavior**: Crops/Stages/Products/UOMs/Parameters/Groups reflect returned rows
- **Expected API call**: six parallel `select('*')` queries as above

---

# Test Scenario: Farm Diary Masters — Crops CRUD

## Operation Overview
- **Module ID**: farm-diary-masters
- **UI Entry**: Crops tab → Add Crop / Edit / Delete / Eye
- **Primary files**: `src/pages/FarmDiaryMasters.tsx`
- **Handler / function**: `handleAddCrop`, `openEditCrop`, `deleteMaster('master_crops', ...)`, `handleViewCropSop`
- **API / data ops**: `master_crops` insert/update/delete; view uses `sop_crop_stages` nested select
- **Layer**: WEB

## Code Analysis

### Validations Found in Code
1. **Crop name + category** — both must `.trim()` non-empty (Source: `handleAddCrop`)
   - Implementation: `if (!newCrop.name.trim() || !newCrop.category.trim()) return toast({ title: "Error", description: "Required" ...})`

### Business Logic Found in Code
1. Insert: `{ crop_name, crop_category, status: 'Active' }`
2. Update by `id`: name + category only
3. Category UI: select existing / `CREATE_NEW` / free-text when no categories
4. Delete: confirm; remove crop from `layoutCrops`; update/delete affected `sop_groups`; then `master_crops.delete`
5. FK error toast: `Delete Blocked by Database` if message includes `foreign key constraint`
6. View SOP: opens dialog; sorts applications by DAS; error toast `Error fetching SOP`

## Test Cases

### Success Scenarios

#### WEB-TC-006: Create crop with name and category
- **Code Path**: Add Crop → Save Crop → insert
- **Based On**: `handleAddCrop`
- **Input**: name + category non-empty after trim
- **Expected API call**: `master_crops.insert([{ crop_name, crop_category, status: 'Active' }])`
- **Expected UI behavior**: Dialog closes; masters refetch

#### WEB-TC-007: Update existing crop
- **Code Path**: Edit → Save Crop
- **Based On**: `handleAddCrop` when `newCrop.id` set
- **Expected API call**: `master_crops.update({ crop_name, crop_category }).eq('id', id)`

#### WEB-TC-008: Delete crop after confirm
- **Code Path**: Trash → confirm → `deleteMaster`
- **Based On**: `deleteMaster` crop branch
- **Expected UI behavior**: Toast `"Deleted"` with name; groups cleaned or renamed; list refreshed

#### WEB-TC-009: View crop SOP opens dialog
- **Code Path**: Eye → `handleViewCropSop`
- **Expected API call**: `sop_crop_stages.select(...nested...).eq('crop_id', crop.id).order('stage_sequence')`
- **Expected UI behavior**: SOP view dialog with stages/apps/params (or empty)

### Validation Failure Scenarios

#### WEB-TC-010: Crop save blocked when name or category empty
- **Validation Rule**: both `name.trim()` and `category.trim()` required
- **Input**: blank name and/or category
- **Expected UI behavior**: Toast Error / "Required"; no insert/update

### Business Logic Failure / Branch Scenarios

#### WEB-TC-011: Delete crop blocked by FK
- **Condition**: delete throws message including `foreign key constraint`
- **Expected UI behavior**: Toast `Delete Blocked by Database`

#### WEB-TC-012: View SOP fetch error
- **Condition**: `sop_crop_stages` select returns error
- **Expected UI behavior**: Toast `Error fetching SOP` with `error.message`

---

# Test Scenario: Farm Diary Masters — Stages CRUD

## Operation Overview
- **Module ID**: farm-diary-masters
- **UI Entry**: Stages tab
- **Primary files**: `src/pages/FarmDiaryMasters.tsx`
- **Handler / function**: `handleAddStage`, `openEditStage`, `deleteMaster('master_crop_stages', ...)`
- **API / data ops**: `master_crop_stages` insert/update/delete
- **Layer**: WEB

## Code Analysis

### Validations Found in Code
1. **Stage name** — `.trim()` required (Source: `handleAddStage`)

### Business Logic Found in Code
1. Insert: `{ stage_name, stage_code: name.substring(0,3).toUpperCase() }` (code from untrimmed `name` substring)
2. Update: `stage_name` only
3. Delete clears stage from `layoutStages` / resets `activeSopStage` if matching

## Test Cases

### Success Scenarios

#### WEB-TC-013: Create stage
- **Input**: non-empty name
- **Expected API call**: insert with `stage_code` = first 3 chars uppercased
- **Expected UI behavior**: Dialog closes; list refresh

#### WEB-TC-014: Update stage name
- **Expected API call**: `master_crop_stages.update({ stage_name }).eq('id', id)`

#### WEB-TC-015: Delete stage after confirm
- **Expected UI behavior**: Removed from layout selection if present; toast Deleted; refetch

### Validation Failure Scenarios

#### WEB-TC-016: Stage save blocked when name empty
- **Validation Rule**: `!newStage.name.trim()`
- **Expected UI behavior**: Toast Error / "Required"

---

# Test Scenario: Farm Diary Masters — UOMs CRUD

## Operation Overview
- **Module ID**: farm-diary-masters
- **UI Entry**: UOMs tab
- **Handler / function**: `handleAddUom`, `openEditUom`, `deleteMaster('master_uom', ...)`
- **API / data ops**: `master_uom` insert/update/delete
- **Layer**: WEB

## Code Analysis

### Validations Found in Code
1. **Name + symbol** — both `.trim()` required

## Test Cases

### Success Scenarios

#### WEB-TC-017: Create UOM
- **Input**: name + symbol
- **Expected API call**: `master_uom.insert([{ uom_name, uom_symbol }])`

#### WEB-TC-018: Update UOM
- **Expected API call**: update name + symbol by id

#### WEB-TC-019: Delete UOM after confirm
- **Expected UI behavior**: Toast Deleted or FK blocked toast

### Validation Failure Scenarios

#### WEB-TC-020: UOM save blocked when name or symbol empty
- **Expected UI behavior**: Toast Error / "Required"

---

# Test Scenario: Farm Diary Masters — Parameters CRUD & UOM Mapping

## Operation Overview
- **Module ID**: farm-diary-masters
- **UI Entry**: Parameters tab → Add/Edit; Map UOMs for Numeric
- **Handler / function**: `handleAddParameter`, `openEditParam`, `handleAddOption`, `openUomMapping`, `saveUomMapping`, `deleteMaster('master_parameters', ...)`
- **API / data ops**: `master_parameters`; `parameter_uom_mapping` delete+insert
- **Layer**: WEB

## Code Analysis

### Validations Found in Code
1. **Label** — `.trim()` required → toast `"Label required"`
2. **Numeric + UOMs selected** — must have `defaultUom` → `"Please select a default UOM"`
3. **Dropdown options** — empty option input ignored; duplicate option toast `"This option already exists."`
4. **saveUomMapping** — same default-UOM rule when `selectedUoms.length > 0`

### Business Logic Found in Code
1. Types: Numeric | Dropdown Choice | Boolean | Textarea | Upload Image
2. `options_data` only persisted when type is `Dropdown Choice`; else `[]`
3. On update: delete all `parameter_uom_mapping` for param, then re-insert if Numeric with UOMs
4. Map UOMs dialog: replace mappings; unchecking default UOM clears `defaultUom`
5. Success toast: `"Parameter mapped and saved!"` / `"UOMs mapped successfully!"`

## Test Cases

### Success Scenarios

#### WEB-TC-021: Create Numeric parameter with UOMs and default
- **Code Path**: Add Parameter → select Numeric → pick UOMs + default → Save
- **Expected API call**: insert `master_parameters`; insert `parameter_uom_mapping` rows with `is_default_uom`
- **Expected UI behavior**: Success toast; dialog closes

#### WEB-TC-022: Create Dropdown parameter with options
- **Input**: type Dropdown Choice; options added via Add
- **Expected API call**: insert with `options_data` array

#### WEB-TC-023: Update parameter replaces UOM mappings
- **Based On**: edit path deletes mappings then re-inserts for Numeric
- **Expected UI behavior**: Success toast

#### WEB-TC-024: Save UOM mapping from Map dialog
- **Code Path**: Map UOMs → `saveUomMapping`
- **Expected API call**: delete by `parameter_id`; optional insert of selected UOMs

### Validation Failure Scenarios

#### WEB-TC-025: Parameter label empty
- **Expected UI behavior**: Toast `"Label required"`

#### WEB-TC-026: Numeric with UOMs but no default
- **Validation Rule**: `type === 'Numeric' && uoms.length > 0 && !defaultUom`
- **Expected UI behavior**: Toast `"Please select a default UOM"`

#### WEB-TC-027: Duplicate dropdown option rejected
- **Expected UI behavior**: Toast Duplicate / `"This option already exists."`

#### WEB-TC-028: Map UOMs without default when selection non-empty
- **Expected UI behavior**: Toast `"Please select a default UOM"`

### Business Logic Failure / Branch Scenarios

#### WEB-TC-029: Parameter insert API error
- **Condition**: insert returns `error`
- **Expected UI behavior**: Toast Error with `error.message`; no further mapping

---

# Test Scenario: Farm Diary Masters — GLS Products CRUD & Image Upload

## Operation Overview
- **Module ID**: farm-diary-masters
- **UI Entry**: Products tab
- **Handler / function**: `handleAddGls`, `handleProductImageUpload`, `openEditGls`, `deleteMaster('master_gls_products', ...)`
- **API / data ops**: `master_gls_products` insert/update/delete; Cloudinary `POST .../image/upload`
- **Layer**: WEB

## Code Analysis

### Validations Found in Code
1. **Product name** — `.trim()` required → `"Product name is required."`
2. **Cloudinary env** — missing cloud name or upload preset → `"Cloudinary variables are missing in the .env file."`

### Business Logic Found in Code
1. Payload: name (untrimmed), ingredients, description, benefits, impact, image_url, `uom: uom || null`, `dealer_rate: dealer_rate ? Number(dealer_rate) : null`
2. Save button disabled while `uploadingImage`
3. Dialog reset on close clears form

## Test Cases

### Success Scenarios

#### WEB-TC-030: Create GLS product
- **Input**: name non-empty after trim; optional fields
- **Expected API call**: `master_gls_products.insert([payload])`
- **Expected UI behavior**: Dialog closes; refetch

#### WEB-TC-031: Update GLS product
- **Expected API call**: update payload by id

#### WEB-TC-032: Upload product image to Cloudinary
- **Preconditions**: env vars set; file chosen
- **Expected API call**: `POST https://api.cloudinary.com/v1_1/{CLOUD}/image/upload` with `file` + `upload_preset`
- **Expected UI behavior**: Sets `image_url` to `secure_url`; toast `"Upload Success"` / `"Image attached."`

#### WEB-TC-033: Delete product after confirm
- **Expected UI behavior**: Deleted toast or FK blocked

### Validation Failure Scenarios

#### WEB-TC-034: Product name empty
- **Expected UI behavior**: Toast `"Product name is required."`

#### WEB-TC-035: Image upload without Cloudinary config
- **Condition**: `!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET`
- **Expected UI behavior**: Toast Configuration Error

### Business Logic Failure / Branch Scenarios

#### WEB-TC-036: Cloudinary upload failure
- **Condition**: `!response.ok` or thrown error
- **Expected UI behavior**: Toast `"Upload Failed"` with message

---

# Test Scenario: Farm Diary Masters — SOP Builder (Layout & Stage Order)

## Operation Overview
- **Module ID**: farm-diary-masters
- **UI Entry**: SOP Builder tab
- **Handler / function**: `toggleLayoutCrop/Stage`, `selectAllFilteredCrops`, `moveStageUp/Down`, `saveExecutionOrder`, `loadExistingSOP`
- **API / data ops**: `sop_crop_stages` upsert sequence; `sop_groups` insert/update/delete merge
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Category filter: `ALL` stored as `''`; changing category clears `layoutCrops`
2. Crops assigned to another group disabled unless already in `layoutCrops`
3. `selectAllFilteredCrops` picks unassigned (or currently selected) crops in filter
4. Spreadsheet editor shows only when `layoutCrops.length > 0 && layoutStages.length > 0`
5. `loadExistingSOP` when crops + `activeSopStage` set — loads apps/params/recommendation from first selected crop
6. `saveExecutionOrder`: requires `activeValidCrops` and `layoutStages`; else toast `"No valid crops selected. They may have been deleted."` and may clear invalid `layoutCrops`
7. Sequence = index + 1; update existing stage row or insert
8. Group name = `` `${derivedCategory}: ${namePreview}` ``; merge intersecting groups onto primary, delete extras
9. Success toast: `"Order Saved"` / `"Global stage sequence locked in."`

## Test Cases

### Success Scenarios

#### WEB-TC-037: Select crops and stages then lock global order
- **Code Path**: pick crops/stages → Lock Global Stage Order
- **Based On**: `saveExecutionOrder`
- **Expected API call**: per crop/stage upsert `sop_crop_stages.stage_sequence`; create or merge `sop_groups`
- **Expected UI behavior**: Order Saved toast; masters refetch

#### WEB-TC-038: Load existing SOP when stage tab active
- **Code Path**: select crop(s) + stage → effect → `loadExistingSOP(layoutCrops[0], activeSopStage)`
- **Expected API call**: `sop_crop_stages` maybeSingle; then apps/params by parent id
- **Expected UI behavior**: Applications, recommendation, selected params populated (or cleared if none)

#### WEB-TC-039: Select All filtered unassigned crops
- **Based On**: `selectAllFilteredCrops`
- **Expected UI behavior**: `layoutCrops` = available IDs for current category filter

#### WEB-TC-040: Reorder stages with chevrons
- **Based On**: `moveStageUp` / `moveStageDown`
- **Expected UI behavior**: Sequence list order changes locally (persisted only after Lock)

### Validation Failure Scenarios

#### WEB-TC-041: Lock order with no valid crops/stages
- **Condition**: `activeValidCrops.length === 0 || layoutStages.length === 0`
- **Expected UI behavior**: Toast `"No valid crops selected. They may have been deleted."`

### Business Logic Failure / Branch Scenarios

#### WEB-TC-042: Crop already in another SOP group cannot be newly selected
- **Condition**: `allAssignedCropIds.includes(c.id) && !layoutCrops.includes(c.id)`
- **Expected UI behavior**: Checkbox disabled; "(Assigned)" label

#### WEB-TC-043: saveExecutionOrder catch shows error toast
- **Condition**: thrown error in try
- **Expected UI behavior**: Toast Error with `e.message`

---

# Test Scenario: Farm Diary Masters — Save Active Stage SOP

## Operation Overview
- **Module ID**: farm-diary-masters
- **UI Entry**: SOP Spreadsheet Editor → Save Stage SOP
- **Handler / function**: `saveActiveStageSop`, `addApplicationRow`, `addParamRow`
- **API / data ops**: upsert `sop_crop_stages`; replace `sop_applications` + `sop_parameters`; merge `sop_groups`
- **Layer**: WEB

## Code Analysis

### Validations Found in Code
1. Valid crops + `activeSopStage` required → `"Select valid crop and stage."`
2. Every application must have DAS (`das !== '' && das !== null`) → `"DAS is required for all applications."`

### Business Logic Found in Code
1. `gls_product_id` `'NONE'` or falsy → `null`; `das` coerced with `Number(a.das)`
2. Deletes all apps/params for parent then re-inserts
3. Param inserts dedupe by `parameter_id` via Set
4. Same group merge logic as lock order
5. Success: `` `Stage SOP saved for ${n} crop(s).` ``; if single crop, reload SOP
6. `savingSop` disables save button

## Test Cases

### Success Scenarios

#### WEB-TC-044: Save stage SOP with applications and parameters
- **Code Path**: fill rows → Save
- **Based On**: `saveActiveStageSop`
- **Input**: valid crops/stage; all DAS filled
- **Expected API call**: upsert parent; delete+insert apps/params; upsert/merge groups
- **Expected UI behavior**: Success! toast; optional reload; refetch

#### WEB-TC-045: Save stage SOP with empty application list
- **Condition**: no app rows (DAS check passes); still valid crop/stage
- **Expected UI behavior**: Parent updated/created; apps/params deleted; no app insert; success toast

### Validation Failure Scenarios

#### WEB-TC-046: Save without valid crop or stage
- **Expected UI behavior**: Toast `"Select valid crop and stage."`; may clear invalid layoutCrops

#### WEB-TC-047: Save with blank DAS on any application row
- **Validation Rule**: `applications.some(a => a.das === '' || a.das === null)`
- **Expected UI behavior**: Toast `"DAS is required for all applications."`

### Business Logic Failure / Branch Scenarios

#### WEB-TC-048: Save stage SOP API failure
- **Condition**: throw / insert error
- **Expected UI behavior**: Toast `"Save Failed"` with message; `savingSop` cleared

---

# Test Scenario: Farm Diary Masters — SOP Groups

## Operation Overview
- **Module ID**: farm-diary-masters
- **UI Entry**: SOP Groups tab
- **Handler / function**: `handleViewGroupSop`, `handleEditGroupSop`, `openEditGroup`/`saveGroup`, `deleteGroup`, `cloneSopToNewCrops`
- **API / data ops**: `sop_groups` update/delete; wipe/clone `sop_crop_stages` / apps / params for crop membership changes
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Empty list copy points user to SOP Builder
2. View SOP: empty `crop_ids` → toast Empty Group; else preview via first crop with renamed display
3. Edit SOP: loads category/crops/stages into Builder tab (`activeTab = 'layout'`)
4. Manage group crops: only same-category crops; assigned-elsewhere disabled
5. `saveGroup`: wipe SOP for removed crops; clone from source crop to newly added; update `crop_ids`
6. `deleteGroup`: confirm that crops keep SOPs but grouping link removed; delete group row only
7. Clone no-ops if source has no `sop_crop_stages`

## Test Cases

### Success Scenarios

#### WEB-TC-049: View group SOP preview
- **Preconditions**: group has ≥1 crop_id resolvable to a crop
- **Expected UI behavior**: Opens SOP view titled with group name `(Preview)`

#### WEB-TC-050: Edit SOP loads builder
- **Code Path**: Edit SOP → `handleEditGroupSop`
- **Expected UI behavior**: Switches to SOP Builder; toast `"Loaded Group"`; stages/crops set

#### WEB-TC-051: Save group crop membership with add/remove
- **Code Path**: Edit group → change crops → Save Changes
- **Based On**: `saveGroup`
- **Expected UI behavior**: Optional Cleaning Up / Cloning SOP toasts; Success `"Group updated & SOP applied successfully."` or Error toast

#### WEB-TC-052: Delete group after confirm
- **Based On**: `deleteGroup`
- **Expected API call**: `sop_groups.delete().eq('id', id)`
- **Expected UI behavior**: On success, refetch (no success toast); confirm cancel aborts

### Validation Failure Scenarios

#### WEB-TC-053: View empty group
- **Condition**: `!group.crop_ids || length === 0`
- **Expected UI behavior**: Toast Empty Group / `"No crops in this group to preview."`

### Business Logic Failure / Branch Scenarios

#### WEB-TC-054: saveGroup without editingGroup
- **Condition**: `!editingGroup`
- **Expected UI behavior**: Early return; no API

#### WEB-TC-055: Group crop assigned elsewhere disabled in modal
- **Condition**: crop in `allAssignedCropIds` and not in current `groupForm.crops`
- **Expected UI behavior**: Checkbox disabled; "(Assigned)"

---

## Backend/App Mapping Hints
- WEB-TC-001 → view_farm_diary_masters
- WEB-TC-005 → list_masters (crops/stages/uom/parameters/gls/sop_groups)
- WEB-TC-006 → create_master_crop
- WEB-TC-007 → update_master_crop
- WEB-TC-008 → delete_master_crop
- WEB-TC-009 → view_crop_sop
- WEB-TC-013 → create_master_stage
- WEB-TC-014 → update_master_stage
- WEB-TC-015 → delete_master_stage
- WEB-TC-017 → create_master_uom
- WEB-TC-018 → update_master_uom
- WEB-TC-019 → delete_master_uom
- WEB-TC-021 → create_master_parameter
- WEB-TC-023 → update_master_parameter
- WEB-TC-024 → save_parameter_uom_mapping
- WEB-TC-030 → create_gls_product
- WEB-TC-031 → update_gls_product
- WEB-TC-032 → upload_gls_image_cloudinary
- WEB-TC-033 → delete_gls_product
- WEB-TC-037 → lock_sop_stage_order / upsert_sop_groups
- WEB-TC-038 → load_existing_sop
- WEB-TC-044 → save_active_stage_sop
- WEB-TC-049 → view_group_sop
- WEB-TC-050 → edit_group_sop_in_builder
- WEB-TC-051 → update_sop_group_crops
- WEB-TC-052 → delete_sop_group
