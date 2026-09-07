# Retail & Inventory — V2 API Requirements Audit

**Project:** FieldCommander Admin Dashboard (legacy)  
**Module:** Retail & Inventory (`/retail`) — product catalog, stock assignment to executives, stock ledgers, retail order / invoice audit  
**Audit type:** Read-only frontend → backend capability inventory  
**Date:** 2026-08-26  
**Scope rule:** Conclusions are labeled **Verified**, **Inferred**, **Mocked**, **Partial**, or **New V2**. No application source files were modified for this audit. Requested V2 product features are **not** treated as verified legacy behavior unless the UI already implements them.

---

## 1. Executive summary

### What the legacy Retail & Inventory module actually is

**Verified:** A single admin page (`RetailAdminPage`) at `/retail` with three in-page tabs — **Item Catalog**, **Stock Ledgers**, and **Retail Orders & UPI Audit** — plus two write dialogs (**Add/Edit Item**, **Assign Stock to SE**). All data access is **live Supabase** (PostgREST table CRUD + one RPC). There is **no** dedicated REST client, React Query store, typed OpenAPI schema, mock dataset, export utility, or nested routes for this module.

| Area | Legacy reality |
|---|---|
| Catalog | Full CRUD on `item_master` (`name`, `mrp`, `uom`, `is_active`). Soft-archive via `is_active`; hard delete with FK guard (`23503` → toast to inactivate). |
| Stock assignment | RPC `admin_transfer_stock(p_se_id, p_item_id, p_qty, p_batch_number)` only. Active items only in picker. |
| Stock held by executives | **No balance / on-hand summary UI.** Only chronological ledger rows (IN/OUT). |
| Ledgers | Read-only `inventory_transactions` (newest 500) with joins to `profiles` + `item_master`. Types labeled `IN` = STOCK ASSIGNED, else STOCK SOLD (OUT). |
| Invoices / orders | Read-only `retail_orders` (newest 500). Audit = open `pdf_url` and UPI `payment_proof_url`. No line items, cancel, credit note, or status workflow in admin. |
| Retailers / outlets / warehouses | **Not present** in this module. Buyers are farmers (`farmer_name` / `farmer_mobile`). |

### What V2 asks for vs what legacy does

| V2 requested capability | Legacy reality | Label |
|---|---|---|
| Admin create / view / edit / delete catalog items | Yes (delete may fail on FK; inactivate recommended) | **Verified** |
| Admin assign stock to an executive | Yes via `admin_transfer_stock` | **Verified** |
| Admin view stock held by executives | No balances; only transaction log | **New V2** (balances); ledger = **Verified** |
| Admin view stock ledgers / movement history | Yes, capped at 500 rows, no date filter | **Partial** (history exists; incomplete windowing) |
| Admin view and audit all invoices from executives | List + open PDF / UPI proof; no detail lines or audit actions beyond links | **Partial** |

### Critical engineering notes for backend

1. **Atomic stock allocation:** Assignment must stay server-side (RPC today). Admin UI does not check available warehouse stock before transfer — **Inferred** that RPC (or V2 service) owns source inventory, concurrency, and ledger `IN` insert.
2. **Sale deduction:** Admin never creates `OUT` rows or orders; **Inferred** mobile `mobile_retail` writes `retail_orders` + `inventory_transactions` OUT and PDF/proof URLs.
3. **No negative stock / duplicate txn:** Not enforced in admin UI. Must be backend (RPC / order create). Idempotency keys: **New V2** (not in admin).
4. **Price / tax / discount:** Catalog stores **MRP only**. Orders expose **`total_amount` only** — no tax, discount, or line calc in admin. Server must own invoice math if V2 adds them.
5. **Invoice numbering:** Admin displays `invoice_no`; generation **Inferred** upstream (mobile).
6. **Product deletion when referenced:** UI catches Postgres FK `23503` and directs admin to set Inactive. V2 should prefer archive (soft delete) and refuse hard delete when ledger/order refs exist.
7. **Immutable ledger + reversals:** UI is read-only on ledgers; no reverse/adjust UI. Reversals = **New V2** if needed (append-only compensating entries).
8. **Authorization:** Module `retail` `can_view` / `can_edit`; TH / Super Admin bypass. No territory or stock-owner scoping in admin queries.
9. **Audit trail:** Order “audit” = open stored URLs. No actor log for catalog edits or stock assign in UI. Structured audit = **New V2**.
10. **`src/integrations/supabase/types.ts`** is not a usable schema source; row shapes are **Inferred** from UI accessors. Local migrations do not define these tables.

---

## 2. Legacy implementation map

### 2.1 Navigation & entry

| Item | Detail | Confidence |
|---|---|---|
| Sidebar | “Retail & Inventory” → `/retail`, module `retail` | **Verified** — `AppSidebar.tsx` L45 |
| Router | `<Route path="/retail" element={guard(<RetailAdminPage />)} />` | **Verified** — `Index.tsx` L66 |
| Permission | `getModulePerm('retail')` → `{ can_view, can_edit }` | **Verified** — `RetailAdminPage.tsx` L22; `usePermissions.ts` |
| Roles matrix (web) | Module key `retail`, label “Retail & Inventory” | **Verified** — `RolesPage.tsx` L28 |
| Mobile companion perm | `mobile_retail` — “Retail & Inventory” | **Verified** — `RolesPage.tsx` L39 (admin does not call it) |
| In-page tabs | `catalog` \| `ledgers` \| `orders` (not URL routes) | **Verified** — L311–315 |

### 2.2 UI surface map

