# ARCHITECTURE - PropAdmin

## Purpose

PropAdmin is a property management web application focused on operational control, property administration, tenant management, maintenance, cleaning, administrative payments, collections, and future tenant-facing workflows.

This document explains the system architecture, business entities, relationships, functional rules, and implementation constraints so AI tools and developers can understand the project before making changes.

---

# 1. System Overview

PropAdmin is organized around a **company-first multi-entity structure**.

Each company owns its own:

- buildings
- unit types
- units
- tenants
- leases
- assets
- maintenance logs
- cleaning records
- payments
- collections
- invoices
- related operational records

Most database queries must respect the active `company_id`.

---

# 2. Business Entity Hierarchy

Primary business structure:

Company
-> Buildings
-> Unit Types
-> Units
-> Leases
-> Tenants
-> Assets
-> Maintenance
-> Cleaning
-> Payments
-> Collections

Additional supporting relationships:

- Buildings can have files/documents
- Unit types can define base assets
- Units can inherit operational behavior from type and building
- Tenants may have direct lease relationships
- Tenants may also act as responsible payers
- Leases feed collections and invoicing workflows
- Assets can generate maintenance and future recurring operational tasks

---

# 3. Core Entities

## 3.1 Company

Represents the owner/operator scope of the system.

Responsibilities:
- root business container
- branding source in the future
- access segmentation
- record ownership through `company_id`

Rules:
- most entities must belong to a company
- filtering by `company_id` is required when relevant

---

## 3.2 Buildings

Represents a property/building inside a company.

Typical responsibilities:
- identify the physical building
- group units
- group unit types
- store building-level information and files
- future company branding and configuration may influence building views

Relationships:
- a company has many buildings
- a building has many unit types
- a building has many units
- a building may have many files/documents

---

## 3.3 Unit Types

Represents reusable apartment/department templates inside a building.

Typical responsibilities:
- classify units by type
- define bedroom capacity
- support operational rules by type
- support base assets through `unit_type_assets`

Important known field:
- `bedroom_count`

Relationships:
- belongs to building
- used by many units
- may have many base assets

Business rule:
- `bedroom_count` drives the maximum number of simultaneous active leases in a unit

---

## 3.4 Units

Represents individual departments/units.

Typical responsibilities:
- store unit identity
- connect with building and unit type
- host leases
- host assets
- host operational history

Important relationships:
- belongs to company
- belongs to building
- belongs to unit type
- has many leases
- has many assets
- may be referenced by collections, maintenance, cleaning, and future reports

Important behavior:
- the unit detail page is the operational center for unit-specific management
- leases are managed from the unit detail page, not from a separate leases module

Status examples:
- VACANT
- RENTED
- MAINTENANCE

Business rule:
- unit status must stay consistent with active lease state when leases are created, ended, or deleted

---

## 3.5 Tenants

Represents people/entities renting units.

Tenants are a **centralized module** and must not depend on `app_users`.

Typical responsibilities:
- store tenant identity
- contact information
- RFC / tax_id
- billing information
- status
- notes
- future history of invoices, payments, and debt visibility

Important fields:
- `full_name`
- `email`
- `phone`
- `tax_id`
- `billing_name`
- `billing_email`
- `status`

Relationships:
- a tenant may have zero or many leases over time
- a tenant may also be the `responsible_payer_id` of one or more leases
- a tenant may have current active lease or only historical relationships

Current UI goals:
- centralized tenant page
- visible building relationship when active lease exists
- visible unit relationship when active lease exists
- future history sections

Business rule:
- tenant delete must respect lease relations
- if tenant has related leases, delete may need to be blocked or handled carefully

---

## 3.6 Leases

Represents rental agreements attached to units.

Leases are managed **inside the unit detail page**.

Important fields already known:
- `tenant_id`
- `responsible_payer_id`
- `billing_name`
- `billing_email`
- `due_day`
- `room_number`
- `rent_amount`
- `status`
- `start_date`
- `end_date`

