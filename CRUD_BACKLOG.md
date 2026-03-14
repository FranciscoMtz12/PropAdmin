# CRUD_BACKLOG - PropAdmin

## Purpose

This document tracks all CRUD pages in PropAdmin that still need:

- delete functionality
- delete modal standardization
- CRUD completion review

This backlog is part of the **functional standardization phase** and must be kept separate from visual or branding work.

---

# Global CRUD Standard

All CRUD flows in PropAdmin must include:

- create
- edit
- delete

When applicable, also:
- detail page or detail view

## Delete Standard

Delete must always:

- use the `Modal` component
- never use `window.confirm`
- follow the same visual pattern used in the **Assets module**

Delete behavior must remain consistent across the entire application.

## Actions Standard

Table actions should be placed inside dropdown menus whenever possible.

Preferred pattern:

- dropdown trigger
- edit
- delete

Reference pattern:
- Payments page

---

# Functional vs Visual Rule

This backlog is only for **functional standardization**.

It should not be mixed with:

- company logo integration
- primary/secondary brand colors
- small visual polish
- spacing cleanup
- aesthetic consistency updates

Visual polish belongs to a separate final phase.

---

# Current CRUD Audit Status

## A. Pages missing delete functionality

These pages currently have create and/or edit flows but still do not have delete.

### Priority 1 — Core modules

- [ ] `/buildings`
- [ ] `/collections`
- [ ] `/buildings/[buildingId]/units`

### Priority 2 — Unit type structure

- [ ] `/buildings/[buildingId]/unit-types`
- [ ] `/buildings/[buildingId]/unit-types/[unitTypeId]`

### Priority 3 — Unit type asset templates

- [ ] `/buildings/[buildingId]/unit-types/[unitTypeId]/assets`
- [ ] `/buildings/[buildingId]/unit-types/[unitTypeId]/assets/[templateAssetId]`

### Priority 4 — Unit assets parent page

- [ ] `/buildings/[buildingId]/units/[unitId]/assets`

### Priority 5 — Cleaning unit flows

- [ ] `/buildings/[buildingId]/cleaning/units`
- [ ] `/buildings/[buildingId]/cleaning/units/[unitId]`

---

## B. Pages that have delete but need modal standardization

These pages currently use delete, but their confirmation behavior is not compliant with the project standard.

### Uses native confirm and must be migrated to Modal

- [ ] `/buildings/[buildingId]/cleaning/common`
- [ ] `/buildings/[buildingId]/cleaning/exterior`

Required change:
- remove `window.confirm`
- replace with standard `Modal` delete confirmation

---

## C. Pages already compliant with delete standard

These pages already have delete and use the correct modal-based interaction.

- [x] `/tenants`
- [x] `/payments`
- [x] `/buildings/[buildingId]/units/[unitId]` (leases section)
- [x] `/buildings/[buildingId]/units/[unitId]/assets/[assetId]` (soft delete via `deleted_at`)

These pages are the current reference implementation.

---

# Recommended Resolution Order

To standardize the system safely, fix pages in this order:

## Phase 1 — Highest priority core entities
1. `/buildings`
2. `/collections`
3. `/buildings/[buildingId]/units`

## Phase 2 — Property structure
4. `/buildings/[buildingId]/unit-types`
5. `/buildings/[buildingId]/unit-types/[unitTypeId]`

## Phase 3 — Template asset structure
6. `/buildings/[buildingId]/unit-types/[unitTypeId]/assets`
7. `/buildings/[buildingId]/unit-types/[unitTypeId]/assets/[templateAssetId]`

## Phase 4 — Cleaning delete standardization
8. `/buildings/[buildingId]/cleaning/common`
9. `/buildings/[buildingId]/cleaning/exterior`
10. `/buildings/[buildingId]/cleaning/units`
11. `/buildings/[buildingId]/cleaning/units/[unitId]`

## Phase 5 — Final audit pass
12. re-check all CRUD pages for:
   - delete support
   - modal compliance
   - dropdown actions consistency

---

# Implementation Notes

## Delete behavior
When implementing delete:

- use `Modal`
- never use native browser confirm
- refresh data after delete
- keep counts, tabs, summaries and related metrics consistent

## Soft delete
When an entity uses soft delete:

- do not physically delete record unless explicitly intended
- hide deleted records from:
  - tables
  - metrics
  - summaries
  - related lists
  - dashboards

Current known soft delete reference:
- unit assets (`deleted_at`)

## Related data integrity
Before enabling delete, always check if the entity has related records that should:

- block deletion
- require soft delete
- require cleanup or cascade logic
- require a business-rule-specific warning

Example:
- tenants with related leases may require delete restrictions

---

# Tracking Rule

This file must be kept updated when:

- a page gets delete support
- a page gets modal standardization
- a new CRUD page is added
- a delete flow changes from native confirm to modal
- a page becomes the new standard reference

---

# Separate Backlog Reminder

Do not add visual polish tasks here.

Visual polish must stay in a separate backlog, including:

- company logo
- company primary color
- company secondary color
- spacing refinements
- button polish
- modal polish
- dropdown visual polish
- header consistency
- sidebar branding
- page-by-page aesthetic cleanup

This file is strictly for CRUD functional standardization.

---

# Last Audit Source

Source:
- Codex CRUD audit report

Summary:
- report reviewed and accepted as baseline backlog
- no code modification was performed during audit