```
/retail  RetailAdminPage
├── Permission gate (can_view) → Access Denied
├── Header: Retail & Inventory
│   └── can_edit: Add New Item | Assign Stock to SE
├── Loading spinner (fetchAllData)
└── Tabs
    ├── Item Catalog
    │   ├── DataTable: name | MRP | UOM | status | edit/delete
    │   ├── Search by name; filters Status, UOM
    │   ├── Add Item dialog → insert item_master
    │   └── Edit Item dialog → update (+ is_active switch)
    ├── Stock Ledgers
    │   ├── DataTable: date | SE | product | batch | type | qty | reference
    │   ├── Search SE/product/batch; filters txn type, executive
    │   └── Read-only (limit 500 server-side)
    └── Retail Orders & UPI Audit
        ├── DataTable: invoice+date | SE | farmer | amount | payment | audit actions
        ├── Search invoice/SE/farmer/mobile; filters CASH|UPI, executive
        └── Open pdf_url / payment_proof_url in new tab
```

### 2.3 Source files (Retail core)

| File | Role |
|---|---|
| `src/pages/RetailAdminPage.tsx` | Entire module UI + all Supabase calls |
| `src/components/DataTable.tsx` | Client search, multi-filter, sort, pageSize default **10** |
| `src/hooks/usePermissions.ts` | RBAC / Super Admin / TH bypass |
| `src/hooks/useAuth.ts` | Session / `userId` |
| `src/components/AppSidebar.tsx` | Nav visibility |
| `src/pages/RolesPage.tsx` / `PermissionEditor.tsx` | Permission module registration |
| `src/pages/Index.tsx` | Route registration |
| `src/integrations/supabase/client.ts` | Supabase client |

### 2.4 Adjacent (not this module)

| Surface | Path | Relation |
|---|---|---|
| GLS product profiles (SOP) | `FarmDiaryMasters.tsx` → `master_gls_products` | Separate catalog; not `item_master` |
| Visit “Product Analysis” | `TerritoryViewSheet.tsx`, `RoutesPage.tsx` | Visit fert/pest analytics, not stock |
| Dealer “warehouse / outlet” scoring copy | `DealerDetailSheet.tsx`, Settings pages | Onboarding text only |

### 2.5 Search term coverage

| Term | Finding |
|---|---|
| product / item / catalog | **Verified** — `item_master` catalog tab |
| SKU / brand / category / pack size / tax / images | **Not found** on retail catalog |
| inventory / stock / assignment / transfer | Assign via RPC; ledger IN/OUT |
| warehouse / allocation (multi-location) | **Not found** |
| executive stock balance | **Not found** as UI |
| adjustment / return / reversal / cancellation | **Not found** in admin |
| ledger / movement | **Verified** Stock Ledgers tab |
| order / sale / invoice | **Verified** as `retail_orders` |
| retailer / outlet | **Not found** (farmer buyer fields only) |
| returns / credit note | **Not found** |
| audit | UI label “Audit Actions” = open PDF / UPI proof |
| mock / fixtures | **Not found** (live Supabase) |
| bulk import/export | **Not found** |

### 2.6 Shared / dependent modules

| Dependency | How used |
|---|---|
| **Executives (`profiles`, role `SE`, `is_demo=false`)** | Transfer target; ledger/order filter options; name joins |
| **Territories / routes** | Not used by Retail page |
| **Retailers / outlets / dealers** | Not entities on this page |
| **Farmers** | Display-only on orders |
| **Payments** | `payment_mode` CASH\|UPI + optional proof URL |
| **Taxes / reports / exports** | Not present |
| **Orders ↔ ledger** | `reference_id` shown on ledger; join to invoice **Inferred**, not opened in UI |

---

## 3. Feature-to-API matrix

Legend **Status**: Verified | Partial | Mocked | Inferred | New V2  
Legend **Backend today**: Supabase table/RPC used by frontend