Important statuses:
- ACTIVE
- ENDED

### Lease Business Rules

#### A. Leases live inside unit detail
There is no separate standalone leases module for management.

#### B. Multiple active leases per unit are allowed
The limit depends on `unit_types.bedroom_count`.

Rules:
- 1 bedroom = max 1 active lease
- 2 bedrooms = max 2 active leases
- 3 bedrooms = max 3 active leases

#### C. Each active lease occupies a `room_number`
If a room is already occupied by an active lease, it cannot be assigned again.

#### D. Dates must display exactly as captured
Date handling must avoid timezone shifting that causes day rollback.

#### E. Billing autofill
`billing_name` and `billing_email` should not be manually invented in the lease flow.

They should come from:
1. `responsible_payer_id` if present
2. otherwise from the tenant

#### F. Due day
`due_day` may exist in backend for internal control, but it should not be emphasized in the lease UI.

Operationally, end-of-month due behavior is preferred.

#### G. Delete behavior
Delete is allowed for correction workflows, but delete must use modal confirmation and never use native browser confirm.

#### H. Finish vs Delete
- Finish = preserve history
- Delete = correction of an incorrect record

---

## 3.7 Assets

Represents installed or assigned items within units.

Typical responsibilities:
- inventory/control of physical assets
- support maintenance records
- support future recurring workflows
- future relation to cleaning and operational calendars

Important rule:
- assets use soft delete via `deleted_at`

Soft delete filter:
- always exclude records where `deleted_at` is not null

Important UI standard:
- Assets module is the delete confirmation reference pattern for the rest of the system

---

## 3.8 Maintenance

Represents maintenance actions and logs.

Typical responsibilities:
- track repairs and service actions
- support asset-linked maintenance
- future recurring maintenance visibility in calendars

Relationships:
- may reference units
- may reference assets
- belongs to company
- may be building or unit scoped depending on implementation

This module should eventually follow full CRUD standards and delete modal standardization.

---

## 3.9 Cleaning

Represents cleaning operations.

Typical responsibilities:
- internal unit cleaning
- operational cleaning records
- calendar visibility
- future recurrence

Known project direction:
- cleaning logic and views exist separately
- global calendar should not be overloaded with unnecessary detail
- cleaning views may support operational scheduling by frequency and recurrence

This module should eventually follow full CRUD standards and delete modal standardization.

---

## 3.10 Payments

Represents administrative expense payments and recurring payment logic.

Typical responsibilities:
- track building/unit/admin payments
- support recurring payments
- projected payments
- due date logic
- overdue status logic

Important project direction:
- payment status should be derived from due date when relevant
- UI and actions are already becoming a pattern source for dropdown actions

Payments page is a key visual reference for:
- actions dropdown pattern

---

## 3.11 Collections

Represents rent collection / receivable workflows.

Related tables already known:
- `collection_schedules`
- `collection_records`
- `collection_payments`
- `collection_invoices`

Business direction:
- active leases should eventually feed collection schedules
- schedules should generate collection records
- collection records should become visible in `/collections`

Current goals:
- support pending / partial / collected / overdue
- support balance visibility
- support payment history
- support invoice visibility

Future grouping rule:
- multiple leases can share the same `responsible_payer_id`
- that should allow grouped billing / grouped collection workflows

---

## 3.12 Invoices

Invoices are tracked operationally but not generated as SAT-compliant accounting objects inside the system.

Known direction:
- invoices are generated outside the system
- system stores PDF + XML
- XML is the primary structured source when available
- PDF is visual/download support
- duplicate detection by UUID or equivalent should exist
- invoices must link to the correct lease / unit / collection context

---

# 4. Current App Module Structure

Known app modules include:

- `app/buildings`
- `app/calendar`
- `app/cleaning`
- `app/collections`
- `app/dashboard`
- `app/login`
- `app/maintenance`
- `app/payments`
- `app/tenants`

