# Business Rules — Sales Executives

**Source system:** Field Commander Admin (`earthflow-admin-live`)  
**Module:** Sales Executives (SE)  
**Related routes / keys:** `/sales-executives`, permission module `sales_executives`  
**Primary sources:** `src/pages/SEsPage.tsx`, `src/components/SETable.tsx`, `src/components/SEDetailSheet.tsx`, `supabase/functions/create-se/index.ts`, plus all modules that filter or relate entities by `se_id` / `role = 'SE'`

This document describes **business behavior** for Sales Executives as implemented in the reference project. It is not a redesign.

Legend:

- **Confirmed** — directly supported by implementation  
- **Implementation Detail** — how the old app encodes the rule  
- **Unconfirmed** — referenced or suspected but not provable from this repository  

---

## 1. Module Purpose

### Confirmed

Sales Executives are **field onboarding agents** who operate primarily on the **mobile application**. This admin module lets authorized web staff:

1. **Register** new SE accounts (Auth credentials + profile + optional mobile role)  
2. **List / search** all profiles with legacy role `SE`  
3. **View** SE profile extension data (personal, organization, financial/assets, documents)  
4. **Toggle Demo SE** flag used to exclude demo accounts from many operational reports  
5. See **network counts** (dealers, farmers, distributors) linked to that SE  

Copy in UI: “Manage onboarding agents in your territory.” Creation success: “They can now log into the mobile app.”

### Confirmed non-goals of this admin module

- Completing SE onboarding profile data (read-only in admin)  
- Editing SE personal/org/financial JSON from admin (no save forms)  
- Deleting or deactivating SE accounts (no UI/API calls found)  
- Changing an SE’s mobile role after creation (no reassignment UI found)

---

## 2. Actors / Roles

| Actor | Relationship to this module |
|---|---|
| **Web admin / staff** with `sales_executives` view/edit | Uses `/sales-executives` |
| **Sales Executive (`profiles.role = 'SE'`)** | The entity managed; mobile user; **blocked from web admin shell** |
| **Roles & Access** | Supplies Mobile/Both roles assignable at SE creation |
| **Super Admin / TH** | Inherit full module access via permission bypass (see Roles & Access rules) |

### Confirmed — SE cannot use Field Commander Admin web UI

If display role is `SE` **or** resolved platform is `Mobile`, `AppLayout` denies web access (“Mobile App Only” / Earthflow Mobile Application).

Evidence: `src/components/AppLayout.tsx`.

---

## 3. Sales Executive Entity and Important Fields

### Confirmed composite model

An SE is **not** only the `sales_executive` table. In this app an SE is:

1. A row in **`profiles`** with `role = 'SE'`  
2. Optionally extended by **`sales_executive`** keyed by `profile_id` (1:1 in migration)  
3. Backed by a **Supabase Auth user** whose id is used as `profiles.id` when created via `create-se`

### Confirmed `profiles` fields used for SEs

| Field | Role |
|---|---|
| `id` | Primary key; Auth user id after `create-se` |
| `name` | Display name (built from first + last name on create) |
| `mobile` | Login identity basis; used to re-find profile for `role_id` update |
| `email` | Real contact email on profile (may differ from Auth email) |
| `role` | Must be `'SE'` for directory listing |
| `role_id` | Optional FK to dynamic `roles` (mobile permissions) |
| `is_demo` | Demo account flag |
| `created_at` | “Joined” date in directory |

### Confirmed `sales_executive` fields (migration + admin reads)

| Field | Role |
|---|---|
| `profile_id` | PK / FK → `profiles.id` |
| `is_profile_complete` | Boolean; default `false` in migration |
| `personal_details` | JSON object (admin displays as key/value) |
| `organization_details` | JSON object |
| `financial_details` | JSON object; may contain nested `insurances` (shown separately) |
| `assets_details` | JSON object |
| `documents` | JSON object (“Uploaded Documents”) |
| `created_at` | Row timestamp |

### Implementation Detail — early migration comment vs current create path

Local migration comment says profiles are “NOT linked to auth.users — admin can create SE rows freely.” Current `create-se` **does** create an Auth user and then updates `profiles` by Auth user id. Actual production profile-creation trigger is **Unconfirmed** (comment in edge function: “DB trigger might have auto-copied the synthetic … email”).