| # | UI feature / user action | Status | Existing data source | Recommended V2 endpoint | Notes |
|---|---|---|---|---|---|
| R1 | Access denied without `retail.can_view` | **Verified** | `role_permissions` / admin bypass | AuthZ on all retail APIs | L276–285 |
| R2 | List catalog items | **Verified** | `item_master.select('*').order('name')` | `GET /v2/products` | Full load; client page 10 |
| R3 | Search products by name | **Verified** (client) | `name` | `q` / `search` | DataTable |
| R4 | Filter Active/Inactive, UOM | **Verified** (client) | `is_active`, `uom` | `status`, `uom` | |
| R5 | Create catalog item | **Verified** | `item_master.insert` | `POST /v2/products` | Needs `can_edit` |
| R6 | Edit catalog item (+ active toggle) | **Verified** | `item_master.update` | `PATCH /v2/products/{id}` | |
| R7 | Delete catalog item | **Verified** | `item_master.delete` | `DELETE /v2/products/{id}` or archive | FK → inactivate guidance |
| R8 | Soft-archive / inactivate | **Verified** | `is_active` on update | Prefer archive over hard delete | Copy: cannot sell/assign |
| R9 | SKU uniqueness, brand, category, tax, images | **New V2** | — | Product fields + lookups | Not in UI |
| R10 | UOM master / lookup API | **Partial** | Hardcoded select options | `GET /v2/lookups/uoms` | Bag, Bottle, Pouch, Box, Kg, Ltr |
| R11 | Bulk import/export catalog | **New V2** | — | Import/export jobs | Not present |
| R12 | Assign stock to SE | **Verified** | RPC `admin_transfer_stock` | `POST /v2/inventory/assignments` | Batch + qty required |
| R13 | View stock held by SE (balances) | **New V2** | — | `GET /v2/inventory/balances` | Not in UI |
| R14 | Inventory summary (available/allocated/sold/…) | **New V2** | — | `GET /v2/inventory/summary` | Not in UI |
| R15 | Stock by warehouse / location | **New V2** | — | Location-scoped balances | No warehouse entity |
| R16 | Transfer SE↔SE, return, adjustment, cancel | **New V2** | — | Movement APIs | Not in admin |
| R17 | List stock ledger / movements | **Verified** | `inventory_transactions` limit 500 | `GET /v2/inventory/ledger` | Server pagination + dates |
| R18 | Filter ledger by type / SE / search | **Verified** (client) | `txn_type`, profiles, batch | Query params | |
| R19 | Ledger detail / link to invoice | **Partial** | `reference_id` displayed | Embed refs / `GET …/{id}` | No click-through |
| R20 | Batch/lot on assign | **Verified** | `p_batch_number` / `batch_number` | Required on assignment | Expiry/serial **New V2** |
| R21 | Insufficient stock / concurrency on assign | **Inferred** | RPC error → toast | Structured error codes | UI shows `error.message` |
| R22 | List retail invoices/orders | **Verified** | `retail_orders` limit 500 | `GET /v2/invoices` | |
| R23 | Invoice filters (payment, SE, search) | **Verified** (client) | payment_mode, profiles, invoice/farmer | Query params | Date range **New V2** |
| R24 | Invoice detail + line items | **New V2** / **Inferred** mobile | List row only | `GET /v2/invoices/{id}` | Admin has no lines |
| R25 | Open invoice PDF | **Verified** | `pdf_url` → `window.open` | Signed download URL | |
| R26 | Open UPI payment proof | **Verified** | `payment_proof_url` when UPI | Signed download URL | |
| R27 | Cancel / return / credit note / status history | **New V2** | — | Workflow endpoints | Not in admin |
| R28 | Invoice export / reports | **New V2** | — | Export APIs | Not present |
| R29 | Territory / retailer filters on invoices | **New V2** | — | Query filters | Not in UI |
| R30 | Demo SE exclusion | **Verified** | `is_demo=false` on SE list | Server default | Ledgers/orders not re-filtered if demo slipped in |

---

## 4. Product API contracts

> Naming uses recommended REST for V2. Legacy uses Supabase PostgREST. Fields are those the frontend **actually consumes**, plus **New V2** fields clearly marked.

### 4.1 `GET /v2/products`

**Purpose:** Power Item Catalog DataTable.  
**Confidence:** **Verified** — `RetailAdminPage` `fetchAllData` L52–53, columns L162–187, filters L189–192, table L320–328.

#### Query parameters

| Param | Type | Required | Legacy behavior | V2 notes |
|---|---|---|---|---|
| `q` / `search` | string | no | Client contains on `name` | Case-insensitive |
| `status` | `active` \| `inactive` | no | Client Active/Inactive | Maps `is_active` |
| `uom` | string \| string[] | no | Client multi-select from distinct values | |
| `page` | int | no | Client `pageSize=10` | Prefer server |
| `pageSize` | int | no | 10 | |
| `sort` | string | no | Optional client sort on name/mrp/uom/status | Default `name` asc (fetch order) |
| `sku` / `categoryId` / `brandId` | — | no | — | **New V2** |

#### Existing legacy call

```text
item_master.select('*').order('name')
```

#### Response (fields consumed)

```json
{
  "items": [
    {
      "id": "uuid",
      "name": "Bioshot Extra 1Kg",
      "mrp": 499.0,
      "uom": "Bag",
      "isActive": true,
      "sku": null,
      "category": null,
      "brand": null,
      "packSize": null,
      "taxRate": null,
      "imageUrl": null
    }
  ],
  "pagination": { "page": 1, "pageSize": 10, "total": 0 }
}
```

| Field | Required by UI | Source today |
|---|---|---|
| `id` | Yes (row key, edit, delete) | `item_master.id` |
| `name` | Yes | `name` |
| `mrp` | Yes | `mrp` → `₹{toFixed(2)}` |
| `uom` | Yes | `uom` |
| `isActive` | Yes | `is_active` badge + edit switch |
| sku/brand/category/tax/images | No | **New V2** |

#### Loading / empty / error

| Case | Legacy UI | Evidence |
|---|---|---|
| Auth/perm loading | Full-screen spinner | L272–273 |
| `!can_view` | Access Denied | L276–285 |
| Data loading | Spinner `h-[40vh]` | L308–309 |
| Empty catalog | “No items in the catalog.” | L327 |
| Fetch error | Toast “Error fetching data” | L63–65 |
| Create/update missing name/mrp | Toast “Missing Fields” | L71, L92 |

#### Backend responsibilities

- Authorize `retail.can_view`
- Prefer server filter/pagination/sort
- Return only fields needed; document default `is_active` on create (**Inferred** DB default true if omitted on insert)

---

### 4.2 `POST /v2/products`

**Purpose:** Add Item to Catalog dialog.  
**Confidence:** **Verified** — L70–88, form L359–393.

#### Request

```json
{
  "name": "string",          // required
  "mrp": 0,                  // required, parseFloat from input
  "uom": "Bag"              // default Bag; enum below
}
```

| Validation (legacy UI) | Rule |
|---|---|
| `name` | Required (truthy) |
| `mrp` | Required (truthy string before parse); `type=number` input only |
| `uom` | One of Bag, Bottle, Pouch, Box, Kg, Ltr |
| MRP positivity / max decimals | **Not enforced** in UI |
| Name uniqueness / SKU | **Not enforced** in UI |

#### Response

Created product (or 201 + id). Legacy ignores returned row and calls `fetchAllData()`.

#### Auth / errors

- Requires `retail.can_edit` (button gated L296–304).
- Failure → toast “Failed to create item” + `error.message`.

---

