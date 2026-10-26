# APEX GLOBAL TECH HRMS — CONFIGURABLE PAYROLL FORMULA ENGINE REPORT
**Report Reference:** `PAYROLL_FORMULA_ENGINE_REPORT.md`  
**Date:** October 15, 2026  
**System Module:** Compensation & Authoritative Payroll Calculation Engine (`backend/src/modules/compensation` & `backend/src/modules/payroll`)  
**Technology Stack:** TypeScript, Node.js, Decimal.js, PostgreSQL, Prisma ORM, React 19  

---

## 1. OBJECTIVE & ARCHITECTURAL OVERVIEW

The Apex Global Tech payroll formula engine provides a dynamic, enterprise-grade mathematical and statutory computation platform that allows authorized administrators to configure salary structures without hardcoding formulas or deploying code changes.

### Key Tenets:
1. **Zero `eval` / `Function` Code Execution:** All formula evaluations run through an Abstract Syntax Tree (AST) parser utilizing deterministic recursive descent and `Decimal.js` exact-decimal arithmetic.
2. **Topological Dependency Ordering:** Components are automatically ordered using Kahn's algorithm so that any dependent allowances (e.g., HRA based on Basic, Special Allowance balancing CTC) evaluate only after their prerequisites are resolved.
3. **Cycle Path Detection:** Circular references (e.g., $A \rightarrow B \rightarrow C \rightarrow A$) are intercepted with comprehensive cycle path traces, preventing infinite recursion or stack overflows.
4. **Attendance-Aware Proration:** Every eligible fixed component prorates dynamically based on the specific calendar days of the month, mid-month joining/exit, and approved Loss of Pay (LOP) days.
5. **Separation of Concerns:** Employer statutory contributions (EPF, ESIC, Gratuity) are maintained separately from employee gross earnings and employee take-home pay.

---

## 2. TWELVE SUPPORTED SALARY COMPONENT CALCULATION TYPES

The system provides native configuration and evaluation for 12 distinct salary component categories:

| # | Calculation Type | Description | Evaluation Mechanism |
|---|------------------|-------------|----------------------|
| 1 | **Fixed Monthly Amount** | Standard fixed salary line (e.g. Basic, Conveyance, Fixed Allowance). | Stored fixed amount, prorated by payable days ratio if attendance prorates. |
| 2 | **Fixed Annual Amount** | Annual allowance/entitlement distributed across 12 monthly cycles. | Annual amount divided by 12, prorated by attendance ratio. |
| 3 | **Percentage of Basic** | Component computed as a percentage of Basic salary (e.g. HRA = 40% or 50% of Basic). | $\text{Basic} \times (\text{Percentage} / 100)$, resolved after Basic. |
| 4 | **Percentage of Another Component** | Component computed as a percentage of another specific component or CTC. | $\text{BaseComponent} \times (\text{Percentage} / 100)$. |
| 5 | **Formula-Based Amount** | Custom algebraic formula configured via the Formula Builder. | Evaluated via safe AST parser with context variables. |
| 6 | **Attendance-Prorated Amount** | Component strictly prorated by payable days / calendar days. | $\text{Unprorated} \times (\text{PayableDays} / \text{CalendarDays})$. |
| 7 | **Per-Day or Per-Hour Amount** | Shift-based or daily stipend payment. | $\text{DailyRate} \times \text{PresentDays}$ or $\text{HourlyRate} \times \text{Hours}$. |
| 8 | **Overtime-Based Amount** | Verified overtime from attendance biometric punches. | $(\text{Basic} / (\text{CalendarDays} \times 8)) \times \text{OT Hours} \times 2.0$. |
| 9 | **One-Time Earning or Deduction** | Ad-hoc bonus, performance award, or recovery deduction. | Applied directly to Gross Earnings or Employee Deductions. |
| 10 | **Employer Contribution** | Statutory employer liability (EPF 12%, ESIC 3.25%, Gratuity 4.81%). | Calculated on statutory wage bases, added to Employer Cost (CTC). |
| 11 | **Employee Statutory Deduction** | Statutory employee withholding (EPF 12%, ESIC 0.75%, PT slabs, TDS). | Deducted from Gross Pay according to statutory rule ceilings. |
| 12 | **Reimbursement or Variable Payment** | Verified finance expense claims or non-taxable allowances. | Added to Net Pay payout without statutory gross inclusion. |

---

## 3. SAFE AST FORMULA PARSER GRAMMAR & ENGINE DESIGN

The `FormulaEngine` class (`backend/src/modules/compensation/formulaEngine.ts`) implements a complete recursive descent tokenizer and parser.

### Tokenizer Specifications:
- **Numbers:** Integers and floating-point decimals (`15000`, `0.12`, `40.50`).
- **Identifiers:** Component codes and function names (`BASIC`, `HRA`, `CTC`, `MIN`, `MAX`, `IF`, `ROUND`).
- **Relational Operators:** `>`, `<`, `>=`, `<=`, `==`, `!=`, `=`.
- **Arithmetic Operators:** `+`, `-`, `*`, `/`.
- **Grouping & Delimiters:** `(`, `)`, `,`.

### Operator Precedence Grammar:
```ebnf
Expression    := Comparison
Comparison    := Additive ( (">" | "<" | ">=" | "<=" | "==" | "!=" | "=") Additive )?
Additive      := Term ( ("+" | "-") Term )*
Term          := Factor ( ("*" | "/") Factor )*
Factor        := ("+" | "-")? Primary
Primary       := NUMBER 
               | "(" Expression ")" 
               | FUNCTION "(" Expression ("," Expression)* ")"
               | IDENTIFIER
```

