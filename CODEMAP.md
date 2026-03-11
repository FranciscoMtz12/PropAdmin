# CODEMAP - PropAdmin

This file gives AI tools and developers a fast structural map of the project.

## Root Structure

- `app/`
  Main application routes using Next.js App Router

- `components/`
  Reusable UI and application components

- `contexts/`
  React contexts such as authenticated user context

- `lib/`
  Shared logic, helpers and Supabase client utilities

- `public/`
  Static assets

- `AI_RULES.md`
  Core AI development rules for the project

- `PROJECT_CONTEXT.md`
  Master context of the project

- `FEATURE_CHECKLIST.md`
  Checklist for building new features safely

- `COPILOT_CONTEXT.md`
  Context file to help Copilot understand the project better

## App Route Map

### Global / Main Routes

- `app/page.tsx`
  Main landing or entry page

- `app/login/page.tsx`
  Login page

- `app/dashboard/page.tsx`
  Dashboard module

- `app/agenda/page.tsx`
  Agenda / scheduling module

- `app/payments/page.tsx`
  Payments module

- `app/maintenance/page.tsx`
  Maintenance module

## Buildings Module

- `app/buildings/page.tsx`
  Buildings list page

- `app/buildings/[buildingId]/page.tsx`
  Building detail page

### Building Child Modules

- `app/buildings/[buildingId]/unit-types/page.tsx`
  Unit types list for one building

- `app/buildings/[buildingId]/unit-types/[unitTypeId]/page.tsx`
  Unit type detail page

- `app/buildings/[buildingId]/unit-types/[unitTypeId]/assets/page.tsx`
  Base assets / template assets for a unit type

- `app/buildings/[buildingId]/unit-types/[unitTypeId]/assets/[templateAssetId]/page.tsx`
  Base asset detail page for a unit type

## Units Module

- `app/buildings/[buildingId]/units/page.tsx`
  Units list for one building

- `app/buildings/[buildingId]/units/[unitId]/page.tsx`
  Unit detail page

### Unit Assets Module

- `app/buildings/[buildingId]/units/[unitId]/assets/page.tsx`
  Asset list for one unit

- `app/buildings/[buildingId]/units/[unitId]/assets/[assetId]/page.tsx`
  Asset detail page

- `app/buildings/[buildingId]/units/[unitId]/assets/[assetId]/maintenance/page.tsx`
  Maintenance view for one asset

## Planned / Future Modules

These may exist partially or may be added later.

- `app/buildings/[buildingId]/cleaning/page.tsx`
  Building cleaning module

- `app/buildings/[buildingId]/improvements/page.tsx`
  Planned improvements module

## Components Map

### Layout / Page Structure Components

- `components/PageContainer.tsx`
  Main centered page wrapper

- `components/PageHeader.tsx`
  Standard page title, subtitle and actions area

- `components/SectionCard.tsx`
  Main content card for grouped sections

- `components/Sidebar.tsx`
  Global app sidebar

### UI Components

- `components/UiButton.tsx`
  Reusable button component

- `components/Modal.tsx`
  Reusable modal

- `components/AppCard.tsx`
  Reusable content card

- `components/AppGrid.tsx`
  Grid layout helper

- `components/AppBadge.tsx`
  Badge / label display

- `components/AppIconBox.tsx`
  Icon wrapper with consistent styling

- `components/AppFormField.tsx`
  Form input helper

- `components/AppSelect.tsx`
  Reusable select field

- `components/AppEmptyState.tsx`
  Empty state helper

- `components/AppTable.tsx`
  Table helper

- `components/AppTabs.tsx`
  Tab navigation component

- `components/AppStatBar.tsx`
  Visual stats / segmented metrics bar

### Domain Components

- `components/AssetTypeIcon.tsx`
  Displays asset icon based on asset type

- `components/BuildingCategoryBadge.tsx`
  Displays building category badge

- `components/MetricCard.tsx`
  Metric summary card

- `components/DeleteConfirmModal.tsx`
  Reusable delete confirmation modal

- `components/GlobalBreadcrumbs.tsx`
  Breadcrumb navigation helper

## Contexts

- `contexts/UserContext.tsx`
  Current authenticated user context and company context

## Lib Files

- `lib/supabaseClient.ts`
  Supabase client connection

- `lib/buildingCategories.ts`
  Building category-related helpers

## Business Data Map

### Main Entities

- Company
- Buildings
- Unit Types
- Unit Type Assets
- Units
- Assets
- Maintenance Logs

### Related Entities

- Building Files
- Leases
- Invoices
- App Users

## Database Table Map

Confirmed public tables:

- `companies`
- `buildings`
- `app_users`
- `unit_types`
- `unit_type_assets`
- `units`
- `assets`
- `maintenance_logs`
- `building_files`
- `leases`
- `invoices`

## Important Rules by Entity

### Assets
- assets use soft delete with `deleted_at`
- assets must be filtered with:
  `deleted_at IS NULL`
- deleted assets must not appear in:
  - lists
  - counts
  - tabs
  - summaries
  - stats

### Units
- units include:
  - `unit_number`
  - `display_code`
  - `floor`
  - `status`

### Buildings
- building detail acts as parent navigation hub for:
  - units
  - unit types
  - maintenance
  - future cleaning
  - future improvements

## Development Navigation Rule

When a new module is created, check whether it also needs updates in:

- parent detail page
- child navigation buttons
- sidebar
- dashboard shortcuts
- related tabs
- counts / summaries

## Typical Feature Impact Map

### If adding a new building child module
Usually check:
- `app/buildings/[buildingId]/page.tsx`
- `components/Sidebar.tsx`
- possible dashboard shortcuts
- future section cards or navigation cards

### If changing assets logic
Usually check:
- `app/buildings/[buildingId]/units/[unitId]/assets/page.tsx`
- `app/buildings/[buildingId]/units/[unitId]/page.tsx`
- `app/buildings/[buildingId]/units/[unitId]/assets/[assetId]/page.tsx`
- any stats, tabs or summaries using assets count

### If changing soft delete behavior
Usually check:
- list page
- detail page
- parent summary page
- stats cards
- tabs count
- dashboard metrics if applicable

## AI Usage Rule

Before generating code:
1. identify the exact route or file
2. verify whether related pages are affected
3. verify whether reusable components already exist
4. return complete files instead of snippets
5. preserve current design system and architecture