### 4.3 `PATCH /v2/products/{id}`

**Purpose:** Edit Catalog Item dialog.  
**Confidence:** **Verified** — L91–110, form L395–437.

#### Request

```json
{
  "name": "string",
  "mrp": 0,
  "uom": "Bag",
  "isActive": true
}
```

#### Business rules (UI copy)

- “Inactive items cannot be sold or assigned.” (L427) — assignment dropdown filters `is_active` (L458–459). Sale enforcement **Inferred** on mobile/backend.
- Same required name/mrp as create.

#### Auth / errors

- Edit/delete icons only if `can_edit` (L176–185).
- Failure → toast “Update Failed”.

---

### 4.4 `DELETE /v2/products/{id}` (or archive)

**Purpose:** Trash icon with `confirm()`.  
**Confidence:** **Verified** — L113–132.

#### Behavior

| Outcome | Legacy |
|---|---|
| Success | Toast “Item Deleted”; refresh |
| FK violation `23503` | Toast: cannot delete; edit → Inactive instead |
| Other error | Toast “Delete Failed” |

#### V2 recommendation

- Prefer **archive** (`isActive=false`) as primary path.
- Hard delete only when no `inventory_transactions` / `retail_order_lines` (or equivalent) references.
- Return conflict `409 PRODUCT_IN_USE` with guidance matching legacy toast.

---

### 4.5 `GET /v2/lookups/uoms` (**Partial** / **New V2**)

**Legacy:** Hardcoded `<option>` list L378–383 / L415–420 — not loaded from API.

```text
Bag | Bottle | Pouch | Box | Kg | Ltr
```

Note: Farm Diary has a separate UOM master (`FarmDiaryMasters`) — **do not conflate** with retail UOM enum unless product explicitly unifies them.

---

### 4.6 Catalog fields **not** in legacy (New V2 candidates)

| Field | V2 note |
|---|---|
| SKU / product code + uniqueness | Not in UI |
| Category, brand | Not in UI |
| Pack size (beyond UOM) | Not in UI |
| Tax / HSN / GST | Not in UI |
| Images | Not in UI |
| Cost / wholesale vs MRP | Only MRP |
| Bulk import/export | Not in UI |

---

## 5. Inventory and assignment contracts

### 5.1 `POST /v2/inventory/assignments` (stock assign to executive)

**Purpose:** Assign Stock to Executive / Transfer Stock dialog.  
**Confidence:** **Verified** — L135–156, dialog L440–477.

#### Existing legacy call

```text
supabase.rpc('admin_transfer_stock', {
  p_se_id: string,
  p_item_id: string,
  p_qty: number,           // parseInt
  p_batch_number: string   // trim; non-empty required
})
```

#### Request (recommended V2)

```json
{
  "executiveId": "uuid",
  "productId": "uuid",
  "quantity": 10,
  "batchNumber": "BATCH-001",
  "idempotencyKey": "uuid"   // New V2 — not in legacy UI
}
```

#### Validation (legacy UI)

| Rule | Evidence |
|---|---|
| All of SE, product, qty, batch required | L136–137 |
| Batch trimmed non-empty | L136, L145 |
| Qty `parseInt` (no min>0 check in UI) | L144 |
| Product must be active (picker filter) | L458–459 |
| SE from non-demo SE list | L54, L451 |

#### Response / side effects (**Inferred**)

- Success toast “Stock Transferred Successfully”; refresh all data (ledger should show new `IN`).
- RPC body/return not used by UI.
- **Backend must:** atomically credit SE stock, write immutable ledger `IN`, refuse inactive product, prevent negative source stock, handle concurrency.

#### Errors

| Case | Legacy |
|---|---|
| Missing fields | Toast before RPC |
| RPC failure | Toast “Transfer Failed” + message |
| Insufficient stock / conflict | Not specialized — raw message (**Inferred** server) |

#### Loading

- Submit button shows spinner via `isSubmitting` (L475).

---

### 5.2 `GET /v2/inventory/balances` — stock held by executives

**Status:** **New V2** (explicit product ask; **not** in legacy UI).

#### Recommended query

| Param | Purpose |
|---|---|
| `executiveId` | Filter one SE |
| `productId` | Filter one product |
| `batchNumber` | Optional lot breakout |
| `page` / `pageSize` | Pagination |

#### Recommended response

```json
{
  "items": [
    {
      "executiveId": "uuid",
      "executiveName": "string",
      "productId": "uuid",
      "productName": "string",
      "batchNumber": "string|null",
      "onHand": 0,
      "assigned": 0,
      "sold": 0,
      "damaged": 0,
      "returned": 0,
      "pending": 0
    }
  ],
  "pagination": { "page": 1, "pageSize": 10, "total": 0 }
}
```

**Legacy derivation note:** Balances could be computed as Σ `IN` − Σ `OUT` per `(se, item, batch)` from `inventory_transactions`, but admin never shows this. Damaged/returned/pending buckets are **not** modeled in UI (`txn_type` only IN/OUT).

---

### 5.3 `GET /v2/inventory/summary` — **New V2**

Optional rollups: total SKUs active, total on-hand by SE, low-stock alerts, etc. **Not** in legacy.

---

### 5.4 Other inventory movements — **New V2**

| Movement | Legacy admin | V2 if required |
|---|---|---|
| Warehouse → SE assign | RPC only (source warehouse **opaque**) | Assignment API |
| SE → SE transfer | Not present | `POST /v2/inventory/transfers` |
| Return to warehouse | Not present | `POST /v2/inventory/returns` |
| Adjustment / damage write-off | Not present | `POST /v2/inventory/adjustments` |
| Cancel / reverse assignment | Not present | Compensating ledger entry |
| Sale OUT | **Inferred** mobile on order | Owned by invoice create |

