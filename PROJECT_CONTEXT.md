# PROJECT_CONTEXT - PropAdmin

## Project Name
PropAdmin

## Description
Web app for property administration, operations, maintenance, and future modules such as cleaning and improvements.

## Current Stack
- Next.js (App Router)
- React
- TypeScript
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage

## Current Business Architecture
Company
-> Buildings
-> Unit Types
-> Base Assets (unit_type_assets)
-> Units
-> Assets
-> Maintenance Logs

## Existing or Advanced Modules
1. Buildings
2. Building detail
3. Unit Types
4. Unit Type Assets
5. Units
6. Unit detail
7. Unit assets list
8. Asset detail
9. Dashboard
10. Agenda
11. Payments
12. Maintenance
13. Sidebar
14. Centered layout / unified UI

## Existing Database Tables
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

## Important Confirmed Schema Notes
- units has: unit_number, display_code, floor, status
- assets has: id, company_id, building_id, unit_id, asset_type, name, status, notes, icon_name, created_at
- maintenance_logs exists and is connected
- buildings, units, and assets already contain real data

## Important Functional Notes
- Asset Detail was fixed using real schema.
- Soft delete exists for assets using deleted_at.
- Asset detail already supports logical delete.
- Related views must stay consistent and exclude deleted assets.

## Development Preferences
- Always review real repo before proposing changes.
- Always return full files, not snippets.
- Keep visual, structural and functional continuity.
- Do not recreate existing pages from scratch without checking current file first.
- Prefer safe patches and full replaceable files.

## Immediate Priorities
1. Keep asset soft delete consistent
2. Create reusable delete foundation
3. Then units delete
4. Then buildings delete
5. Then Cleaning foundation
6. Then Improvements foundation

## Future Cleaning Vision
Cleaning should be separate from technical maintenance.

Planned categories:
1. Exterior building
   - green
   - nature / leaf identity
2. Common areas
   - blue
   - broom / cleaning identity
3. Unit interior
   - purple
   - apartment cleaning service

Future goals:
- separate cleaning calendar
- squads / staff planning
- workload estimation
- automation by constraints

## Future Improvements Vision
Improvements should be separate from maintenance.

Examples:
- floor replacement
- bathroom upgrade
- tile replacement
- aesthetic upgrades
- budget-based future improvements