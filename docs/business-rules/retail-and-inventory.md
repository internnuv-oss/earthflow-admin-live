# Business Rules — Retail & Inventory

**Source system:** Field Commander Admin (`earthflow-admin-live`)  
**Module:** Retail & Inventory  
**Related routes / keys:** `/retail`, permission `retail`; mobile catalog key `mobile_retail`  
**Primary source:** `src/pages/RetailAdminPage.tsx`  
**Remote DB function used:** `admin_transfer_stock` (RPC; body **not** in this repository)

This document describes **business behavior** for Retail & Inventory as implemented in the reference project. It is not a redesign.

Legend:

- **Confirmed** — directly supported by implementation  
- **Implementation Detail** — how the old app encodes the rule  
- **Unconfirmed** — not proven here  
- **`UNCONFIRMED — likely implemented outside this admin repository`** — mobile / RPC / remote DB  

---

## 1. Module Purpose

### Confirmed

Admin page **“Retail & Inventory”** — “Manage catalog, distribute stock, and audit retail payments.”

Three tabs:

| Tab | Purpose |
|---|---|
| **Item Catalog** | CRUD for `item_master` (create/edit/delete; active/inactive) |
| **Stock Ledgers** | Read-only view of `inventory_transactions` (latest 500) |
| **Retail Orders & UPI Audit** | Read-only view of `retail_orders` (latest 500); open invoice PDF / UPI proof |

Admin **assigns stock to SEs** via transfer modal. Admin does **not** create retail sales/orders or record STOCK SOLD (OUT) in this UI.

---

## 2. Item Master Entity

### Confirmed — fields used

| Field | Role |
|---|---|
| `id` | PK |
| `name` | Product name |
| `mrp` | Numeric MRP (₹) |
| `uom` | Unit of measure string |
| `is_active` | Active / Inactive flag |

No SKU/code field in create/edit forms. No local migration for `item_master` in the checked migration file.

---

## 3. Product / Item Creation Rules

### Confirmed — who can create

Users with `retail.can_edit` (button “Add New Item”).

### Confirmed — required / optional

| Field | Required in UI? | Default |
|---|---|---|
| Product Name | Yes (`!newItem.name`) | — |
| MRP (₹) | Yes (`!newItem.mrp`) | — |
| Unit of Measure | Optional (always sent) | `'Bag'` |

Toast on missing name/MRP: “Missing Fields”.

### Confirmed — insert payload

```
{ name, mrp: parseFloat(mrp), uom }
```

`is_active` is **not** set on insert → DB default applies (**Unconfirmed** value; UI later shows Active/Inactive from returned rows).

### Confirmed — uniqueness

**No** client-side uniqueness check on name. Server unique constraints: **Unconfirmed** (errors would surface as toast message).

---

## 4. Item Update Rules

### Confirmed

Edit requires `retail.can_edit`. Updates:

```
{ name, mrp: parseFloat(mrp), uom, is_active }
```

Name and MRP required (same Missing Fields toast).

---

## 5. Active / Inactive Behavior

### Confirmed UI copy (Edit modal)

> “Inactive items cannot be sold or assigned.”

### Confirmed admin enforcement for assignment

Stock transfer product dropdown lists **only** `items.filter(i => i.is_active)`.

### Unconfirmed

Whether `admin_transfer_stock` or mobile sale APIs also reject inactive items (UI copy asserts they cannot be sold — **not verified** in admin sale code because sales are not implemented here).

Inactive items remain visible in catalog (filterable) and may still appear historically in ledgers/orders by name join.

---

## 6. MRP / UOM Rules

### Confirmed — MRP

- Catalog display: `₹{mrp.toFixed(2)}`  
- Stored as float from form  
- **No** admin rule that retail order line price must equal MRP  
- Whether order `total_amount` uses MRP: **`UNCONFIRMED — likely implemented outside this admin repository`**

### Confirmed — UOM options (hard-coded)

`Bag`, `Bottle`, `Pouch`, `Box`, `Kg`, `Ltr`

This list is **independent** of Farm Diary `master_uom`. Free-text UOMs already in DB still display/filter.

No conversion math between UOMs in this module.

---

## 7. Stock Transfer / Assignment to SE

### Confirmed — who

`retail.can_edit` → “Assign Stock to SE”.

### Confirmed — required fields

