# Master API Checklist

Combined requirements from Dealers, Distributors, FPOs, and Roles & Access modules.

**Legend:** `☐` = not verified in new backend | Priority: **Must** blocks frontend | **Should** important | **Nice** optional

> **Note:** Some endpoints appear in multiple modules (e.g. `GET /api/auth/me/permissions`). Implement once; mark all related IDs when verified.

---

| ID | Module | Feature | Suggested endpoint | Method | Priority | Implemented |
|----|--------|---------|-------------------|--------|----------|-------------|
| D-01 | Dealers | Resolve current user permissions | `/api/auth/me/permissions` | GET | Must | ☐ |
| D-02 | Dealers | List SE names for filter | `/api/profiles?role=SE&fields=name` | GET | Must | ☐ |
| D-03 | Dealers | List submitted dealers | `/api/dealers` | GET | Must | ☐ |
| D-04 | Dealers | List dealer drafts | `/api/dealers/drafts` | GET | Must | ☐ |
| D-05 | Dealers | Merge drafts + submitted directory | `/api/dealers?includeDrafts=true` | GET | Must | ☐ |
| D-06 | Dealers | Get dealer / draft detail | `/api/dealers/:id` | GET | Must | ☐ |
| D-07 | Dealers | Update submitted dealer | `/api/dealers/:id` | PATCH | Must | ☐ |
| D-08 | Dealers | Update dealer draft | `/api/dealers/drafts/:id` | PATCH | Must | ☐ |
| D-09 | Dealers | Upload dealer document | `/api/dealers/:id/documents/upload` | POST | Should | ☐ |
| D-10 | Dealers | Export dealers CSV/PDF | `/api/dealers/export` | GET | Nice | ☐ |
| D-11 | Dealers | Location cascade (state → district → taluka) | `/api/locations/india/:state` | GET | Should | ☐ |
| DIS-01 | Distributors | Resolve current user permissions | `/api/auth/me/permissions` | GET | Must | ☐ |
| DIS-02 | Distributors | List SE names for filter | `/api/profiles?role=SE&fields=name` | GET | Must | ☐ |
| DIS-03 | Distributors | List submitted distributors | `/api/distributors` | GET | Must | ☐ |
| DIS-04 | Distributors | List distributor drafts | `/api/distributors/drafts` | GET | Must | ☐ |
| DIS-05 | Distributors | Merge drafts + submitted directory | `/api/distributors?includeDrafts=true` | GET | Must | ☐ |
| DIS-06 | Distributors | Get distributor / draft detail | `/api/distributors/:id` | GET | Must | ☐ |
| DIS-07 | Distributors | Export distributors CSV/PDF | `/api/distributors/export` | GET | Nice | ☐ |
| F-01 | FPOs | Resolve current user permissions | `/api/auth/me/permissions` | GET | Must | ☐ |
| F-02 | FPOs | List SE names for filter | `/api/profiles?role=SE&fields=name` | GET | Must | ☐ |
| F-03 | FPOs | List submitted FPOs | `/api/fpos` | GET | Must | ☐ |
| F-04 | FPOs | List FPO drafts | `/api/fpos/drafts` | GET | Must | ☐ |
| F-05 | FPOs | Merge drafts + submitted directory | `/api/fpos?includeDrafts=true` | GET | Must | ☐ |
| F-06 | FPOs | Get FPO / draft detail | `/api/fpos/:id` | GET | Must | ☐ |
| F-07 | FPOs | Update submitted FPO (basic fields) | `/api/fpos/:id` | PATCH | Must | ☐ |
| F-08 | FPOs | Update FPO draft | `/api/fpos/drafts/:id` | PATCH | Must | ☐ |
| F-09 | FPOs | Export FPOs CSV/PDF | `/api/fpos/export` | GET | Nice | ☐ |
| R-01 | Roles & Access | List roles with permissions | `/api/roles` | GET | Must | ☐ |
| R-02 | Roles & Access | Create role | `/api/roles` | POST | Must | ☐ |
| R-03 | Roles & Access | Update role metadata | `/api/roles/:id` | PATCH | Must | ☐ |
| R-04 | Roles & Access | Delete role | `/api/roles/:id` | DELETE | Must | ☐ |
| R-05 | Roles & Access | Replace role permissions | `/api/roles/:id/permissions` | PUT | Must | ☐ |
| R-06 | Roles & Access | Get current user profile + role | `/api/auth/me` | GET | Must | ☐ |
| R-07 | Roles & Access | Resolve current user permissions | `/api/auth/me/permissions` | GET | Must | ☐ |
| R-08 | Roles & Access | Get grantable module catalog | `/api/roles/module-catalog` | GET | Should | ☐ |
| R-09 | Roles & Access | List user-specific permissions | `/api/users/:id/permissions` | GET | Nice | ☐ |
| R-10 | Roles & Access | Upsert user-specific permissions | `/api/users/:id/permissions` | PUT | Nice | ☐ |
| R-11 | Roles & Access | Provision user with role | `/api/admin/users` | POST | Should | ☐ |

---

## Summary counts

| Module | Total APIs | Must | Should | Nice |
|--------|------------|------|--------|------|
| Dealers | 11 | 8 | 2 | 1 |
| Distributors | 7 | 6 | 0 | 1 |
| FPOs | 9 | 8 | 0 | 1 |
| Roles & Access | 11 | 7 | 2 | 2 |
| **Combined (with shared rows)** | **38** | **29** | **4** | **5** |

**Unique endpoints (deduplicated):** ~25 — shared auth, profiles, and permission APIs count once.

---

## UNCONFIRMED items (manual decisions)

| Topic | Modules affected | Question |
|-------|------------------|----------|
| Mobile onboarding/submit flows | Dealers, Distributors, FPOs | Where are create + initial submit implemented? Not in admin repo. |
| Dealer approval workflow | Dealers | Does admin need APPROVED/REJECTED actions? No UI today. |
| Distributor scoring/band on submit | Distributors | Same thresholds as dealers? Mobile-side only. |
| FPO scoring on submit | FPOs | Who calculates `total_score`? |
| `user_permissions` vs `role_permissions` | Roles | Orphan `PermissionEditor` — build per-user overrides or skip? |
| Delete role with assigned users | Roles | Cascade, restrict, or nullify `profiles.role_id`? |
| Mobile permission enforcement | Roles | Backend for mobile app needs separate audit. |
| Cloudinary vs own storage | Dealers | Replace placeholder upload preset in reference code. |

---

## Files in this folder

- [README.md](./README.md)
- [dealers.md](./dealers.md)
- [distributors.md](./distributors.md)
- [fpos.md](./fpos.md)
- [roles-and-access.md](./roles-and-access.md)
- [_master-checklist.md](./_master-checklist.md) (this file)