### Unconfirmed

- Exact JSON schemas inside personal/organization/financial/assets/documents  
- When `sales_executive` row is inserted (trigger on Auth signup vs mobile first login)  
- Whether `profiles.id` always equals `auth.users.id` for all historical SEs  

---

## 4. Creation / Provisioning Rules

### Confirmed trigger

Creating an SE requires module permission **`sales_executives.can_edit`**. Without edit, “Add New SE” is hidden.

### Confirmed create form fields

| Field | Required in UI | Sent to backend | Notes |
|---|---|---|---|
| First Name | Yes | Yes (as part of `name`) | |
| Last Name | No | Yes if provided (part of `name`) | |
| Date of Birth (DD-MM-YYYY) | No | **No** | Collected in form state only; **never sent** to `create-se` |
| Mobile Number | Yes | Yes | `maxLength={10}`; placeholder “10-digit number”; **no exact-10-digit validation** in handler |
| Email Address | No | Yes (may be empty string trimmed) | Optional real email |
| Assigned Mobile Role | Labeled `*` | Conditionally | Only if `selectedRoleId` set |
| Temporary Password | Yes | Yes | HTML `minLength={6}` |

### Confirmed create handler validation

Fails with “Please fill all required fields” if any of these empty after trim:

- `firstName`  
- `mobile`  
- `password`  

Does **not** require last name, email, DOB, or `selectedRoleId`.

### Confirmed conflict — Mobile Role “required”

UI label: “Assigned Mobile Role *” and Select has `required`, but `handleCreate` does **not** validate `selectedRoleId`. An SE can be created **without** a dynamic role link.

### Confirmed provisioning sequence

1. Invoke edge function `create-se` with:
   - `name` = trimmed `"${firstName} ${lastName}"`  
   - `mobile`, `email`, `password`  
   - `role: 'SE'`  
2. On success, if `selectedRoleId` present:  
   `UPDATE profiles SET role_id = selectedRoleId WHERE mobile = <trimmed mobile>`  
3. Toast success; reload directory.  

### Implementation Detail

- Role list for picker: `roles` where `platform IN ('Mobile','Both')`, ordered by name; fetched only when `can_edit`.  
- Form reset clears name/dob/mobile/email/password but **does not clear `selectedRoleId`** in code.  
- Profile matching for `role_id` update is by **mobile string**, not by returned Auth user id (fragile if duplicate mobiles exist).

### Unconfirmed

- Uniqueness enforcement on mobile / Auth email  
- What happens if `role_id` update matches zero or multiple profiles  
- Whether DOB was ever intended for Auth metadata or `personal_details`  

---

## 5. Authentication / Account Rules

### Confirmed (`create-se` for `role = 'SE'`)

1. Auth login email is **forced** to: `{mobile}@gmail.com` (mobile trimmed).  
2. Password is the temporary password supplied by admin.  
3. Auth user is created with `email_confirm: true` (immediately usable).  
4. Auth `user_metadata` stores: `name`, `mobile`, `role` (`SE`), `real_email` (optional).  
5. If a real email was provided, after Auth create the function updates `profiles.email` to that real email for the new user id (so profile contact email ≠ Auth email).  
6. Default `payload.role` in the function is `'SE'` if omitted.

### Confirmed contrast — non-SE use of same function

When Team Management creates web users with `role: 'CO'`, Auth email must be the real email (not mobile@gmail.com). That path is outside SE module but shares the function.

### Confirmed login implication for SEs

SEs authenticate to the **mobile app** using the synthetic email pattern (and password). Web admin login as SE is blocked by `AppLayout` even if credentials work in Auth.

### Unconfirmed

- Exact mobile login UX (email field vs mobile field) in the mobile app  
- Password change / reset flows  
- Whether profiles without Auth users can still exist historically  

---

## 6. Role / Platform Assignment

### Confirmed

1. Legacy role on create is always **`SE`**.  
2. Dynamic role (optional) must be from platforms **`Mobile` or `Both`**.  
3. Platform resolution for an SE without dynamic role: `useAuth` falls back platform to **`Mobile`** when legacy role is `SE`.  
4. Mobile module permissions for that SE come from `role_permissions` of the assigned `role_id` (enforcement in mobile app is **Unconfirmed**).