| Field | Required |
|---|---|
| Executive (`se_id`) | Yes |
| Product (`item_id`) | Yes (active only in picker) |
| Batch Number | Yes (non-empty after `trim`) |
| Quantity | Yes |

Toast: “Please fill all fields including Batch Number.”

### Confirmed — execution

Calls Supabase RPC:

```
admin_transfer_stock({
  p_se_id,
  p_item_id,
  p_qty: parseInt(qty, 10),
  p_batch_number: trimmed
})
```

Quantity is **integer** (`parseInt`). Fractional qty not supported by this form.

### Confirmed — SE picker

Non-demo SEs only: `profiles.role = 'SE'`, `is_demo = false`.

### Implementation Detail

Success refreshes all data (items, ledgers, orders). Failure shows RPC error message.

### Unconfirmed — RPC internals (`admin_transfer_stock`)

Not present in local migrations/source. Unknown:

- Whether it inserts `inventory_transactions` with `txn_type = 'IN'`  
- Central warehouse vs “create stock from nothing”  
- Negative / insufficient central stock checks  
- Validation of inactive items  
- Generation of `reference_id`  
- Idempotency / duplicate batch rules  

Mark: **`UNCONFIRMED — likely implemented outside this admin repository`** (Postgres function).

---

## 8. Inventory Transactions / Ledger

### Confirmed — read model

Admin loads:

```
inventory_transactions
  select *, profiles(name), item_master(name)
  order created_at desc
  limit 500
```

### Confirmed — fields displayed

| Field | Display |
|---|---|
| `created_at` | Date/time (en-IN) |
| `profiles.name` | Executive |
| `item_master.name` | Product |
| `batch_number` | Batch No. (or N/A) |
| `txn_type` | `IN` → badge **STOCK ASSIGNED**; else **STOCK SOLD (OUT)** |
| `qty` | Prefixed `+` for IN, `-` for OUT |
| `reference_id` | “Reference” monospace |

### Confirmed — transaction type vocabulary in UI

| `txn_type` | Label |
|---|---|
| `IN` | Stock Assigned (IN) |
| `OUT` (any non-IN treated as sold) | Stock Sold (OUT) |

Admin **never inserts** ledger rows directly in this page (only via RPC for transfers).

### Confirmed — balance derivation in admin

**None.** No running balance, no per-SE stock summary, no “current stock” column. Ledger is an event list only.

How SE available stock is computed for sales: **`UNCONFIRMED — likely implemented outside this admin repository`**.

### Confirmed — filters / search

- Type: IN / OUT  
- Executive by name  
- Search: SE name, product name, batch  

---

## 9. IN / OUT Behavior (Admin Perspective)

### Confirmed

| Direction | Created in admin UI? | Typical meaning in labels |
|---|---|---|
| IN | Via `admin_transfer_stock` (presumed) | Stock assigned to SE |
| OUT | **No** | Stock sold |

**`UNCONFIRMED — likely implemented outside this admin repository`:** OUT rows written when retail order completes; order of operations (order first vs stock first); insufficient stock handling; negative stock allowance; manual adjustments.

---

## 10. Batch Number Rules

### Confirmed

- Mandatory on **admin stock transfer**  
- Shown on ledger rows  
- Searchable  

Uniqueness / reuse of same batch across SEs/items: **Unconfirmed** (RPC).

---

## 11. Item Delete / Referential Protection

### Confirmed

Delete requires confirm dialog. Direct `item_master.delete`.

If Postgres FK error **`23503`**:

> Cannot Delete Item — This item has already been assigned to executives or sold. Please EDIT it and toggle the status to "Inactive" instead.

Otherwise show generic delete failure.

### Confirmed business rule

Items referenced by inventory (and/or related FKs) **must not** be hard-deleted; deactivate instead.

Which tables FK to `item_master`: **Unconfirmed** beyond this error handling (likely `inventory_transactions` at minimum).

---

## 12. Retail Order Entity

### Confirmed — fields used in audit UI

| Field | Role |
|---|---|
| `id` | Row key |
| `invoice_no` | Invoice identifier |
| `created_at` | Order date |
| `profiles` via join | Sold By (SE) — implies `se_id` or similar FK to profiles |
| `farmer_name` | Denormalized farmer name |
| `farmer_mobile` | Denormalized mobile |
| `total_amount` | Order total (₹) |
| `payment_mode` | `CASH` or `UPI` (filter options) |
| `pdf_url` | Optional invoice PDF |
| `payment_proof_url` | Shown for UPI when present |

