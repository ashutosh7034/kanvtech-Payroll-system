# PAYFLOW — Enterprise HRMS Design System Specification

**Document Reference:** `docs/ui-ux/PAYFLOW_DESIGN_SYSTEM.md`  
**Execution Timestamp:** 2026-10-26  
**Author:** Principal UI/UX Designer & Enterprise SaaS Architect  
**Status:** ESTABLISHED & ACTIVE  

---

## 1. Design Principles

1. **Restrained Enterprise Aesthetic:** Modern, high-density, clean visual hierarchy inspired by Spine HRNG. Avoid superficial AI/dashboard glow effects, oversized cards, and unnecessary gradients.
2. **Predictable Modal & Drawer Hierarchy:** Three standardized interaction patterns based on operational complexity:
   - **Pattern A (Small Confirmation Dialog):** Compact alerts, status confirmations, destructive action verification.
   - **Pattern B (Medium Form Dialog):** Short structured workflows (Leave entry, Resignation, Quick regularization).
   - **Pattern C (Large Form Drawer / Full Workspace):** Multi-tab high-density data entry (Employee enrollment, Salary component configuration, Payroll workbench).
3. **Information Density & Legibility:** Designed for daily HR & payroll power-users. Clear table alignments, monospace figures for currency (`₹`) and identifiers (PAN, UAN, Account numbers), compact inputs with visible focus rings.
4. **Resilient Data Integrity:** UI changes never manipulate payroll mathematics, statutory rules, or database models. All backend APIs, role authorizations, and audit logging remain 100% intact.

---

## 2. Design Tokens & Styling Variables

### 2.1 Color Tokens
```css
:root {
  /* Core Brand & Action */
  --color-primary: #0284c7;           /* PAYFLOW Corporate Sky Blue */
  --color-primary-hover: #0369a1;     /* Darker hover state */
  --color-primary-light: #e0f2fe;     /* Subtle active highlight */

  /* Neutral Surfaces & Backgrounds */
  --color-background: #f8fafc;        /* App canvas background */
  --color-surface: #ffffff;           /* Cards, panels, modals */
  --color-surface-subtle: #f1f5f9;    /* Table headers, read-only fields */

  /* Typography */
  --color-text-primary: #0f172a;      /* High-contrast slate navy */
  --color-text-secondary: #475569;    /* Muted field labels & subtext */
  --color-text-muted: #94a3b8;        /* Placeholders & disabled text */

  /* Borders & Dividers */
  --color-border: #cbd5e1;            /* Standard input & card borders */
  --color-border-subtle: #e2e8f0;     /* Table rows & inner dividers */

  /* Semantic Statuses */
  --color-success: #0d9488;           /* Approved, Active, Finalized */
  --color-success-bg: #f0fdfa;
  --color-warning: #d97706;           /* Pending, Review, Action Needed */
  --color-warning-bg: #fffbeb;
  --color-danger: #dc2626;            /* Rejected, Terminated, Critical Alert */
  --color-danger-bg: #fef2f2;
  --color-info: #2563eb;              /* Informational notices */
  --color-info-bg: #eff6ff;
}
```

### 2.2 Geometry, Shadows & Spacing Tokens
```css
:root {
  --radius-control: 4px;              /* Buttons, inputs, dropdowns */
  --radius-panel: 6px;                /* Cards, panels, tables */
  --radius-modal: 8px;                /* Dialogs, workspaces */
  --radius-pill: 9999px;              /* Status tags & badges */

  --shadow-panel: 0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.05);
  --shadow-lg: 0 10px 15px -3px rgba(15, 23, 42, 0.1), 0 4px 6px -4px rgba(15, 23, 42, 0.05);
  --shadow-modal: 0 25px 50px -12px rgba(15, 23, 42, 0.35);

  --spacing-1: 4px;
  --spacing-2: 8px;
  --spacing-3: 12px;
  --spacing-4: 16px;
  --spacing-6: 24px;
  --spacing-8: 32px;
}
```

---

## 3. Standardized Component Patterns

### 3.1 Dialog & Container Standardization
- **Pattern A (Confirmation):**
  - Container: `.modal-confirm` (`max-width: 440px`).
  - Action buttons: Cancel (outline) + Confirm / Delete (solid primary or danger).
- **Pattern B (Medium Form Dialog):**
  - Container: `.modal-medium` (`max-width: 680px`, `max-height: 85vh`).
  - Scrollable body + fixed header + fixed footer with Save/Cancel.
- **Pattern C (Large Workspace / Drawer):**
  - Drawer: `.drawer-content` (`width: 640px` or `720px`).
  - Large Modal: `.modal-spine-workspace` (`width: 96vw`, `max-width: 1800px`, `height: 92vh`).

### 3.2 Form Control Design
- **Height:** Consistent `32px` across text inputs, date pickers, number fields, and select dropdowns.
- **Typography:** Labels at `0.78rem` (`600` weight, `#475569`), inputs at `0.8125rem` (`#1e293b`).
- **Focus Rings:** `border-color: #0284c7`, `box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.15)`.

### 3.3 High-Density Data Tables
- Header: `.data-table th` (`height: 36px`, background `#f8fafc`, uppercase text `0.72rem`, `#475569`).
- Rows: `.data-table td` (`height: 40px`, padding `8px 12px`, border-bottom `1px solid #f1f5f9`).
- Currency Columns: `.money` (right-aligned, monospace font `JetBrains Mono`).

---

## 4. Architectural Rules & Safe Execution

1. **No Backend Disruption:** No API contracts or payload shapes are altered. All endpoints remain 100% compatible.
2. **Role Authorization:** `canViewModule()`, `canPerformAction()`, and `canViewField()` are preserved across every view.
3. **Readonly Safety:** Protected loan record `b405b4b8-1211-48c5-a59e-ee8db001a906` is treated strictly as read-only.
4. **Primary Database Immutability:** Never run drop, truncate, or seed scripts against `payroll_management`.