---

### 5.5 Executive lookup for inventory UI

**Verified** shared dependency:

```text
profiles.select('id, name').eq('role','SE').eq('is_demo',false).order('name')
```

Recommend `GET /v2/executives?role=SE&includeDemo=false` (or reuse existing profiles/executives API from other modules).

---

## 6. Ledger contracts

### 6.1 `GET /v2/inventory/ledger`

**Purpose:** Stock Ledgers tab.  
**Confidence:** **Verified** — L55, columns L195–209, filters L212–215, table L332–341.

#### Existing legacy call

```text
inventory_transactions
  .select('*, profiles(name), item_master(name)')
  .order('created_at', { ascending: false })
  .limit(500)
```

#### Query parameters (recommended)

| Param | Type | Legacy | V2 notes |
|---|---|---|---|
| `txnType` | `IN` \| `OUT` | Client filter | UI labels STOCK ASSIGNED / STOCK SOLD (OUT) |
| `executiveId` | uuid | Client by **name** | Prefer id |
| `productId` | uuid | Via search text | |
| `batchNumber` | string | Search | |
| `referenceId` | string | Column only | Link to invoice/order |
| `from` / `to` | datetime | **None** | **New V2** — critical (500 cap) |
| `q` | string | SE + product + batch | |
| `page` / `pageSize` | int | Client 10 of ≤500 | Replace hard 500 |
| `sort` | string | Default created_at desc | |

#### Response item (consumed fields)

```json
{
  "id": "uuid",
  "createdAt": "ISO timestamptz",
  "executiveId": "uuid",
  "executiveName": "string",
  "productId": "uuid",
  "productName": "string",
  "batchNumber": "string|null",
  "txnType": "IN|OUT",
  "quantity": 0,
  "referenceId": "string|null",
  "referenceType": "ASSIGNMENT|INVOICE|ADJUSTMENT|null"
}
```

| UI column | Field |
|---|---|
| Date | `created_at` → `toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })` |
| Executive | `profiles.name` or “Unknown SE” |
| Product | `item_master.name` |
| Batch No. | `batch_number` or “N/A” |
| Type | `txn_type === 'IN'` → STOCK ASSIGNED else STOCK SOLD (OUT) |
| Quantity | signed display `+`/`-` + `qty` |
| Reference | `reference_id` monospace |

#### Empty / error

- Empty: “No stock transactions found.” (L340)
- Fetch errors covered by shared `fetchAllData` toast.

#### Backend responsibilities

- Append-only ledger; admin has **no** update/delete UI → treat as immutable.
- Join names server-side; authorize `retail.can_view`.
- Document meaning of `reference_id` (order id / invoice no / RPC correlation) — **Ambiguous** in frontend.
- V2: remove silent 500 truncation or expose `truncated: true`.

### 6.2 `GET /v2/inventory/ledger/{id}` — **New V2** / **Partial**

Not opened as a detail sheet today. Useful for audit deep-link to assignment or invoice.

---

## 7. Invoice / audit contracts

### 7.1 `GET /v2/invoices` (retail orders)

**Purpose:** Retail Orders & UPI Audit tab.  
**Confidence:** **Verified** — L56, columns L218–263, filters L266–268, table L345–354.

#### Existing legacy call

```text
retail_orders
  .select('*, profiles(name)')
  .order('created_at', { ascending: false })
  .limit(500)
```

#### Query parameters (recommended)

| Param | Type | Legacy | V2 notes |
|---|---|---|---|
| `q` | string | invoice_no + SE name + farmer_name + farmer_mobile | |
| `paymentMode` | `CASH` \| `UPI` | Client filter | |
| `executiveId` | uuid | Client by name | Prefer id |
| `from` / `to` | date | **None** | **New V2** |
| `invoiceNo` | string | via search | |
| `status` | enum | **None in UI** | **New V2** if lifecycle exists |
| `territoryId` / `retailerId` | uuid | **None** | **New V2** |
| `page` / `pageSize` | int | Client 10 of ≤500 | |
| `sort` | string | Default created_at desc; columns sortable client-side | |

#### Response item (consumed fields)

```json
{
  "id": "uuid",
  "invoiceNo": "string",
  "createdAt": "ISO",
  "executiveId": "uuid",
  "executiveName": "string",
  "farmerName": "string",
  "farmerMobile": "string",
  "totalAmount": 0,
  "paymentMode": "CASH|UPI",
  "pdfUrl": "string|null",
  "paymentProofUrl": "string|null",
  "currency": "INR",
  "lineItems": [],
  "discount": null,
  "tax": null,
  "paymentStatus": null,
  "outletId": null,
  "territoryId": null
}
```

| UI | Field |
|---|---|
| Invoice & Date | `invoice_no` + `created_at` date |
| Sold By (SE) | `profiles.name` |
| Farmer Details | `farmer_name`, `farmer_mobile` |
| Amount | `total_amount` prefixed `₹` (no `toFixed` in list) |
| Payment Mode | Badge `payment_mode` |
| Audit Actions | Open `pdf_url`; if UPI and proof, open `payment_proof_url` |

#### Empty / error

- Empty: “No retail orders found.” (L353)
- Missing PDF/proof: buttons simply omitted (no placeholder error).

---

### 7.2 `GET /v2/invoices/{id}` — **New V2** (admin detail)

Legacy keeps only list row in memory; **no** detail sheet, **no** line items.

Recommended detail payload for V2 audit:

