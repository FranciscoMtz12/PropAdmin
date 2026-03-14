# AGENTS - PropAdmin

## Purpose

This file defines the operational rules for AI agents working on the PropAdmin codebase.

Agents must read and follow the documentation files in this repository before modifying code.

Primary reference documents:

AI_RULES.md
ARCHITECTURE.md
CRUD_BACKLOG.md
UI_POLISH_BACKLOG.md

These files define the architecture, coding rules, and backlog priorities.

---

# Project Overview

PropAdmin is a property management web application designed to manage:

- buildings
- unit types
- units
- tenants
- leases
- assets
- maintenance
- cleaning
- administrative payments
- rent collections

The application is designed around a company-based architecture where most entities belong to a company.

---

# Technology Stack

Next.js (App Router)
React
TypeScript
Supabase
PostgreSQL
Supabase Auth
Supabase Storage

Agents must respect the existing stack and architecture.

---

# Core Architecture

High-level entity structure:

Company
→ Buildings
→ Unit Types
→ Units
→ Leases
→ Tenants
→ Assets
→ Maintenance
→ Cleaning
→ Payments
→ Collections

Detailed architecture rules are defined in ARCHITECTURE.md.

Agents must review this document before modifying entity logic.

---

# Coding Rules

Agents must follow these rules when generating code.

## Minimal Changes

Changes should be minimal and localized.

Agents must NOT:

- refactor unrelated modules
- restructure directories
- rename files without justification
- introduce new architecture patterns

Only modify files necessary to complete the requested task.

---

## Respect Existing Routes

Do not break existing routes.

Example route pattern:

app/buildings/[buildingId]/units/[unitId]/page.tsx

Dynamic routes must remain stable.

---

## Use Existing Components

Prefer existing reusable UI components.

Available components include:

PageContainer
PageHeader
SectionCard
MetricCard
AppCard
AppGrid
UiButton
Modal
AppIconBox
AppBadge
AppTable
AppTabs
AppStatBar
AppFormField
AppSelect
AppEmptyState

Avoid introducing new UI patterns when an existing component already solves the problem.

---

# CRUD Rules

All CRUD flows should include:

- create
- edit
- delete

When applicable:

- detail page

The CRUD standard is documented in CRUD_BACKLOG.md.

---

# Delete Standard

Delete must always follow the system delete pattern.

Rules:

Delete must use the Modal component.
Never use window.confirm.
Delete confirmation must appear inside a modal.
Delete logic must be consistent across modules.

Reference implementation:

Assets module delete pattern.

---

# Dropdown Action Standard

Actions in tables should appear inside dropdown menus when possible.

Standard dropdown actions:

Edit
Delete

Reference implementation:

Payments page.

Avoid creating multiple dropdown patterns.

---

# Soft Delete Rules

When an entity uses soft delete:

records should not be permanently removed.

Use a deleted_at field.

Soft deleted records must be hidden from:

- tables
- metrics
- dashboards
- related summaries

---

# Supabase Rules

When querying Supabase:

- respect the real schema
- filter by company_id when relevant
- do not assume columns exist
- verify entity relationships before modifying queries

Agents must not introduce schema assumptions without checking the repository.

---

# UI Rules

UI should follow the existing design system.

Key rules:

- maintain spacing consistency
- use existing card structures
- use AppBadge for status indicators
- use Modal for confirmation dialogs
- use UiButton for actions

UI text should remain Spanish for user-facing elements.

Correct UI examples:

Eliminar
Cancelar
Guardar
Editar

Incorrect examples:

Delete
Cancel
Save
Edit

---

# Functional vs Visual Changes

PropAdmin development is separated into two phases.

## Phase 1 — Functional Standardization

Focus on:

- CRUD completion
- delete modal standardization
- data integrity
- stable entity relationships

Visual redesign should not happen during this phase.

---

## Phase 2 — Visual Polish

After functional stability:

- company branding
- logo integration
- primary and secondary colors
- spacing improvements
- table layout consistency
- dropdown consistency

Visual tasks are tracked in UI_POLISH_BACKLOG.md.

---

# AI Workflow

When performing tasks, agents should follow this process:

1. Read project documentation
2. Identify exact files that need modification
3. Explain the plan briefly
4. Apply minimal code changes
5. List modified files
6. Validate that rules were respected

Agents must avoid large multi-module changes.

---

# Safety Rules

Agents must NOT:

- modify database schema
- remove working functionality
- break existing routes
- mix functional refactors with visual polish
- introduce new dependencies without justification

Focus on safe, incremental improvements.

---

# Long-Term Goal

PropAdmin aims to become a standardized property management platform with:

- stable entity relationships
- complete CRUD coverage
- consistent UI patterns
- reusable components
- scalable architecture
- multi-company branding support