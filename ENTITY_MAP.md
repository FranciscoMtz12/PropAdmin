# ENTITY MAP - PropAdmin

This file describes how the core entities of PropAdmin relate to each other.

It helps AI tools and developers understand database relationships and write correct queries.

---

# Core Business Structure

Company  
→ Buildings  
→ Unit Types  
→ Base Assets (unit_type_assets)  
→ Units  
→ Assets  
→ Maintenance Logs  

---

# Main Entities

## Company

Table: companies

Represents the owner organization of the property portfolio.

Primary key

id

Main relationships

company → buildings  
company → units  
company → assets  
company → users  

---

## Users

Table: app_users

Represents authenticated users inside a company.

Key fields

id  
company_id  
email  
role  

Relationships

app_users.company_id → companies.id

---

## Buildings

Table: buildings

Represents a property or building.

Key fields

id  
company_id  
name  
address  
code  

Relationships

buildings.company_id → companies.id

Child entities

buildings → unit_types  
buildings → units  
buildings → assets (through units)  

---

## Unit Types

Table: unit_types

Represents a template for apartment types.

Examples

Studio  
1 Bedroom  
2 Bedroom  

Key fields

id  
company_id  
building_id  
name  

Relationships

unit_types.company_id → companies.id  
unit_types.building_id → buildings.id  

Child entities

unit_types → unit_type_assets  

---

## Unit Type Assets (Base Assets)

Table: unit_type_assets

Defines the template assets that should exist in a unit type.

Examples

Kitchen sink  
Water heater  
Air conditioner  

Key fields

id  
company_id  
unit_type_id  
name  
asset_type  

Relationships

unit_type_assets.unit_type_id → unit_types.id  

Purpose

These act as templates for real assets when units are created.

---

## Units

Table: units

Represents an individual apartment or unit.

Key fields

id  
company_id  
building_id  
unit_type_id  
unit_number  
display_code  
floor  
status  

Relationships

units.company_id → companies.id  
units.building_id → buildings.id  
units.unit_type_id → unit_types.id  

Child entities

units → assets  

---

## Assets

Table: assets

Represents real physical assets installed in a unit.

Examples

Refrigerator  
Water heater  
Air conditioner  
Lighting  

Key fields

id  
company_id  
building_id  
unit_id  
asset_type  
name  
status  
notes  
icon_name  
created_at  
deleted_at  

Relationships

assets.company_id → companies.id  
assets.building_id → buildings.id  
assets.unit_id → units.id  

Child entities

assets → maintenance_logs  

---

## Maintenance Logs

Table: maintenance_logs

Represents maintenance history of assets.

Examples

Repair  
Replacement  
Inspection  

Key fields

id  
company_id  
asset_id  
description  
cost  
created_at  

Relationships

maintenance_logs.company_id → companies.id  
maintenance_logs.asset_id → assets.id  

---

# Supporting Entities

## Building Files

Table: building_files

Stores documents associated with buildings.

Examples

Blueprints  
Permits  
Insurance  

Key fields

id  
building_id  
file_url  
file_type  

Relationships

building_files.building_id → buildings.id

---

## Leases

Table: leases

Represents rental agreements for units.

Key fields

id  
unit_id  
tenant_name  
start_date  
end_date  

Relationships

leases.unit_id → units.id

---

## Invoices

Table: invoices

Represents billing records.

Key fields

id  
lease_id  
amount  
due_date  

Relationships

invoices.lease_id → leases.id

---

# Entity Hierarchy

The main operational hierarchy is:

Company  
→ Buildings  
→ Units  
→ Assets  
→ Maintenance Logs  

Templates exist above units:

Company  
→ Buildings  
→ Unit Types  
→ Unit Type Assets  

---

# Soft Delete Rules

Assets use soft delete.

Column

deleted_at

Rules

Soft deleted assets must NOT appear in:

asset lists  
unit summaries  
counts  
tabs  
dashboard metrics  

Query rule

Always filter assets using

.is("deleted_at", null)

---

# Typical Query Patterns

Load units for a building

supabase
.from("units")
.select("*")
.eq("building_id", buildingId)

---

Load assets for a unit

supabase
.from("assets")
.select("*")
.eq("unit_id", unitId)
.is("deleted_at", null)

---

Load maintenance history

supabase
.from("maintenance_logs")
.select("*")
.eq("asset_id", assetId)

---

# Development Impact Rules

When modifying entities check related areas.

Assets affect

unit detail page  
asset detail page  
maintenance module  
unit summaries  
dashboard metrics  

Units affect

building detail page  
unit assets  
leases  

Buildings affect

units  
unit types  
cleaning  
improvements  

---

# Planned Future Entities

## Cleaning

Possible tables

cleaning_tasks  
cleaning_schedules  
cleaning_assignments  

Relationships

cleaning_tasks.building_id → buildings.id  
cleaning_tasks.unit_id → units.id  

---

## Improvements

Possible tables

improvements  
improvement_projects  

Relationships

improvements.building_id → buildings.id  
improvements.unit_id → units.id  

---

# End of Entity Map