```json
{
  "id": "uuid",
  "invoiceNo": "string",
  "createdAt": "ISO",
  "executive": { "id": "uuid", "name": "string" },
  "customer": { "name": "string", "mobile": "string", "type": "FARMER" },
  "paymentMode": "CASH|UPI",
  "paymentStatus": "PAID|PENDING|FAILED|null",
  "lineItems": [
    {
      "productId": "uuid",
      "productName": "string",
      "batchNumber": "string|null",
      "quantity": 0,
      "unitPrice": 0,
      "discount": 0,
      "tax": 0,
      "lineTotal": 0
    }
  ],
  "subtotal": 0,
  "discountTotal": 0,
  "taxTotal": 0,
  "totalAmount": 0,
  "documents": {
    "pdfUrl": "string|null",
    "paymentProofUrl": "string|null"
  },
  "stockMovements": [{ "ledgerId": "uuid", "txnType": "OUT", "qty": 0 }],
  "statusHistory": []
}
```

---

### 7.3 Document retrieval

| Document | Legacy | V2 |
|---|---|---|
| Invoice PDF | `window.open(pdf_url)` if set | `GET /v2/invoices/{id}/pdf` signed URL; AuthZ |
| UPI proof | `window.open(payment_proof_url)` if UPI | Signed URL; content-type image/PDF |

Admin does **not** generate PDFs or upload proofs.

---

### 7.4 Invoice mutations / workflow — **New V2**

| Action | Legacy admin |
|---|---|
| Create / edit invoice | **Not found** (mobile **Inferred**) |
| Cancel invoice | **Not found** |
| Return / credit note | **Not found** |
| Payment status change | **Not found** |
| Revision / status history | **Not found** |
| Export CSV/report | **Not found** |

If V2 adds cancel/return: must reverse or compensate stock ledger atomically and keep invoice numbering immutable.

---

### 7.5 Invoice numbering

- Display field: `invoice_no` (**Verified**).
- Generation algorithm, uniqueness, and series: **Inferred** mobile/backend — **Open question**.

---

## 8. Data models and enums

### 8.1 `item_master` (Product) — fields used in UI

| Column / field | Type (inferred) | Notes |
|---|---|---|
| `id` | uuid | PK |
| `name` | string | Required |
| `mrp` | number | Required; display 2 dp |
| `uom` | string | Enum-like hardcoded list |
| `is_active` | boolean | Status; edit toggle |

`select('*')` may return additional unused columns — **unknown** without remote schema.

### 8.2 `inventory_transactions` (Ledger)

| Column / field | Type (inferred) | Notes |
|---|---|---|
| `id` | uuid | PK / rowKey |
| `created_at` | timestamptz | Sort/display |
| `batch_number` | string \| null | |
| `txn_type` | `IN` \| `OUT` | UI maps labels |
| `qty` | number | Absolute; sign from type |
| `reference_id` | string \| null | Opaque in UI |
| FK → `profiles` | **Inferred** `se_id` | Join `profiles(name)` |
| FK → `item_master` | **Inferred** `item_id` | Join `item_master(name)` |

### 8.3 `retail_orders` (Invoice header)

| Column / field | Type (inferred) | Notes |
|---|---|---|
| `id` | uuid | rowKey |
| `invoice_no` | string | Display |
| `created_at` | timestamptz | |
| `farmer_name` | string | |
| `farmer_mobile` | string | |
| `total_amount` | number | |
| `payment_mode` | `CASH` \| `UPI` | |
| `pdf_url` | string \| null | |
| `payment_proof_url` | string \| null | |
| FK → `profiles` | **Inferred** `se_id` | Sold by |

Line-item table: **not queried** by admin — **Inferred** exists for mobile or embedded JSON unknown.

### 8.4 Enums / constants

| Name | Values | Source |
|---|---|---|
| UOM | Bag, Bottle, Pouch, Box, Kg, Ltr | Hardcoded UI |
| Product status | Active / Inactive ← `is_active` | UI |
| Ledger txn type | `IN`, `OUT` | DB + badges |
| Payment mode | `CASH`, `UPI` | Filters + badges |
| Module perms | `retail`, `mobile_retail` | RolesPage |

### 8.5 Quantity buckets (V2 vocabulary vs legacy)

| Bucket | Legacy |
|---|---|
| Available / on-hand | **Not shown** |
| Allocated to SE | Implied by cumulative `IN` |
| Sold | Implied by `OUT` / orders |
| Damaged / returned / pending | **Not found** |

---

## 9. Transaction, validation, and concurrency rules

### 9.1 Catalog

| Rule | Confidence |
|---|---|
| Create requires name + mrp | **Verified** |
| Update requires name + mrp; may set `is_active` | **Verified** |
| Inactive → excluded from assign picker | **Verified** |
| Inactive → cannot be sold | **Inferred** (UI copy; mobile must enforce) |
| Hard delete blocked when referenced | **Verified** via `23503` handling |
| Name/SKU uniqueness | **Not enforced** in admin → **New V2** if required |
| MRP ≥ 0 / decimal policy | **Not enforced** → pin in V2 |

### 9.2 Stock assignment (backend-critical)

| Rule | Confidence |
|---|---|
| Atomic credit + ledger `IN` | **Inferred** (RPC) — **must** remain atomic in V2 |
| Batch number required | **Verified** (UI) |
| Qty integer | **Verified** (`parseInt`); reject ≤0 / non-int in V2 |
| Prevent negative source stock | **Inferred** / **New V2** to document explicitly |
| Prevent assign of inactive product | **Verified** UI filter; **must** re-check server-side |
| Idempotency (double-click / retry) | UI disables via `isSubmitting` only — **Partial**; server key **New V2** |
| Concurrent assigns | Not visible — last-writer / race = **Ambiguous**; use row locks / serializable txn |
| Duplicate transaction prevention | **New V2** |