### Confirmed — no post-create role edit in this module

Admin SE UI does not offer changing `role_id` later.

---

## 7. Required / Optional Conditions (Summary)

### Confirmed at create time

**Required (enforced in handler):** first name, mobile, password.  
**Optional:** last name, DOB (unused), email, mobile role.  
**Password:** at least 6 characters (HTML constraint).  
**Mobile:** max 10 characters input; exact digit rules not enforced in handler (unlike Team Management’s exact-10 check).

---

## 8. Validation Rules

### Confirmed

| Rule | Where |
|---|---|
| First name, mobile, password required | `handleCreate` |
| Password min length 6 | Input attribute |
| Mobile max length 10 | Input attribute |
| Email type=email when entered | Input attribute only |
| Module `can_view` required to load list | Page gate |
| Module `can_edit` required to create / toggle demo | UI |

### Confirmed not validated in this module

- Mobile exactly 10 digits  
- Mobile numeric-only  
- Unique mobile  
- Role selection  
- DOB format  

---

## 9. Profile Completion Rules

### Confirmed

1. Profile completion is represented by `sales_executive.is_profile_complete`.  
2. Directory shows **Complete** vs **Pending**.  
3. Detail sheet shows **Profile Complete** vs **Profile Incomplete**.  
4. Dashboard KPI “SE Profiles Complete” counts `sales_executive` rows where `is_profile_complete = true`.  
5. Description on Dashboard: “Finished mobile onboarding”.  
6. **No code in this repository writes `is_profile_complete` or the JSON detail blobs** for SEs (admin only reads them).

### Confirmed display of incomplete / missing extension

If `sales_executive` join is missing/null, completion is treated as incomplete (`!!undefined` → Pending / Incomplete), and detail sections render empty JSON viewers.

### Unconfirmed

- Exact mobile rules that set `is_profile_complete = true`  
- Which fields inside JSON are mandatory for completion  
- Whether a `sales_executive` row is always created at Auth signup  

---

## 10. Demo SE Behavior

### Confirmed definition

`profiles.is_demo` boolean (nullable in practice). UI treats truthy as Demo.

### Confirmed toggle rules

1. Visible as “Demo SE?” switch in directory.  
2. Toggle allowed only when `can_edit`; otherwise switch disabled.  
3. Persists via `UPDATE profiles SET is_demo = <new> WHERE id = …`.  
4. Optimistic UI update; reverts on error.  
5. Toasts: “Marked as Demo” / “Marked as Real SE” with “Your reports will update automatically.”  
6. Demo badge “Demo Account” on name cell when `is_demo` truthy.

### Confirmed business intent

Demo SEs should be **excluded from operational reporting / filters** in several modules so demo activity does not pollute attendance, expenses, shifts, routes, retail, farm diary filters.

### Confirmed conflict — inconsistent demo exclusion filters

Different modules use **different** predicates:

| Pattern | Meaning for `is_demo` | Modules |
|---|---|---|
| `.eq('is_demo', false)` | Only explicit `false`; **excludes `null`** | Attendance (SE list), Shifts (SE list + shift query), Retail (SE list) |
| `.or('is_demo.eq.false,is_demo.is.null')` | Includes non-demo and unset | Routes (SE list), Expenses (SE list), Farm Diary (SE filter list) |
| **No demo filter** | Demo SEs included | SE directory itself, Dashboard SE counts, Farmers/Dealers/Distributors/FPOs SE filters, Route Builder SE picker |

### Confirmed expenses secondary filter

Expenses loads a “real SE” list with the inclusive null-or-false pattern, then client-filters expense rows to those whose `se_id` is in that list (drops expenses belonging to demo / unknown SEs when list is non-empty).

### Implementation Detail

Shifts query uses `profiles!inner` + `profiles.is_demo = false`, so shifts for SEs with `is_demo = null` are also excluded from the shifts list.

---

## 11. Status / State Behavior

### Confirmed states visible in admin

