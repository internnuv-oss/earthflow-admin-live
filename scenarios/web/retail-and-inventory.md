# WEB Test Scenarios — retail-and-inventory

**Module ID**: `retail-and-inventory`  
**Layer**: WEB  
**Primary sources analyzed**:
- `src/pages/RetailAdminPage.tsx`
- `src/components/DataTable.tsx` (search/filter/sort/pagination used by all three tabs)
- `src/hooks/useAuth.ts` / `src/hooks/usePermissions.ts`

**UI Entry**: `/retail`  
**Permission module key**: `retail`

**Code notes**:
- Three tabs: Item Catalog, Stock Ledgers, Retail Orders & UPI Audit.
- Create/Edit/Delete item + Assign Stock gated by `can_edit`. Orders/ledgers are view/audit only (open invoice/UPI proof URLs).
- Ledgers/orders fetches capped at **500** newest rows.
- Stock assign calls RPC `admin_transfer_stock` with SE, item, `parseInt(qty)`, trimmed batch.
- Transfer product dropdown lists **active items only** (`items.filter(i => i.is_active)`).
- Create validates truthy `name` and `mrp` only (no trim; UOM defaults `Bag`). Delete FK `23503` suggests inactivate instead.

---

# Test Scenario: Retail & Inventory — Access Gate

## Operation Overview
- **Module ID**: retail-and-inventory
- **UI Entry**: `/retail`
- **Primary files**: `src/pages/RetailAdminPage.tsx`
- **Handler / function**: `getModulePerm('retail')`
- **API / data ops**: via `usePermissions`
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. `authLoading || permLoading` → full-screen spinner
2. `!retailAccess.can_view` → Access Denied + `You do not have permission to view Retail & Inventory.`
3. Add New Item / Assign Stock / row Edit+Delete only when `can_edit`
4. Fetch runs when `userId && retailAccess.can_view`

## Test Cases

### Success Scenarios

#### WEB-TC-001: User with retail.can_view sees Retail & Inventory
- **Code Path**: permission check → main UI
- **Based On**: `RetailAdminPage.tsx`
- **Preconditions**: `retailAccess.can_view === true`
- **Expected UI behavior**: Title; three tabs; DataTables when loaded

### Business Logic Failure / Branch Scenarios

#### WEB-TC-002: Auth/perm loading shows spinner
- **Condition**: `authLoading || permLoading`
- **Expected UI behavior**: Centered spinner

#### WEB-TC-003: Missing can_view shows Access Denied
- **Condition**: `!retailAccess.can_view`
- **Expected UI behavior**: Access Denied for Retail & Inventory

#### WEB-TC-004: can_edit false hides mutate controls
- **Condition**: `can_view && !can_edit`
- **Expected UI behavior**: No Add New Item / Assign Stock; catalog Actions column empty; ledgers/orders still viewable

---

# Test Scenario: Retail & Inventory — Fetch All Data

## Operation Overview
- **Module ID**: retail-and-inventory
- **UI Entry**: Page mount
- **Primary files**: `src/pages/RetailAdminPage.tsx`
- **Handler / function**: `fetchAllData`
- **API / data ops**: Parallel:
  - `item_master.select('*').order('name')`
  - `profiles` SE `is_demo = false`
  - `inventory_transactions` + profiles/item_master, order created_at desc, **limit 500**
  - `retail_orders` + profiles, order created_at desc, **limit 500**
- **Layer**: WEB

## Code Analysis

### Error / Edge Paths Handled in UI
1. Catch → toast `Error fetching data` + message
2. Page-level spinner while `loading`

## Test Cases

### Success Scenarios

#### WEB-TC-005: Load catalog, executives, ledgers, orders
- **Code Path**: mount → `fetchAllData`
- **Expected UI behavior**: Catalog/Ledgers/Orders tabs show data or empty messages; loading spinner clears

### Business Logic Failure / Branch Scenarios

#### WEB-TC-006: Fetch failure toast
- **Condition**: Promise.all throws
- **Expected UI behavior**: Toast Error fetching data

---

# Test Scenario: Retail & Inventory — Item Catalog CRUD

