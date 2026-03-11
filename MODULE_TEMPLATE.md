# MODULE TEMPLATE - PropAdmin

This template defines the standard structure for creating new modules in the PropAdmin system.

The purpose is to maintain architectural consistency, predictable navigation, and scalable development.

---

# 1. Module Overview

Module Name:
[WRITE MODULE NAME]

Examples:
Cleaning  
Improvements  
Tenants  
Vendors  
Expenses  
Reports  

Purpose:

Explain what the module is responsible for.

Example:

Cleaning manages operational cleaning tasks for buildings, common areas and unit interiors.

---

# 2. Route Structure

Define the main route depending on the scope of the module.

Building-level module

app/buildings/[buildingId]/[module]/page.tsx

Example

app/buildings/[buildingId]/cleaning/page.tsx

---

Unit-level module

app/buildings/[buildingId]/units/[unitId]/[module]/page.tsx

Example

app/buildings/[buildingId]/units/[unitId]/inspections/page.tsx

---

Asset-level module

app/buildings/[buildingId]/units/[unitId]/assets/[assetId]/[module]/page.tsx

Example

app/buildings/[buildingId]/units/[unitId]/assets/[assetId]/maintenance/page.tsx

---

Global module

app/[module]/page.tsx

Example

app/reports/page.tsx

---

# 3. Core Pages

Define which pages the module should include.

Typical pages include:

List page

[module]/page.tsx

Example

cleaning/page.tsx

---

Detail page

[module]/[id]/page.tsx

Example

cleaning/[taskId]/page.tsx

---

Create page or modal

Used to create new entities.

Example

Create Cleaning Task

---

Edit page or modal

Used to update existing records.

Example

Edit Cleaning Task

---

Delete confirmation modal

Used when deleting or soft deleting records.

Example

DeleteConfirmModal component.

---

# 4. Navigation Impact

When creating a module verify navigation updates.

Possible navigation locations include:

Parent entity page

Example

app/buildings/[buildingId]/page.tsx

Add navigation button or section card.

---

Sidebar navigation

components/Sidebar.tsx

If module should be globally accessible.

---

Dashboard shortcuts

app/dashboard/page.tsx

Add quick access if module is frequently used.

---

Tabs inside related entity pages

Example

Assets | Maintenance | Cleaning | History

---

# 5. Database Requirements

Define the required database tables.

Example

cleaning_tasks  
cleaning_schedules  
cleaning_assignments  

Define relationships.

Example

company_id  
building_id  
unit_id  

Confirm:

Primary key  
Foreign keys  
Indexes  
Timestamps  

---

# 6. Soft Delete Policy

If the entity supports soft delete:

Column

deleted_at timestamptz

Rules

Exclude deleted records from:

Lists  
Counts  
Summaries  
Tabs  

Example query filter

.is("deleted_at", null)

---

# 7. UI Structure

Pages should follow the PropAdmin design system.

Preferred layout structure

PageContainer  
PageHeader  
SectionCard  
AppCard / AppGrid / AppTable  

Common components

PageContainer  
PageHeader  
SectionCard  
AppCard  
AppGrid  
UiButton  
AppIconBox  
Modal  

Avoid introducing new design patterns unless necessary.

---

# 8. Data Loading Pattern

Typical Supabase query structure

const { data, error } = await supabase
  .from("[table]")
  .select("*")
  .eq("company_id", user.company_id)

If entity belongs to a building

.eq("building_id", buildingId)

If entity belongs to a unit

.eq("unit_id", unitId)

If soft delete applies

.is("deleted_at", null)

---

# 9. CRUD Flow

Each module should support a predictable CRUD flow.

Create

Modal or form  
Validation  
Insert into Supabase  

---

Read

List page  
Detail page  

---

Update

Edit modal or edit page  

---

Delete

Confirmation modal  
Soft delete if applicable  

---

# 10. Metrics and Summaries

Check if the module affects system metrics.

Examples

Dashboard metric cards

MetricCard

Unit summaries

Asset counts

Maintenance statistics

Update any affected metrics.

---

# 11. Future Extensions

Define possible future features.

Example for Cleaning module

Cleaning calendar  
Staff assignment  
Recurring schedules  
Workload balancing  
Notifications  
SLA tracking  

---

# 12. Implementation Checklist

Before finishing a module verify

Page loads correctly  
No TypeScript errors  
Navigation works  
Queries respect schema  
Soft delete rules respected  
UI consistent with system  
Related pages updated  

---

# End of Template