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

## Business Architecture
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

## Core Development Rules
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

## UI / Design System
Use the existing reusable components whenever possible:
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

## Supabase Rules
- Filter by company_id when relevant.
- Respect real schema from repo and database.
- If an entity uses soft delete, filter with:
  deleted_at IS NULL
- Do not assume extra columns unless confirmed.

## Soft Delete Rule
When soft delete is implemented for an entity:
- hide deleted records from list pages
- hide deleted records from detail-related summaries
- exclude deleted records from counts, tabs, metrics and dashboards

## New Module Rule
When creating a new module, also check:
1. page creation
2. access from related detail page
3. sidebar or dashboard access if needed
4. related data loading
5. future CRUD path
6. visual consistency with current app

## Copilot Usage Rule
When generating code with Copilot:
- always provide project context
- always provide route
- always provide exact page goal
- always mention design system
- always mention soft delete rules if relevant

## ChatGPT Workflow Rule
Before asking ChatGPT for code:
1. check repo first
2. identify exact file to change
3. request complete file output
4. do not ask for snippets