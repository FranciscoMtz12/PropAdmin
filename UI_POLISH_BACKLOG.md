# UI_POLISH_BACKLOG - PropAdmin

## Purpose

This document tracks all visual and aesthetic improvements that should be implemented after the functional system is stable.

These changes are intentionally separated from:

- CRUD completion
- database logic
- operational rules
- entity relationships

This file exists to ensure visual improvements are applied systematically and consistently after the functional phase.

---

# Development Strategy

The project follows two main phases.

## Phase 1 — Functional Standardization

Focus on:

- completing CRUD flows
- delete modal standardization
- database consistency
- stable module interactions
- correct relationships between entities
- reusable component adoption

No visual redesign should occur during this phase unless necessary.

---

## Phase 2 — Visual Polish

Once functional stability is reached, implement visual improvements across the application.

These improvements should be applied page-by-page to ensure consistency.

---

# Branding System (Future)

The system will support company-specific branding.

Each company may define:

- company logo
- primary color
- secondary color

These values will be used to customize:

- header accents
- button highlights
- badges
- dashboard accents
- visual identity elements

Branding implementation should not affect system functionality.

---

# Global Visual Improvements

These changes should be implemented consistently across the entire application.

## Logo Integration

Add support for:

- company logo
- logo display in header
- logo display in sidebar

Future rules:

- fallback logo if company logo is missing
- consistent logo sizing
- consistent logo spacing

---

## Primary Color System

Allow each company to define a primary UI color.

Primary color may affect:

- buttons
- action highlights
- links
- active navigation states
- dashboard accents

---

## Secondary Color System

Allow each company to define a secondary UI color.

Secondary color may affect:

- secondary buttons
- subtle highlights
- UI accents

---

# Layout Consistency

Standardize layout behavior across pages.

## Page Header

Ensure consistent structure:

- page title
- optional primary action
- optional filters
- consistent spacing

---

## Section Spacing

Standardize spacing between:

- sections
- cards
- tables
- filters
- tabs

Avoid inconsistent padding or margins.

---

## Card Consistency

Ensure all cards follow consistent patterns:

- spacing
- header layout
- content alignment
- action placement

---

# Table Standardization

Tables should maintain consistent behavior.

## Table Actions

Actions should appear inside dropdown menus.

Standard pattern:

- dropdown trigger
- edit
- delete

Reference pattern: **Payments page**

---

## Table Spacing

Standardize:

- header height
- row padding
- column alignment
- action column width

---

## Table Empty States

Empty tables should use the component:

AppEmptyState

Ensure consistent messaging and spacing.

---

# Button Consistency

Buttons should follow consistent usage.

Primary buttons should use:

UiButton

Secondary buttons should use:

UiButton variant="secondary"

Avoid creating custom button styles unless necessary.

---

# Badge Consistency

Status badges should use:

AppBadge

Standardize colors and semantics.

Examples:

Active → green  
Inactive → yellow  
Overdue → red  
Pending → gray  

---

# Modal Consistency

All modals should use the Modal component.

Ensure consistency in:

- modal width
- modal padding
- modal footer buttons
- confirm / cancel placement

Delete confirmation modals should remain visually consistent across modules.

---

# Dropdown Consistency

Dropdown actions should use the same visual pattern across the app.

Reference module:

Payments page

Avoid multiple dropdown implementations.

---

# Sidebar Improvements

Future sidebar improvements may include:

- company logo display
- improved spacing
- clearer active navigation highlighting
- visual grouping of modules

These changes should not alter routing behavior.

---

# Dashboard Visual Enhancements

Possible future improvements:

- improved metric cards
- visual indicators for alerts
- consistent icon sizing
- better spacing between metrics

Functional behavior must remain unchanged.

---

# Page-by-Page Visual Pass

After Phase 1 is complete, apply visual polish in this order:

1. Dashboard
2. Tenants
3. Buildings
4. Unit Types
5. Units
6. Leases
7. Assets
8. Maintenance
9. Cleaning
10. Payments
11. Collections
12. Calendar

Each page should be reviewed for:

- spacing
- header consistency
- table consistency
- button usage
- dropdown actions
- modal consistency

---

# Visual Change Safety Rules

Visual changes must:

- not modify database queries
- not change entity relationships
- not change CRUD logic
- not introduce new backend behavior
- not break existing routes

Focus only on presentation layer.

---

# Tracking Rule

When a visual improvement is implemented:

mark it in this document.

Example:

[Done] Dropdown standardization applied to Tenants page.

---

# Separation Rule

Never mix tasks from CRUD_BACKLOG.md with tasks from UI_POLISH_BACKLOG.md.

Functional work must be completed before visual polish begins.

---

# Long Term Goal

Achieve a clean, consistent, and brandable interface that:

- supports multi-company identity
- maintains reusable UI patterns
- preserves functional stability
- improves usability without altering system behavior