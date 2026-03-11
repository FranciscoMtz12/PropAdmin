# DEV WORKFLOW - PropAdmin

This document defines the standard development workflow for building features in the PropAdmin system.

The goal is to reduce friction, maintain consistency, and allow faster development using AI tools like Copilot.

---

# 1. Feature Definition

Before writing code, define the feature clearly.

Questions to answer:

- What is the feature?
- Which entity does it affect?
- Is it building-level, unit-level, asset-level, or global?
- Does it require database changes?
- Does it affect navigation?
- Does it affect counts, summaries, or dashboards?

Example

Feature:
Cleaning module for buildings

Scope:
Building-level feature

Route:
app/buildings/[buildingId]/cleaning/page.tsx

---

# 2. Architecture Review

Before implementing a feature:

1. Check CODEMAP.md  
2. Check ENTITY_MAP.md  
3. Check PROJECT_CONTEXT.md  

Confirm:

- correct route
- related entities
- related pages
- related navigation

---

# 3. Database Review

If the feature requires data:

Verify in Supabase:

- table exists
- correct columns exist
- relationships are correct
- soft delete rules apply if needed

Example

assets use:

deleted_at

Filter rule:

.is("deleted_at", null)

---

# 4. File Impact Analysis

Before writing code identify which files might be affected.

Typical impacts include:

Parent page

Example

app/buildings/[buildingId]/page.tsx

Child module page

Example

app/buildings/[buildingId]/cleaning/page.tsx

Related detail pages

Example

units page  
assets page  

Navigation

Example

Sidebar  
Dashboard shortcuts  

Metrics

Example

MetricCard counts

---

# 5. UI Structure

All pages should follow the PropAdmin layout structure.

Preferred layout

PageContainer  
PageHeader  
SectionCard  

Content elements

AppCard  
AppGrid  
AppTable  

Actions

UiButton  
Modal  

Avoid creating custom layouts when existing components exist.

---

# 6. Data Loading Pattern

Use Supabase client.

Typical pattern

const { data, error } = await supabase
  .from("table_name")
  .select("*")
  .eq("company_id", user.company_id)

Add additional filters depending on entity.

Example

.eq("building_id", buildingId)

Example

.eq("unit_id", unitId)

If soft delete applies

.is("deleted_at", null)

---

# 7. CRUD Pattern

Each entity should support the following operations.

Create

Form or modal  
Insert into Supabase  

Read

List page  
Detail page  

Update

Edit modal or page  

Delete

Delete confirmation modal  
Soft delete if applicable  

---

# 8. Navigation Update

After creating a new module verify navigation.

Possible locations

Parent detail page

Example

building page

Sidebar

Dashboard shortcuts

Tabs

Example

Assets | Maintenance | Cleaning

---

# 9. Testing Checklist

Before committing verify

Page loads without errors

Navigation works

No TypeScript errors

Supabase queries return expected data

Soft delete logic respected

UI consistent with design system

Counts and summaries correct

---

# 10. Git Workflow

After finishing a feature commit changes.

Example workflow

git add .

git commit -m "Add cleaning module foundation"

git push

---

# 11. AI Usage Workflow

When using Copilot or ChatGPT follow this pattern.

Step 1

Describe the feature.

Step 2

Provide route.

Step 3

Reference project context files.

Example prompt

Use:

AI_RULES.md  
PROJECT_CONTEXT.md  
CODEMAP.md  
ENTITY_MAP.md  
MODULE_TEMPLATE.md  

Create feature:

Cleaning module

Route

app/buildings/[buildingId]/cleaning/page.tsx

Follow PropAdmin design system.

Return full file.

---

# 12. Continuous Improvement

After building a feature update:

PROJECT_CONTEXT.md  
CODEMAP.md  
ENTITY_MAP.md  

This keeps AI tools aligned with the real project state.

---

# End of Development Workflow