# CODEX_TASKS - PropAdmin

## Purpose

This file defines the standard tasks that Codex or other AI agents can perform inside the PropAdmin repository.

Tasks are organized so the system can evolve safely without breaking architecture or business rules.

Agents must follow the project rules defined in:

AI_RULES.md  
ARCHITECTURE.md  
AGENTS.md  
CRUD_BACKLOG.md  
UI_POLISH_BACKLOG.md  

Agents must read those files before executing any task.

---

# Task Execution Rules

When performing tasks, agents must:

1. Identify the exact files to modify
2. Keep changes minimal
3. Avoid modifying unrelated modules
4. Respect existing architecture
5. Follow CRUD and UI standards
6. Return a summary of changes
7. Validate that rules were not broken

Agents must never:

- break routes
- change database schema
- refactor large modules unnecessarily
- mix functional work with visual polish

---

# Task Group 1 — CRUD Audit

Purpose:
Identify CRUD gaps in the system.

Task:

Audit all pages in the `app/` directory and detect:

- create functionality
- edit functionality
- delete functionality
- delete confirmation pattern

Delete confirmation must follow the system rule:

Modal component  
Never window.confirm  

Output:

A report listing:

- pages missing delete
- pages using window.confirm
- pages already compliant

Reference backlog:

CRUD_BACKLOG.md

---

# Task Group 2 — CRUD Completion

Purpose:
Complete CRUD flows for pages missing delete functionality.

Steps:

1. Identify target page
2. Locate delete implementation pattern in Assets module
3. Add delete modal
4. Implement delete logic
5. Refresh UI after delete
6. Validate entity relationships before deletion

Rules:

Delete must:

- use Modal
- never use window.confirm
- maintain UI consistency
- use Spanish UI text

---

# Task Group 3 — Delete Modal Standardization

Purpose:
Replace native browser confirmations with the standard modal.

Targets include:

- cleaning/common
- cleaning/exterior

Steps:

1. Remove window.confirm
2. Add Modal confirmation
3. Preserve existing delete logic
4. Ensure consistent UI behavior

---

# Task Group 4 — Dropdown Action Standardization

Purpose:
Ensure table actions follow the standard dropdown pattern.

Steps:

1. Locate tables with inline action buttons
2. Replace with dropdown action menu
3. Include standard actions:

Edit  
Delete  

Reference implementation:

Payments page.

---

# Task Group 5 — CRUD Consistency Audit

Purpose:
Verify system-wide CRUD consistency.

Check that all CRUD pages include:

- create
- edit
- delete
- modal delete confirmation

Report any violations.

---

# Task Group 6 — Code Safety Review

Purpose:
Prevent regressions.

Agents should verify:

- routes remain valid
- reusable components are used
- UI text remains Spanish
- database queries respect company_id
- soft delete logic remains correct

---

# Task Group 7 — Documentation Sync

Purpose:
Keep project documentation aligned with code.

Agents should update:

CRUD_BACKLOG.md  
UI_POLISH_BACKLOG.md  

when:

- a CRUD task is completed
- delete modal standardization is implemented
- a new CRUD page is introduced

---

# Task Group 8 — Visual Polish (Phase 2 Only)

This task group should only run after functional standardization.

Tasks include:

- branding integration
- logo support
- primary/secondary color system
- layout spacing improvements
- UI consistency improvements

Visual tasks are tracked in:

UI_POLISH_BACKLOG.md

Agents must not perform visual polish during functional phase.

---

# Task Execution Strategy

Agents should execute tasks in the following order:

1. CRUD audit
2. CRUD completion
3. delete modal standardization
4. CRUD consistency audit
5. documentation sync
6. visual polish (phase 2)

This order ensures functional stability before aesthetic changes.

---

# Final Goal

PropAdmin should evolve into a fully standardized platform with:

- consistent CRUD flows
- standardized delete behavior
- reusable UI components
- stable architecture
- AI-assisted development workflows