# FEATURE_CHECKLIST - PropAdmin

Use this checklist every time a new feature, page, or module is created.

## 1. Scope
- What is the exact goal?
- Which entity does it affect?
- Which route will it use?
- Is it list, detail, create, edit, delete, or full CRUD?

## 2. Files to Review Before Coding
- current related page
- related detail page
- related reusable components
- current design system components
- existing Supabase client usage
- current types used in that module

## 3. Database / Data Rules
- confirm real table exists
- confirm columns exist
- confirm relationships exist
- confirm if soft delete applies
- filter deleted_at null if relevant
- filter company_id when relevant

## 4. UI Rules
- use PageContainer
- use PageHeader
- use SectionCard
- use AppCard / AppGrid when relevant
- use Modal for create/edit when appropriate
- keep current SaaS style
- do not introduce random styling patterns

## 5. Navigation Rules
If a new page is added, verify whether it also needs:
- button from related detail page
- sidebar access
- dashboard access
- tab access
- link from parent entity page

## 6. CRUD Rules
For each entity, ask:
- can user create it?
- can user view it?
- can user edit it?
- can user delete it?
- if delete exists, is it soft delete?
- if delete is soft delete, are related views updated?

## 7. Final Validation
- route works
- page loads
- no broken links
- no TypeScript errors
- no missing props
- no visual inconsistency
- commit message prepared