| Concept | Values | Source |
|---|---|---|
| Profile completion | Complete / Pending (Incomplete) | `sales_executive.is_profile_complete` |
| Demo flag | Demo / Real | `profiles.is_demo` |
| Auth usability | Created confirmed | `email_confirm: true` on create |

No separate SE lifecycle status such as Active/Inactive/Suspended is implemented in this admin app.

---

## 12. Edit / Update Rules

### Confirmed updates supported in admin SE module

1. **Create** new SE (provisioning).  
2. **Toggle `is_demo`**.  
3. **Set `role_id` once** immediately after create (optional).  
4. **Set `profiles.email` to real email** inside `create-se` when provided.

### Confirmed “Edit” vs actual editability

- With `can_edit`, action button label is **Edit**; without, **View**.  
- Both open `SEDetailSheet`.  
- Sheet is **read-only** (JSON viewers). `canEdit` only controls a footer message: “Viewing Mode: You don't have authorization to edit this agent.”  
- **No save/update of personal/organization/financial/documents from admin.**

### Unconfirmed

Whether mobile app allows SE self-edit of profile sections after creation.

---

## 13. Delete / Deactivation Rules

### Confirmed

No delete, deactivate, suspend, or archive SE workflow exists in this repository’s SE admin UI or related calls.

### Unconfirmed

Manual DB/Auth deletion practices outside the app.

---

## 14. Permissions

### Confirmed module key

`sales_executives` (Roles catalog label: “Sales Executives Directory”).

| Permission | Effect |
|---|---|
| `can_view = false` | Access Denied; list not loaded |
| `can_view = true` | List + open detail (View) |
| `can_edit = true` | Add New SE; enable Demo switch; action button says Edit |
| Admin bypass (TH / Super Admin) | Full view+edit |

### Confirmed — create uses elevated edge function

`create-se` runs with service role on the server; caller passes Bearer token. Caller authorization beyond “has session” is **Unconfirmed** inside the function.

---

## 15. Visibility / Directory Rules

### Confirmed listing query

```
profiles
  where role = 'SE'
  order by created_at desc
  select: id, name, mobile, email, role, created_at, is_demo,
          sales_executive(is_profile_complete, personal_details, organization_details,
                          financial_details, assets_details, documents)
```

- Includes demo and non-demo.  
- Does not filter by territory, creator, or completeness.

### Confirmed search (directory)

Client search over concatenated `name`, `mobile`, `email` (DataTable search).

### Confirmed sort columns

Name, Profile Status (complete flag), Joined date.

### Confirmed detail visibility

Anyone with view can open the sheet and see profile JSON + network counts (dealers/farmers/distributors from submitted tables only — not drafts, not FPOs).

---

## 16. Relationships with Other Modules

### Confirmed ownership pattern

Field entities commonly store **`se_id` → `profiles.id`** for the onboarding SE.

| Related entity / table | Relationship | Notes |
|---|---|---|
| `dealers` | `se_id` | Counted in SE detail; filter “Onboarded By” includes all SEs (no demo filter) |
| `farmers` | `se_id` | Same |
| `distributors` | `se_id` | Same |
| `fpos` | `se_id` | Filter includes all SEs; **not** in SE detail KPI counts |
| `drafts` | `se_id` | Drafts for farmer/dealer/distributor/fpo tied to SE |
| `routes` | `se_id` | Routes assigned to SE; Routes page excludes demo SEs (inclusive null pattern) |
| `farm_cards` | `se_id` | Used in territory analytics / FSPP approvals (SE name via join) |
| `farm_diary` | via farmer → `se_id` | Farm Diary filters by SE |
| `shifts` | `se_id` | Demo SEs excluded (strict false) |
| `shift_locations` | via shift | Attendance timeline for an SE’s shift |
| `expenses` | `se_id` | Demo filtered (inclusive null pattern + client filter) |
| `inventory_transactions` / `retail_orders` | SE profile join | Stock transfer targets non-demo SEs only in picker |
| `sales_executive` | `profile_id` | Extension profile for mobile onboarding |

### Confirmed SE detail network counts

Exact head counts:

- `dealers` where `se_id = se.id`  
- `farmers` where `se_id = se.id`  
- `distributors` where `se_id = se.id`  

Does **not** count drafts or FPOs.

