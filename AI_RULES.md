# AI_RULES - PropAdmin

## Project
PropAdmin is a property management web application.

## Stack
- Next.js (App Router)
- React
- TypeScript
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage

---

# Business Architecture

Company
-> Buildings
-> Unit Types
-> Base Assets (unit_type_assets)
-> Units
-> Assets
-> Maintenance Logs

Future related modules:
- Improvements
- Cleaning
- Building Documents
- Reports
- Collections
- Payments
- Financial reports

---

# Core Development Rules

1. Keep current architecture.
2. Do not break existing routes.
3. Prefer complete CRUD flows.
4. Editing should happen from detail pages or clean modals.
5. Use complete files, not partial snippets.
6. Add comments in code to explain important logic.
7. Avoid duplicated code and prefer reusable components.
8. Respect the current design system.
9. Do not assume props, file names, routes, or structure without checking the real repo first.
10. If soft delete exists for an entity, related list and detail pages must stay consistent.
11. Always check the real repository before generating changes.

---

# CRUD Standard Rule

All CRUD flows must include:

- create
- edit
- delete

Delete must always:

- use the `Modal` component
- never use `window.confirm`
- follow the same UI pattern used in the **Assets module**

The delete interaction must remain **consistent across the entire application**.

---

# Table Actions Rule

Table actions must be placed inside **dropdown menus** whenever possible.

Standard pattern:

- dropdown trigger
- edit action
- delete action

Follow the same UI behavior used in the **Payments page**.

Avoid placing edit/delete buttons directly in tables unless strictly necessary.

---

# Development Strategy

The project follows two phases:

## Phase 1 — Functional standardization

Focus on system stability.

Tasks:

- finish CRUD flows
- standardize delete behavior
- stabilize module interactions
- ensure relationships between entities work
- verify database queries
- verify filters and relations
- ensure reusable components are used correctly

No visual redesign during this phase.

---

## Phase 2 — Visual polish

After functional stability:

- company branding
- company logo
- primary color
- secondary color
- visual consistency improvements
- spacing adjustments
- table visual improvements
- dropdown visual improvements
- UI micro improvements

These changes must be applied **page-by-page**, not mixed with functional refactors.

---

# UI / Design System

Use the existing reusable components whenever possible.

Approved components:

- PageContainer
- PageHeader
- SectionCard
- MetricCard
- Modal
- UiButton
- AppCard
- AppIconBox
- AppBadge
- AppGrid
- AppFormField
- AppSelect
- AppEmptyState
- AppTable
- AppTabs
- AppStatBar

Avoid creating new UI patterns if a reusable component already exists.

Maintain visual consistency across modules.

---

# Supabase Rules

When querying the database:

- Filter by `company_id` when relevant.
- Respect the real schema from the repo and database.
- Never assume fields without checking schema first.

If an entity uses soft delete, filter using:
deleted_at IS NULL
Never display soft deleted records.

---

# Soft Delete Rule

When soft delete is implemented for an entity:

- hide deleted records from list pages
- hide deleted records from detail-related summaries
- exclude deleted records from counts
- exclude deleted records from metrics
- exclude deleted records from dashboards
- exclude deleted records from tabs
- exclude deleted records from related modules

Soft deleted records should never appear in UI lists.

---

# New Module Rule

When creating a new module, always verify:

1. page creation
2. access from related detail page
3. sidebar or dashboard access
4. correct data loading
5. future CRUD path
6. visual consistency with current app
7. correct Supabase filtering
8. correct relation with existing entities

---

# Copilot / Codex Usage Rule

When generating code with AI tools:

Always provide:

- project context
- file path
- route
- page goal
- design system reference
- CRUD rules
- soft delete rules (if relevant)

AI tools must **never assume structure without checking the repo first**.

---

# ChatGPT Workflow Rule

Before asking ChatGPT for code:

1. check the repository first
2. identify the exact file to change
3. request complete file output
4. do not ask for snippets
5. maintain CRUD and delete standards
6. verify design system usage

---

# Code Safety Rules

AI-generated code must:

- not break existing routes
- not remove working functionality
- not modify unrelated modules
- not introduce duplicated logic
- respect reusable components

Prefer **small safe changes** over large refactors.

---

# Long Term Goal

PropAdmin should evolve into a **fully standardized property management platform** with:

- consistent CRUD patterns
- stable module relationships
- reusable UI components
- modular architecture
- multi-company branding support