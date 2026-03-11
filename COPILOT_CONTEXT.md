# Copilot Context - PropAdmin

## Project Overview
PropAdmin is a property management web application used to manage buildings, units, assets, maintenance and operations.

The system is designed to scale into a full operational platform including cleaning management, improvements tracking and operational scheduling.

## Technology Stack
- Next.js (App Router)
- React
- TypeScript
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage

## Core Business Architecture

Company  
→ Buildings  
→ Unit Types  
→ Base Assets (unit_type_assets)  
→ Units  
→ Assets  
→ Maintenance Logs  

Future related modules:
- Improvements
- Cleaning
- Reports
- Building Documents

## Main Modules in the Application

Currently implemented:

- Dashboard
- Buildings
- Building Detail
- Unit Types
- Unit Type Assets
- Units
- Unit Detail
- Unit Assets
- Asset Detail
- Maintenance
- Agenda
- Payments

## Database Tables

Existing tables confirmed:

- companies
- buildings
- app_users
- unit_types
- unit_type_assets
- units
- assets
- maintenance_logs
- building_files
- leases
- invoices

## Important Schema Notes

units includes:
- unit_number
- display_code
- floor
- status

assets includes:
- id
- company_id
- building_id
- unit_id
- asset_type
- name
- status
- notes
- icon_name
- created_at
- deleted_at (soft delete)

maintenance_logs exists and is connected to assets.

## Soft Delete Rules

Assets use soft delete.

Soft deleted assets must:

- not appear in lists
- not appear in counts
- not appear in related views

Use this filter in Supabase queries:

```ts
.is("deleted_at", null)


All asset queries should respect this rule.

## Design System

The application uses a consistent UI system.

Preferred components:

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

All new pages should follow this visual structure.

## Development Rules

- Always review existing files before modifying them.
- Do not assume props or structures without checking the real code.
- Prefer reusable components over new UI patterns.
- Maintain visual consistency with existing pages.
- Provide full files instead of partial snippets when generating code.
- Add comments in important sections of code.

## Navigation Rules

When creating new modules or pages, consider:

- access from parent entity pages
- navigation from related modules
- sidebar navigation when appropriate
- dashboard shortcuts when relevant

## Cleaning Module (Planned)

Cleaning should be separated from maintenance.

Cleaning categories planned:

1 Exterior building  
- green visual identity

2 Common areas  
- blue visual identity

3 Unit interior  
- purple visual identity

Future features:

- cleaning calendar
- staff assignment
- workload estimation
- automation

## Improvements Module (Planned)

Improvements represent non-urgent upgrades such as:

- flooring replacement
- bathroom renovation
- tile upgrades
- aesthetic upgrades
- planned improvements backlog