### Confirmed Route Builder conflict with Routes list

- Routes **page** SE list excludes demo (`false` or `null`).  
- **RouteBuilderDialog** SE picker loads **all** `role = 'SE'` with **no** demo filter → a demo SE can still be assigned a route if opened via builder in contexts that allow it.

---

## 17. Data Ownership / Scoping

### Confirmed

- SE directory is **global** (all SEs visible to any admin with module view).  
- No territory-head scoping of “only my SEs” in queries.  
- Downstream data is scoped **by `se_id`** when viewing an SE’s network or when filtering operational modules by selected SE.

### Unconfirmed

Multi-org / multi-company isolation.

---

## 18. Search / Filter Behavior with Business Meaning

### Confirmed in SE module

- Text by name / mobile / email.  
- Demo badge for identification.  
- Profile Complete vs Pending as operational onboarding signal.

### Confirmed across app (SE as filter dimension)

Many modules offer “filter by SE” / “Onboarded By” using SE names or ids. Whether demo SEs appear in those pickers depends on the module (see §10 conflict table).

---

## 19. Conditional Behavior

| Condition | Behavior |
|---|---|
| No `sales_executives` view | Access Denied |
| Has view, no edit | View-only directory; demo switch disabled; no Add SE |
| Has edit | Can create SE; can toggle demo |
| Create without role | SE exists with legacy `SE` only; mobile RBAC may be empty |
| Create with real email | Auth email still `{mobile}@gmail.com`; profile email set to real |
| Create without real email | Profile email may remain synthetic (trigger-dependent) — **Unconfirmed** final value |
| `is_demo = true` | Excluded from some operational lists; still listed in SE directory and some directory filters |
| SE tries web admin | Blocked by AppLayout |

---

## 20. Edge Cases

### Confirmed

1. DOB captured but discarded.  
2. Mobile role labeled required but not enforced.  
3. `role_id` update by mobile match (not Auth user id).  
4. `selectedRoleId` not cleared on successful create reset.  
5. “Edit” opens read-only sheet.  
6. Demo filter inconsistency (`eq false` vs `false OR null` vs no filter).  
7. Route builder can assign demo SEs even when Routes list hides them.  
8. Dashboard counts **all** SEs including demo; “Profiles Complete” ignores demo flag.  
9. SE detail dealer/farmer/distributor counts ignore drafts.  
10. Early migration allowed free profile rows; current path assumes Auth-linked profiles.  
11. Same edge function name `create-se` also creates non-SE web users (CO) — shared infrastructure.

### Unconfirmed

Behavior when two profiles share the same mobile during `role_id` update.

---

## 21. Cross-Module Effects

### Confirmed

Creating an SE enables that identity to own:

- Channel onboardings (distributors/dealers/FPOs)  
- Farmers, farm cards, farm diaries  
- Routes, shifts, attendance, expenses  
- Retail stock assignments and orders  

Toggling **Demo** changes whether the SE appears in attendance/shifts/expenses/routes/retail/farm-diary filters (per each module’s filter rules), affecting reports and payouts.

Assigning a **Mobile/Both role** at creation determines which mobile modules the SE may access (via Roles & Access), subject to mobile app enforcement (**Unconfirmed** here).

---

## 22. Calculations / Derived Values

### Confirmed

1. Full name = `firstName` + optional `lastName` (trimmed).  
2. Auth email (SE) = `{mobile}@gmail.com`.  
3. Profile Complete badge = boolean of `is_profile_complete`.  
4. Network KPIs = exact counts of dealers/farmers/distributors by `se_id`.  
5. Dashboard: SE total = count profiles `role=SE`; complete = count `sales_executive` with `is_profile_complete=true`.  
6. Platform fallback for SE without dynamic role = `Mobile`.

No scoring/band calculations specific to the SE entity itself in admin.

---

## 23. Authentication Provisioning Behavior (End-to-End)

```
Admin (can_edit sales_executives)
  → create-se (service role)
      → Auth user (email = mobile@gmail.com, confirmed, metadata)
      → (assumed) profile row for Auth id with role SE   [trigger Unconfirmed]
      → optional profiles.email = real email
  → optional profiles.role_id = selected Mobile/Both role (match by mobile)
  → SE can sign into mobile app
  → SE blocked from Field Commander Admin web shell
  → SE fills sales_executive JSON on mobile until is_profile_complete   [Unconfirmed rules]
```