Unit detail flow currently lives under:

- `app/buildings/[buildingId]/units/[unitId]/page.tsx`

This file is an important operational page and should be treated carefully.

---

# 5. Current Reusable UI System

Use existing reusable components whenever possible.

Known components:
- PageContainer
- PageHeader
- SectionCard
- MetricCard
- AppCard
- AppGrid
- UiButton
- Modal
- AppIconBox
- AppBadge
- AppTable
- AppTabs
- AppStatBar
- AppFormField
- AppSelect
- AppEmptyState

AI tools and developers should prefer these before inventing new patterns.

---

# 6. CRUD Standard

All CRUD flows should include:

- create
- edit
- delete

And when applicable:
- detail view or detail page

## Delete Standard
Delete must always:
- use modal confirmation
- never use `window.confirm`
- follow the same visual pattern used in Assets
- remain visually consistent across modules

## Actions Standard
Table actions should use dropdown menus whenever possible.

Preferred pattern:
- dropdown trigger
- edit
- delete

Reference pattern:
- Payments page

---

# 7. Soft Delete Standard

When soft delete exists for an entity:

- hide deleted records from lists
- hide deleted records from metrics
- hide deleted records from summaries
- hide deleted records from tabs
- hide deleted records from dashboards
- keep related pages consistent

Current known soft delete entity:
- Assets (`deleted_at`)

Always use the real repo/database implementation before assuming soft delete exists elsewhere.

---

# 8. Functional vs Visual Development Strategy

The project should evolve in two separate phases.

## Phase 1 — Functional Standardization
Focus on:
- CRUD completion
- delete modal standardization
- data integrity
- stable relationships
- business rule enforcement
- correct filtering and counts
- module connection consistency

Avoid visual redesign during this phase.

## Phase 2 — Visual Standardization
After functional stability:
- logo by company
- primary color by company
- secondary color by company
- branding consistency
- spacing polish
- table polish
- dropdown polish
- page-by-page visual cleanup

Do not mix visual branding refactors with critical functional changes unless explicitly requested.

---

# 9. Important Known Rules

## Tenant Rules
- tenants are centralized
- tenants do not depend on `app_users`
- tenant page should show current building/unit relation when active lease exists
- tenant page should eventually support more history visibility

## Lease Rules
- leases are handled in unit detail
- multiple active leases per unit are allowed based on bedroom count
- each active lease must occupy one room number
- billing data should autofill from responsible payer or tenant
- dates must not shift due to timezone
- active status should be visually prominent
- delete must use modal, never native confirm

## Collection Rules
- future grouped collection is possible through `responsible_payer_id`
- collections are fed upstream by leases

## Calendar Rules
- global calendar is executive/operational
- do not overload it with deep financial detail
- complex calendar logic may remain in a large file temporarily if that keeps iteration simpler

---

# 10. AI Tool Rules

AI-generated changes must:
- check the real repo first
- respect actual file structure
- avoid assuming schema fields without confirmation
- use complete files when providing replacements
- avoid large unrelated refactors
- preserve current routes and operational flows
- keep visible UI in Spanish when relevant

AI should prioritize:
- safe diffs
- minimal scope
- consistency with existing patterns
- alignment with project rules in `AI_RULES.md`

---

# 11. Operational Development Preference

This project currently benefits from:
- clear page-by-page changes
- complete file replacements when editing a single page manually
- batching aesthetic cleanup later
- keeping a running backlog of:
  - CRUD pages missing delete or delete standardization
  - small aesthetic improvements to batch later

These backlogs should be maintained separately.

---

# 12. Long-Term Vision

PropAdmin should become a fully standardized property management platform with:

- stable entity relationships
- complete CRUD coverage
- consistent delete interaction
- reusable UI patterns
- modular operational flows
- future multi-company branding support
- scalable financial and operational visibility
- eventual tenant-facing portal support