### 9.3 Sales / invoices (mobile + backend)

| Rule | Confidence |
|---|---|
| Deduct SE stock on sale; write `OUT` + order | **Inferred** |
| Price from MRP vs negotiated | **Ambiguous** (admin only sees total) |
| Tax/discount calculation | **Not in admin** — server-owned if introduced |
| Invoice number uniqueness | **Inferred** |
| PDF + proof stored as URLs | **Verified** display |
| Cancel/return stock restore | **New V2** if exposed |

### 9.4 Ledger immutability

| Rule | Confidence |
|---|---|
| Admin cannot edit/delete ledger rows | **Verified** (no UI) |
| Corrections via reversal entries | **New V2** / **Inferred** best practice |
| Historical product name on old rows | Join live `item_master(name)` — rename changes display (**Ambiguous** snapshotting) |

### 9.5 Product deletion vs history

| Situation | Expected V2 |
|---|---|
| No references | Allow hard delete **or** always soft-delete |
| Has ledger or order lines | Refuse hard delete; archive (`isActive=false`) |
| Match legacy UX | Return conflict message equivalent to L121–124 |

---

## 10. Permissions and audit requirements

### 10.1 Permissions

| Capability | Gate | Evidence |
|---|---|---|
| View page, catalog, ledgers, orders, open PDF/proof | `retail.can_view` (or TH / Super Admin) | L44–46, L276–285 |
| Add / edit / delete item; open assign dialog; transfer | `retail.can_edit` | L176, L296–304 |
| Separate export / audit-only role | **Not found** | View sees all audit links |
| Territory-scoped retail data | **Not found** | Full table reads |
| Stock-owner scoping (SE sees own stock) | Admin sees all; SE = mobile | **Inferred** |

`usePermissions.ts` L33–37: `role === 'TH'` or roles.name `Super Admin` → full view+edit.

Mobile module `mobile_retail` configures executive app capabilities; not read by this page.

### 10.2 Audit trail requirements

| Event | Legacy | V2 recommendation |
|---|---|---|
| Product create/update/delete/archive | No actor log in UI | Audit: actor, before/after, timestamp |
| Stock assignment | No actor/id beyond toast; ledger `IN` row | Ledger + audit who assigned |
| Invoice create/pay | Not in admin | Mobile actor + immutable invoice |
| PDF / proof open | Client-only navigation | Optional access log **New V2** |
| UPI audit decision (approve proof) | **No decision UI** — view only | If workflow added, store decision + actor |

**Full audit trail** for V2 should cover catalog mutations, inventory movements (with idempotency keys), invoice lifecycle, and authorization failures.

---

## 11. Missing / mocked / ambiguous behavior

| Item | Label | Detail |
|---|---|---|
| Stock balances by executive | **New V2** | Product ask; not in UI |
| Inventory summary quantities (available/allocated/sold/damaged/returned/pending) | **New V2** | Only IN/OUT ledger |
| Warehouse / location stock | **New V2** | No entity |
| SE↔SE transfer, return, adjustment, reversal | **New V2** | Assign-only |
| Invoice line items, tax, discount, payment status | **New V2** / **Ambiguous** | Header totals only |
| Invoice cancel / credit / history | **New V2** | |
| Retailer / outlet master on orders | **Not found** | Farmer fields |
| SKU, brand, category, images, pack, tax on products | **New V2** | |
| Bulk import/export / reports | **New V2** | |
| Date-range filters on ledgers/orders | **New V2** | Hard `limit(500)` only |
| Server pagination / search | **Partial** | Client DataTable |
| RPC internals (source stock, locks) | **Ambiguous** | Not in repo migrations |
| `reference_id` semantics | **Ambiguous** | Displayed raw |
| `profiles` FK column names on txn/orders | **Inferred** | Join works as `profiles(name)` |
| Whether `OUT` always means sale | **Inferred** | UI assumes STOCK SOLD |
| Mocked retail data | **Not found** | Live Supabase |
| Typed schema in repo | **Not found** | Stub `types.ts` |
| Concurrent edit of catalog / double assign | **Ambiguous** | No ETag / version |
| Currency always INR | **Inferred** | `₹` UI |
| Farm Diary `master_gls_products` vs retail catalog | Separate | Do not merge without product decision |
| PermissionEditor `retail` | Listed | Orphan vs RolesPage RBAC (**Partial** legacy dual path) |

---

## 12. V2 coverage checklist

### Product catalog

- [ ] `GET /v2/products` — search, status, uom, pagination, sort
- [ ] `POST /v2/products` — name, mrp, uom; AuthZ `can_edit`
- [ ] `PATCH /v2/products/{id}` — including `isActive`
- [ ] Soft-archive preferred; `DELETE`/`409 PRODUCT_IN_USE` parity with FK toast
- [ ] UOM lookup or documented closed enum
- [ ] Optional **New V2**: SKU uniqueness, category/brand, tax, images, bulk import/export

### Inventory & assignment

- [ ] `POST /v2/inventory/assignments` replacing `admin_transfer_stock`
- [ ] Atomic txn: balance update + immutable ledger `IN`
- [ ] Reject inactive product, qty ≤ 0, empty batch
- [ ] Insufficient-stock and concurrency error codes
- [ ] Idempotency key support
- [ ] `GET /v2/inventory/balances` — stock held by executives (**required by V2 ask**)
- [ ] Optional summary / warehouse / transfer / return / adjustment APIs

### Ledger

- [ ] `GET /v2/inventory/ledger` — type, executive, product, batch, date range, pagination
- [ ] Typed `referenceType` + link to invoice/assignment
- [ ] Append-only; reversals as new rows if needed
- [ ] No silent truncation (or explicit flag)