## Operation Overview
- **Module ID**: retail-and-inventory
- **UI Entry**: Item Catalog tab; Add / Edit / Delete
- **Primary files**: `src/pages/RetailAdminPage.tsx`
- **Handler / function**: `handleCreateItem`, `handleUpdateItem`, `handleDeleteItem`
- **API / data ops**: `item_master` insert/update/delete
- **Layer**: WEB

## Code Analysis

### Validations Found in Code
1. **Create**: `!newItem.name || !newItem.mrp` → toast `Missing Fields`
2. **Update**: `!editingItem.name || !editingItem.mrp` → toast `Missing Fields`
3. **Delete**: browser `confirm`; FK error code `23503` → Cannot Delete Item (suggest Inactive)

### Business Logic Found in Code
1. Create insert: `{ name, mrp: parseFloat(mrp), uom }` — no `is_active` in payload
2. Update also sets `is_active` from Switch
3. UOM options: Bag, Bottle, Pouch, Box, Kg, Ltr
4. DataTable: search by name; filters Status Active/Inactive, UOM; sortable columns

## Test Cases

### Success Scenarios

#### WEB-TC-007: Create catalog item
- **Code Path**: Add New Item → Save Item
- **Input**: name + mrp (+ optional uom)
- **Expected API call**: `item_master.insert({ name, mrp: parseFloat(...), uom })`
- **Expected UI behavior**: Toast Item Created Successfully; modal closes; form reset; refetch

#### WEB-TC-008: Update item including Active Status
- **Code Path**: Edit → change fields/switch → Update Item
- **Expected API call**: update name, mrp parseFloat, uom, is_active by id
- **Expected UI behavior**: Toast Item Updated Successfully; modal closes

#### WEB-TC-009: Delete item after confirm
- **Preconditions**: no FK references
- **Expected UI behavior**: Toast Item Deleted; refetch

#### WEB-TC-010: Catalog search and status/UOM filters
- **Based On**: DataTable on catalog
- **Expected UI behavior**: Rows filter by name search and Status/UOM predicates

### Validation Failure Scenarios

#### WEB-TC-011: Create missing name or MRP
- **Validation Rule**: falsy name or mrp
- **Expected UI behavior**: Toast Missing Fields; no insert

#### WEB-TC-012: Update missing name or MRP
- **Expected UI behavior**: Toast Missing Fields; no update

#### WEB-TC-013: Delete cancelled on confirm
- **Condition**: user cancels confirm
- **Expected UI behavior**: No delete API call

### Business Logic Failure / Branch Scenarios

#### WEB-TC-014: Create item API error
- **Expected UI behavior**: Toast Failed to create item

#### WEB-TC-015: Update item API error
- **Expected UI behavior**: Toast Update Failed

#### WEB-TC-016: Delete blocked by FK 23503
- **Condition**: `error.code === '23503'`
- **Expected UI behavior**: Toast Cannot Delete Item with inactive guidance

#### WEB-TC-017: Delete other API error
- **Expected UI behavior**: Toast Delete Failed

---

# Test Scenario: Retail & Inventory — Assign Stock to SE

## Operation Overview
- **Module ID**: retail-and-inventory
- **UI Entry**: Assign Stock to SE modal
- **Primary files**: `src/pages/RetailAdminPage.tsx`
- **Handler / function**: `handleStockTransfer`
- **API / data ops**: `supabase.rpc('admin_transfer_stock', { p_se_id, p_item_id, p_qty: parseInt(qty,10), p_batch_number: trim })`
- **Layer**: WEB

## Code Analysis

### Validations Found in Code
1. All of se_id, item_id, qty, `batch_number.trim()` required → Missing Fields / `Please fill all fields including Batch Number.`

### Business Logic Found in Code
1. Product select: active items only
2. Success: toast Stock Transferred Successfully; reset form; refetch (ledgers update)
3. Failure: Transfer Failed + message

## Test Cases

### Success Scenarios

#### WEB-TC-018: Transfer stock to executive with batch and qty
- **Input**: SE, active item, qty, non-blank batch
- **Expected API call**: RPC `admin_transfer_stock` with parseInt qty and trimmed batch
- **Expected UI behavior**: Success toast; modal closes; data refresh