### Confirmed — farmer relationship

**Denormalized** name/mobile on the order. No `farmers` table join in this page. Whether `farmer_id` exists unused: **Unconfirmed**.

### Confirmed — SE relationship

Joined `profiles(name)` on the order (sold-by executive).

---

## 13. Retail Order Creation / Lifecycle

### Confirmed in admin

- **No create**  
- **No edit** of amount/payment/status  
- **No cancel / refund**  
- **No status field** displayed (no Pending/Completed vocabulary in UI)  

Orders are **audit/read-only**.

**`UNCONFIRMED — likely implemented outside this admin repository`:** creating orders, deducting stock OUT, generating `invoice_no` / `pdf_url` / payment proof, line items, discounts/taxes.

---

## 14. Payment Modes

### Confirmed

| Mode | UI |
|---|---|
| `CASH` | Amber badge |
| `UPI` | Green badge; if `payment_proof_url` → “UPI Proof” button opens URL |

Filter options only CASH and UPI.

Other modes: would display as raw string if present but are not in filter list.

---

## 15. Pricing / Amount / Discounts / Taxes

### Confirmed

- Admin displays `total_amount` as stored  
- **No** line-item breakdown in admin  
- **No** discount/tax fields in admin UI  
- **No** recalculation from MRP × qty in admin  

Whether MRP is transaction price vs reference: **Unconfirmed** (outside).

---

## 16. Stock Availability / Insufficient Stock

### Confirmed in admin

Not implemented (no pre-check before transfer beyond form fill; RPC may reject).

Sale-time insufficient stock: **outside**.

Negative stock: **Unconfirmed**.

Manual stock adjustment UI: **not present** (only transfer RPC).

---

## 17. Audit Behavior

### Confirmed

“Audit Actions” column:

1. **Invoice** — open `pdf_url` if set  
2. **UPI Proof** — open `payment_proof_url` if UPI and URL set  

No separate audit log table; no admin notes on orders. Catalog/ledger/order lists are the audit trail for admins.

Ledger `reference_id` may correlate to order/invoice externally — **Unconfirmed** format.

---

## 18. Export Behavior

### Confirmed

**No** CSV/PDF export on RetailAdminPage.

---

## 19. Permissions

### Confirmed

| Permission | Effect |
|---|---|
| `retail.can_view` | Access page; Access Denied otherwise |
| `retail.can_edit` | Add item, Assign stock, Edit/Delete item actions |

View-only users can browse all three tabs and open invoice/UPI links.

---

## 20. Data Ownership / Scoping

### Confirmed

- Global catalog  
- Transfers to any non-demo SE  
- Ledgers/orders for all SEs (last 500 each) — **not** filtered to exclude demo in ledger query itself (demo SEs just not in transfer picker; historical demo rows could appear if present)  

---

## 21. Search / Filter Summary

| Tab | Filters | Search |
|---|---|---|
| Catalog | Active/Inactive, UOM | Product name |
| Ledgers | IN/OUT, Executive | SE, product, batch |
| Orders | CASH/UPI, Executive | Invoice, SE, farmer name/mobile |

---

## 22. Edge Cases

### Confirmed

1. Ledgers/orders capped at **500** newest — older history not shown without changing query.  
2. Create item does not send `is_active` — depends on DB default.  
3. Transfer qty `parseInt` truncates decimals.  
4. Inactive excluded from transfer list only; edit can still open inactive items.  
5. Delete blocked by FK with guidance to deactivate.  
6. OUT badge label applied to any `txn_type !== 'IN'`.  
7. No linkage UI between a retail order and its OUT ledger row(s).  

---

## 23. Lifecycle Answer Sheet