### Invoices / audit

- [ ] `GET /v2/invoices` — payment mode, executive, search, date range, pagination
- [ ] `GET /v2/invoices/{id}` with line items and stock movement refs
- [ ] Signed PDF + UPI proof URLs
- [ ] Invoice number uniqueness owned by backend
- [ ] Optional cancel/return/credit + status history (**New V2**)
- [ ] Optional export/report (**New V2**)

### Cross-cutting

- [ ] AuthZ `retail.can_view` / `can_edit`; document TH / Super Admin bypass
- [ ] Exclude demo SEs by default
- [ ] Audit events for catalog + assignments (+ invoice workflow if added)
- [ ] INR money precision policy
- [ ] Shared executives lookup dependency
- [ ] Document mobile `mobile_retail` as system of record for sales/OUT

---

## 13. Open questions

1. **What does `admin_transfer_stock` debit?** Central warehouse balance, unlimited supply, or another table not referenced in admin?
2. **Exact schema** of `item_master`, `inventory_transactions`, `retail_orders` (and any line/balance tables) in production Supabase?
3. **Is `reference_id` on ledger** the `retail_orders.id`, `invoice_no`, or assignment correlation id?
4. **Are ledger `OUT` rows exclusively sales**, or also returns/adjustments under the same type?
5. **Batch granularity:** Is on-hand tracked per `(se, item, batch)` or aggregated per `(se, item)`?
6. **Expiry / serial tracking** required for V2, or batch string only?
7. **Invoice creation:** Confirm mobile-only; any admin-created orders planned?
8. **Line items storage:** Separate table vs JSON on `retail_orders`?
9. **Price source at sale:** Always current MRP, snapshot at sale, or editable price?
10. **Tax / GST** in scope for V2 invoices?
11. **Payment modes** beyond CASH/UPI?
12. **UPI audit workflow:** Is viewing proof enough, or must admin approve/reject proofs?
13. **Invoice PDF:** Public URLs today? Require signed, time-limited access?
14. **Hard delete vs archive-only** product policy for V2?
15. **Should catalog unify** with Farm Diary `master_gls_products`?
16. **Territory / team scoping** for retail data in multi-region orgs?
17. **Idempotency** for assignment and sale: client key format and TTL?
18. **500-row cap:** Acceptable interim limit, or must V2 always paginate full history?
19. **Currency / timezone:** Always INR and Asia/Kolkata for ledger/invoice timestamps?
20. **Can qty be fractional** for Kg/Ltr, or always integer units?

---

## Appendix A — Legacy Supabase operations inventory

| # | Operation | File | Lines | Purpose |
|---|---|---|---|---|
| 1 | `item_master.select('*').order('name')` | `RetailAdminPage.tsx` | 53 | Catalog list |
| 2 | `profiles.select('id,name').eq(role,SE).eq(is_demo,false).order('name')` | `RetailAdminPage.tsx` | 54 | SE picker + filters |
| 3 | `inventory_transactions.select('*, profiles(name), item_master(name)').order(created_at desc).limit(500)` | `RetailAdminPage.tsx` | 55 | Ledgers |
| 4 | `retail_orders.select('*, profiles(name)').order(created_at desc).limit(500)` | `RetailAdminPage.tsx` | 56 | Orders / invoice audit |
| 5 | `item_master.insert({ name, mrp, uom })` | `RetailAdminPage.tsx` | 74–78 | Create product |
| 6 | `item_master.update({ name, mrp, uom, is_active }).eq(id)` | `RetailAdminPage.tsx` | 95–100 | Update product |
| 7 | `item_master.delete().eq(id)` | `RetailAdminPage.tsx` | 116 | Delete product |
| 8 | `rpc('admin_transfer_stock', { p_se_id, p_item_id, p_qty, p_batch_number })` | `RetailAdminPage.tsx` | 141–146 | Assign stock |

---

## Appendix B — Explicit product determinations (audit answers)

| Question | Determination |
|---|---|
| Catalog CRUD in admin? | **Yes** — create/read/update/delete (+ inactivate) |
| Assign stock to executive? | **Yes** — RPC with batch + qty |
| View stock held by executives? | **No** dedicated balances UI — **New V2** |
| View ledgers / movements? | **Yes** — IN/OUT, 500 newest, client filters |
| Audit invoices? | **Partial** — list + open PDF/UPI proof; no lines or workflow |
| Atomic allocation / no negative stock? | **Backend responsibility** (RPC/order); not in admin UI |
| Price/tax/discount calc in admin? | **No** — MRP on catalog; order total only |
| Invoice numbering? | Display only; generation **Inferred** upstream |
| Product delete with history? | FK block + inactivate guidance **Verified** |
| Immutable ledger? | Read-only in admin; reversals not exposed |
| AuthZ | Module `retail` view/edit; no territory scope |
| Full audit trail? | **Not** in legacy UI — **New V2** |
| Retailers/outlets/warehouses? | **Not** in this module |
| Exports? | **None** |
| Mocks? | **None** — live Supabase |

---

## Appendix C — Shared dependency map

```text
RetailAdminPage
├── profiles (SE, non-demo) ── assignment targets, filter labels, joins
├── item_master ── catalog CRUD + ledger product names + assign picker
├── inventory_transactions ── ledger (IN assign / OUT sale)
├── retail_orders ── invoice list + pdf_url + payment_proof_url
├── rpc admin_transfer_stock ── assignment write path
├── role_permissions / roles ── retail module ACL
└── (mobile_retail, inferred) ── order create, stock OUT, PDF/proof upload
```

Cross-module **not** wired on this page: territories, dealers/outlets, expenses, shifts, farm diary GLS products, payments module beyond URL fields.