---

## 24. Rules a New Stack Must Preserve

To match reference functional behavior:

1. Represent SE as profile with legacy role **`SE`**, optional **`sales_executive`** extension, optional **`role_id`**, and **`is_demo`**.  
2. Provision Auth accounts for SEs with login email **`{mobile}@gmail.com`**, confirmed immediately, storing real email separately when provided.  
3. Allow admin create with required **first name, mobile, password**; optional last name, email, mobile role.  
4. Allow assigning only roles with platform **Mobile or Both** at creation.  
5. Treat **profile completion** as `sales_executive.is_profile_complete` sourced from mobile onboarding (admin read-only).  
6. Support **Demo SE** toggle and exclude demo SEs from operational modules — but note the reference app’s **inconsistent null handling** and decide deliberately.  
7. Block SEs (and Mobile-only platform) from the web admin shell.  
8. Gate directory by `sales_executives` view; gate create/demo toggle by edit.  
9. Preserve `se_id` ownership links to channel partners, farmers, routes, shifts, expenses, retail.  
10. Keep SE directory searchable by name/mobile/email and show Complete/Pending + Demo indicators.

---

## 25. Important Unresolved / Conflicting Rules

1. **Demo exclusion predicates differ** (`is_demo = false` vs `false OR null` vs no filter).  
2. **Route Builder** includes demo SEs; **Routes page** excludes them.  
3. **Mobile Role required in UI** but not in create validation.  
4. **DOB field unused**.  
5. **`role_id` linked by mobile**, not by Auth user id.  
6. **“Edit” opens read-only detail** — no admin profile mutation.  
7. **Profile completion write path** not in this repo (mobile).  
8. **Profile/Auth linkage trigger** assumed but not in local migrations.  
9. **Farmers/Dealers/Distributors/FPOs filters include demo SEs**; ops modules often do not.  
10. Dashboard SE totals **include demos**; many reports try to exclude them.

---

## 26. Cross-Module Dependencies

| Depends on | Why |
|---|---|
| **Roles & Access** | Mobile/Both role assignment + module permission `sales_executives` |
| **Auth / `create-se`** | Account provisioning |
| **profiles + sales_executive** | Core data model |

| Depended on by | Why |
|---|---|
| Distributors, Dealers, Farmers, FPOs | `se_id` / Onboarded By |
| Territory Routes | SE assignment of routes / analytics |
| Shifts, Attendance, Expenses | SE activity & filters |
| Farm Diary / FSPP / Farm Cards | SE ownership joins |
| Retail | Stock transfer to SE |
| Dashboard | SE counts & completion KPI |

---

## 27. Evidence / Source Index

| Concern | Source |
|---|---|
| Directory, create, demo toggle, permissions | `src/pages/SEsPage.tsx` |
| Table columns, search, demo switch, Complete/Pending | `src/components/SETable.tsx` |
| Detail tabs, network counts, read-only edit footer | `src/components/SEDetailSheet.tsx` |
| Auth email / metadata / profile email fix | `supabase/functions/create-se/index.ts` |
| Base schema for `sales_executive` | `supabase/migrations/20260511052322_…sql` |
| Web deny for SE / Mobile platform | `src/components/AppLayout.tsx` |
| Platform fallback for SE | `src/hooks/useAuth.ts` |
| Dashboard SE KPIs | `src/pages/Dashboard.tsx` |
| Demo filters (strict) | `AttendancePage.tsx`, `ShiftsPage.tsx`, `RetailAdminPage.tsx` |
| Demo filters (false OR null) | `RoutesPage.tsx`, `ExpensesPage.tsx`, `FarmDiaryPage.tsx` |
| No demo filter on SE pickers | `FarmersPage.tsx`, `DealersPage.tsx`, `DistributorsPage.tsx`, `FposPage.tsx`, `RouteBuilderDialog.tsx` |
| Nav / permission key | `AppSidebar.tsx`, `RolesPage.tsx` |

---

*End of Sales Executives business rules extraction.*