| Question | Answer from this repo |
|---|---|
| Who creates an item? | Admin with `retail.can_edit` |
| Required fields? | Name, MRP; UOM defaults Bag |
| Name/SKU unique? | Not enforced in UI |
| Inactive in transactions? | Cannot assign via admin picker; sale rule asserted in copy only |
| How is stock added? | `admin_transfer_stock` RPC (IN presumed) |
| Transfer identity? | SE + item + qty + batch → RPC |
| Batch mandatory? | Yes for admin transfer |
| How is IN recorded? | Via RPC (details outside) |
| How is OUT recorded? | Outside admin |
| Current balance? | Not calculated in admin |
| Negative stock? | Unconfirmed |
| Insufficient stock? | Unconfirmed (RPC/mobile) |
| Manual adjust? | Only transfer RPC |
| Delete with ledger refs? | Blocked (23503) → use Inactive |
| Orders affect inventory? | Not in admin code; OUT rows imply yes externally |
| Order before/after stock? | Unconfirmed |
| Order/payment states? | No status workflow; payment_mode CASH/UPI |
| UPI audit? | Optional `payment_proof_url` + invoice PDF |
| Farmer on order? | `farmer_name`, `farmer_mobile` |
| SE on order? | Profile join |
| Cancel/refund? | Not in admin |
| Totals? | Stored `total_amount` |
| MRP = sale price? | Unconfirmed |
| Discounts/taxes? | Not in admin |
| Admin vs mobile? | Admin: catalog + transfer + audit; Mobile: sales/OUT (**outside**) |

---

## 24. Cross-Module Effects

| Module | Interaction |
|---|---|
| Sales Executives / Profiles | Transfer targets; sold-by on orders; ledger SE |
| Farmers | Soft fields on orders only (no FK usage here) |
| Farm Diary UOM masters | **Not** shared |
| Dealers/Distributors | None in this page |
| Shifts/Attendance/Expenses | None |

---

## 25. Calculations / Derived Values

### Confirmed in admin

None beyond display formatting (`mrp.toFixed(2)`, qty ± prefix). No stock balance formula in UI.

---

## 26. Rules a New Stack Must Preserve

1. Item catalog with name, MRP, UOM, `is_active`.  
2. Soft-deactivate instead of delete when inventory references exist.  
3. Admin stock assignment requires SE, active item, batch number, integer qty.  
4. Ledger visibility of IN (assigned) vs OUT (sold) with batch and reference.  
5. Retail orders as audit of SE sales with farmer name/mobile, total, CASH/UPI, invoice/proof URLs.  
6. Separate admin vs field-app responsibilities: catalog/transfer/audit vs order creation/stock OUT.  
7. Demo SEs excluded from transfer picker (`is_demo = false`).  
8. Document or reimplement `admin_transfer_stock` semantics explicitly in the new stack.  

---

## 27. Important Unresolved / Conflicting Rules

1. **`admin_transfer_stock` body missing** — core stock-IN rules unknown.  
2. **Inactive “cannot be sold”** — UI copy vs unproven mobile/RPC enforcement.  
3. **No stock balance** in admin — operational truth lives elsewhere.  
4. **Order↔OUT linkage** not shown; `reference_id` meaning unknown.  
5. **MRP vs sale price**, discounts, taxes, line items unknown.  
6. **500-row cap** may hide history.  
7. Create-item **`is_active` default** unknown.  
8. Whether farmer must exist in `farmers` table unknown.  

---

## 28. Cross-Module Dependencies

**Depends on:** `item_master`, `inventory_transactions`, `retail_orders`, `profiles`, Permissions, RPC `admin_transfer_stock`.  

**Related docs:** `sales-executives.md`, `roles-and-access.md`, `docs/module-inventory.md`.

---

## 29. Evidence / Source Index

| Concern | Source |
|---|---|
| Entire admin retail UX & rules | `src/pages/RetailAdminPage.tsx` |
| Route / permission key | `Index.tsx`, `AppSidebar.tsx`, `RolesPage.tsx` |
| Phase 0 notes | `docs/module-inventory.md` |

---

## 30. Rules That Appear to Live Outside This Repository

1. Function `admin_transfer_stock` implementation  
2. Creating `retail_orders` and payment proof / invoice PDFs  
3. Writing `inventory_transactions` OUT (and possibly IN details)  
4. Stock balance / insufficient stock / negative stock policy  
5. Sale pricing from MRP, discounts, taxes, line items  
6. Order cancellation/refund  
7. Enforcing inactive items at sale time  
8. Linking order id to ledger `reference_id`  

Mark: **`UNCONFIRMED — likely implemented outside this admin repository`**.

---

*End of Retail & Inventory business rules extraction.*