### Supported Functions:
1. `MIN(a, b, ...)`: Minimum of one or more decimal values.
2. `MAX(a, b, ...)`: Maximum of one or more decimal values.
3. `ROUND(val, [decimals])`: Exact decimal rounding using `ROUND_HALF_UP` (default 2 decimals).
4. `CEIL(val)`: Rounds to nearest integer upwards.
5. `FLOOR(val)`: Rounds to nearest integer downwards.
6. `ABS(val)`: Absolute value of expression.
7. `IF(condition, trueExpr, falseExpr)`: Evaluates conditional branch. Returns `trueExpr` if condition evaluates to non-zero, else `falseExpr`.

---

## 4. TOPOLOGICAL SORTING & CIRCULAR DEPENDENCY INTERCEPTION

To resolve formulas with interdependent lines, the calculation engine builds a directed acyclic graph (DAG) where nodes are components and directed edges represent dependencies ($A \rightarrow B$ means component $B$ requires component $A$).

### Cycle Detection Algorithm:
The engine uses Depth-First Search (DFS) with a recursion stack. If an ancestor node in the active recursion stack is revisited, a circular dependency is detected and the exact cycle path is extracted:
$$\text{Component } A \longrightarrow \text{Component } B \longrightarrow \text{Component } C \longrightarrow \text{Component } A$$
Any attempt to save or calculate this structure is immediately blocked with an actionable error.

### Topological Execution Order (Kahn's Algorithm):
1. In-degrees of all components are computed based on explicit base component codes and extracted AST formula variables.
2. Components with zero in-degrees (independent constants or fixed amounts like Basic) are enqueued first.
3. As each component is emitted, the in-degrees of dependent components are decremented.
4. When a dependent component reaches zero in-degree, it is processed.

```
[CTC: 12,00,000] ──> BASIC (50,000) ──> HRA (40% of BASIC = 20,000)
                              │                      │
                              └───────┬──────────────┘
                                      ▼
                        SPECIAL_ALLOWANCE (Balancing: 30,000)
                                      ▼
                           GROSS EARNINGS (1,00,000)
```

---

## 5. COMPLETE SALARY CALCULATION FLOW

For every employee in a payroll period, the engine computes:

### 1. Attendance & Proration:
$$\text{Payable Days} = \text{Calendar Days} - \text{Unpaid Mid-Month Days} - \text{Loss of Pay (LOP) Days}$$
$$\text{Proration Ratio} = \frac{\text{Payable Days}}{\text{Calendar Days}}$$

### 2. Monthly Earnings:
- Each component in the topological sequence evaluates against the current formula context (`CTC`, `ANNUAL_CTC`, `MONTHLY_CTC`, `MONTHLY_GROSS`, `CALENDAR_DAYS`, `PAYABLE_DAYS`, `PRORATION_RATIO`, and all previously resolved component values).
- If attendance is prorated, fixed allowances apply the ratio:
$$\text{Calculated} = \text{Unprorated} \times \frac{\text{Payable Days}}{\text{Calendar Days}}$$

### 3. Gross Earnings:
$$\text{Gross Pay} = \sum \text{Calculated Earnings} + \text{Arrears} + \text{Overtime} + \text{Reimbursements} + \text{One-Time Earnings}$$

### 4. Statutory Deductions:
- **Employee PF (12%):**
  - If `CEILING_15000`: $\min(15000 \times \text{Ratio}, \text{Basic}) \times 12\%$
  - If `ACTUAL_BASIC`: $\text{Basic} \times 12\%$
  - If `EXEMPT`: ₹0.00
- **Employee ESIC (0.75%):**
  - Applicable if gross wage $\le$ ₹21,000. Rounding: `ceil()` to next integer rupee.
- **Professional Tax (PT):**
  - State slab evaluation (e.g. Maharashtra ₹200/month; February ₹300 surcharge).
- **TDS / Income Tax:**
  - Annual taxable income projection under New Regime (Section 115BAC) or Old Regime with 80C/80D declarations, or explicit `tdsMonthlyOverride`.

### 5. Other Deductions & Loan Recoveries:
- **Loan EMI Recovery:**
$$\text{Deduction} = \min(\text{Monthly EMI}, \text{Outstanding Principal})$$
  Automatically discontinued when balance reaches ₹0.00.
- **One-Time Deductions:** Authorized recoveries applied to employee deductions.

### 6. Net Take-Home Salary:
$$\text{Net Pay} = \text{Gross Earnings} - \text{Total Employee Deductions}$$

### 7. Total Employer Cost (CTC):
$$\text{Employer Cost} = \text{Gross Earnings} + \text{Employer PF (12%)} + \text{Employer ESIC (3.25%)} + \text{Gratuity Provision (4.81% of Basic)}$$

---

## 6. CALCULATION TRACEABILITY & AUDIT SNAPSHOT

Every generated `CorporatePayrollSlip` persists a complete JSON snapshot in `calculationSnapshot`:
- **Salary Structure Version:** Structure ID and version number applied.
- **Attendance Inputs:** Calendar days, payable days, LOP days, unpaid mid-month days, and proration ratio.
- **Formula Context:** Exact numeric inputs available during evaluation.
- **Component Breakdown:** Component code, name, category, configured monthly amount, calculated amount, statutory basis, and rule applied.
- **Policy Flags:** PF status, wage basis, ESIC applicability, PT state, and tax regime.
- **Exceptions:** Overtime inclusion, LOP adjustments, February surcharge, negative net pay alerts.
- **Audit Metadata:** Server timestamp, user ID, and calculation run number.

Authorized reviewers can inspect this snapshot directly in the **Payroll Processing** view via the slide-out **Calculation Audit** drawer.