### Validation Failure Scenarios

#### WEB-TC-019: Transfer with any required field missing (incl. whitespace-only batch)
- **Validation Rule**: `!se_id || !item_id || !qty || !batch_number.trim()`
- **Expected UI behavior**: Toast Missing Fields; no RPC

### Business Logic Failure / Branch Scenarios

#### WEB-TC-020: Transfer RPC error
- **Expected UI behavior**: Toast Transfer Failed

#### WEB-TC-021: Inactive items not listed in transfer product select
- **Condition**: item `is_active === false`
- **Expected UI behavior**: Option absent from Choose Product list

---

# Test Scenario: Retail & Inventory — Stock Ledgers Tab

## Operation Overview
- **Module ID**: retail-and-inventory
- **UI Entry**: Stock Ledgers tab
- **Primary files**: `RetailAdminPage.tsx` + `DataTable`
- **Handler / function**: display of `ledgers` from fetch
- **API / data ops**: already loaded `inventory_transactions` (limit 500)
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Type badge: `IN` → STOCK ASSIGNED (+qty); else STOCK SOLD (OUT) (−qty)
2. Filters: txn_type IN/OUT; Executive by profile name
3. Search: executive + product + batch
4. Empty: `No stock transactions found.`
5. No edit/approve of ledger rows in UI

## Test Cases

### Success Scenarios

#### WEB-TC-022: View ledger rows with IN/OUT badges
- **Expected UI behavior**: Date/SE/product/batch/type/qty/reference columns render

#### WEB-TC-023: Filter ledgers by type and executive; search batch
- **Expected UI behavior**: DataTable filters/search narrow rows

---

# Test Scenario: Retail & Inventory — Retail Orders & UPI Audit

## Operation Overview
- **Module ID**: retail-and-inventory
- **UI Entry**: Retail Orders & UPI Audit tab
- **Primary files**: `RetailAdminPage.tsx` + `DataTable`
- **Handler / function**: order column actions (`window.open`)
- **API / data ops**: loaded `retail_orders` (limit 500); no status update in this UI
- **Layer**: WEB

## Code Analysis

### Business Logic Found in Code
1. Columns: invoice_no + date, SE, farmer name/mobile, total_amount, payment_mode badge
2. If `pdf_url` → Invoice button opens URL
3. If `payment_mode === 'UPI' && payment_proof_url` → UPI Proof button
4. Filters: CASH/UPI; Executive name
5. Search: invoice, SE, farmer name, mobile
6. Empty: `No retail orders found.`

## Test Cases

### Success Scenarios

#### WEB-TC-024: View orders list with payment badges
- **Expected UI behavior**: Order rows; CASH/UPI styling

#### WEB-TC-025: Open invoice PDF when pdf_url present
- **User steps**: Click Invoice
- **Expected UI behavior**: `window.open(pdf_url, '_blank')`

#### WEB-TC-026: Open UPI proof when UPI and proof URL present
- **User steps**: Click UPI Proof
- **Expected UI behavior**: Opens `payment_proof_url` in new tab

#### WEB-TC-027: Filter/search orders
- **Expected UI behavior**: Payment mode / SE filters and search apply via DataTable

### Business Logic Failure / Branch Scenarios

#### WEB-TC-028: No Invoice button without pdf_url
- **Condition**: falsy `pdf_url`
- **Expected UI behavior**: Invoice control not rendered

#### WEB-TC-029: No UPI Proof for CASH or missing proof URL
- **Condition**: not (`UPI` and `payment_proof_url`)
- **Expected UI behavior**: UPI Proof button absent

---

## Backend/App Mapping Hints
- WEB-TC-001 → view_retail
- WEB-TC-005 → list_item_master_ledgers_orders
- WEB-TC-007 → create_item_master
- WEB-TC-008 → update_item_master
- WEB-TC-009 → delete_item_master
- WEB-TC-018 → admin_transfer_stock
- WEB-TC-022 → list_inventory_transactions
- WEB-TC-024 → list_retail_orders
- WEB-TC-025 → open_retail_invoice
- WEB-TC-026 → open_upi_payment_proof
