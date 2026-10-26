# Corporate HRMS & Payroll Engine: System Architecture

## 1. System Overview

The Corporate HRMS & Payroll Engine is an enterprise-grade human capital and compensation management system inspired by platforms such as Spine Payroll. It is engineered to deliver deterministic, auditable, decimal-accurate financial operations backed by PostgreSQL, Prisma ORM, Node.js, and React.

```
                    ┌────────────────────────────────────────────────────────┐
                    │               React 19 Enterprise Client               │
                    │ (Vite / TypeScript / Tailored CSS / Dynamic Workbench) │
                    └───────────────────────────┬────────────────────────────┘
                                                │ REST API (Bearer JWT)
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Express.js API Gateway                                     │
│  ┌───────────────────────┬──────────────────────┬──────────────────────┬────────────────┐  │
│  │ Auth & RBAC Guard     │ Tenant Isolation     │ Audit Event Logger   │ Error Boundary │  │
│  └───────────────────────┴──────────────────────┴──────────────────────┴────────────────┘  │
└───────────────────────────────────────────────┬────────────────────────────────────────────┘
                                                │
         ┌──────────────────────────────────────┼──────────────────────────────────────┐
         ▼                                      ▼                                      ▼
┌─────────────────────────┐          ┌─────────────────────────┐            ┌────────────────────────┐
│   Compensation Master   │          │    Payroll Engine       │            │  Self-Service & Export │
│ ─────────────────────── │          │ ─────────────────────── │            │ ────────────────────── │
│ • AST Formula Engine    │          │ • 7-Stage State Machine │            │ • Binary PDF Generator │
│ • CTC Builder 2-Pass    │          │ • Decimal.js Arithmetic │            │ • Formula-Safe CSV     │
│ • Effective Revisions   │          │ • Attendance Proration  │            │ • Masked ESS Profile   │
│ • Component Master      │          │ • Statutory Deductions  │            │ • Bank Advice Export   │
└────────────┬────────────┘          └────────────┬────────────┘            └───────────┬────────────┘
             │                                    │                                     │
             └────────────────────────────────────┼─────────────────────────────────────┘
                                                  ▼
                                ┌───────────────────────────────────┐
                                │       Prisma ORM Client           │
                                └─────────────────┬─────────────────┘
                                                  ▼
                                ┌───────────────────────────────────┐
                                │     PostgreSQL 15 Database        │
                                │ (Transactions / ACID Constraints) │
                                └───────────────────────────────────┘
```

---

## 2. Core Data Models and Relationships

The database architecture is designed with strict relational integrity, foreign key cascading, and versioned snapshots:

1. **Company (`Company`)**:
   - Master multi-tenant root entity. All child tables (`Employee`, `SalaryComponent`, `SalaryTemplate`, `CorporatePayrollRun`) include `companyId` with foreign key indexes for isolation.

2. **Employee (`Employee`)**:
   - Core human capital record linked to `Department`, `Designation`, `Branch`, and `JobBand`.
   - Links 1:1 with `EmployeePayrollPolicy` and `EmployeeSalaryStructure`.
   - Maintains bank details (`bankName`, `bankAccountNumber`, `ifscCode`) with privileged masking.

3. **Salary Component Master (`SalaryComponent`)**:
   - Configurable compensation elements with `code`, `name`, `type` (`EARNING`, `DEDUCTION`, `EMPLOYER_STATUTORY`), `category` (`FIXED_EARNING`, `VARIABLE_EARNING`, `REIMBURSEMENT`, `STATUTORY_DEDUCTION`, `EMPLOYER_CONTRIBUTION`), `calculationMode` (`FIXED_AMOUNT`, `PERCENTAGE_OF_COMPONENT`, `FORMULA_EXPRESSION`), formula expressions, statutory gross inclusion flags, and payslip visibility.

4. **Salary Template & Lines (`SalaryTemplate`, `SalaryTemplateLine`)**:
   - Reusable compensation structures for job grades and bands.
   - Versioned revisions enabled through clone endpoints.

5. **Employee Salary Structure (`EmployeeSalaryStructure`, `EmployeeSalaryLine`, `EmployeeSalaryRevision`)**:
   - Active compensation assigned to an individual employee with effective dates and annual CTC.
   - Revisions preserve an immutable historical JSON snapshot before superseding.

6. **Corporate Payroll Run & Slips (`CorporatePayrollRun`, `CorporatePayrollSlip`, `CorporatePayrollItem`)**:
   - Enforces a 7-stage state machine for a specific pay period.
   - Each slip stores immutable calculation snapshot data, payable days, LOP days, statutory basis, gross pay, deductions, net pay, and itemized component rows.

7. **State Transitions & Auditing (`CorporatePayrollTransition`, `PayrollAuditTrail`)**:
   - Records actor ID, timestamp, from-status, to-status, and payload for every state advance and compliance update.

---

## 3. Safe Formula Evaluation Engine (`formulaEngine.ts`)

The formula engine evaluates dynamic salary components without using `eval` or arbitrary JavaScript execution:

1. **Tokenization (Lexer)**:
   - Breaks mathematical expressions into structured tokens: `NUMBER`, `IDENTIFIER`, `OPERATOR` (`+`, `-`, `*`, `/`), `LPAREN`, `RPAREN`, `COMMA`.
   - Rejects unapproved characters and malicious syntax.

2. **Recursive Descent Parser (AST)**:
   - Enforces mathematical operator precedence:
     - `parseExpression()` handles addition and subtraction.
     - `parseTerm()` handles multiplication and division.
     - `parseFactor()` handles numbers, parentheses, functions, and variable lookups.
   - Strictly enforces division-by-zero guards (`if (divisor.isZero()) throw Error('Division by zero')`).
   - Supports built-in financial helper functions: `MIN(...)`, `MAX(...)`, `ROUND(val, decimals)`, `CEIL(val)`, `FLOOR(val)`.

3. **Topological Dependency & Circular Reference Detection**:
   - Constructs a directed graph of component formulas.
   - Evaluates components in topological order.
   - Uses depth-first search (`dfs`) with recursion stack tracking to detect direct and indirect cycles (e.g. `A = B + 10; B = C * 2; C = A - 5`), returning the exact cycle path before configuration is saved.

---

## 4. Authoritative Payroll Calculation Pipeline (`calculationEngine.ts`)

Authoritative financial calculations occur exclusively on the backend using `Decimal.js` (no floating-point rounding errors):

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Attendance & Proration                                              │
│    • Calendar Days (e.g. 30/31)                                        │
│    • Paid Days = Present + Paid Leaves                                 │
│    • LOP Days = Unpaid Leaves + Absent                                 │
│    • Proration Ratio = (Calendar Days - LOP Days) / Calendar Days      │
│    • Mid-Month Joining / Exit adjustment                               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. Fixed & Variable Gross Earnings Calculation                         │
│    • Evaluate assigned salary structure components                     │
│    • Apply component proration: calculatedAmount = monthly * ratio     │
│    • Calculate Overtime: (Basic / [CalendarDays * 8]) * OT_Hrs * 2.0   │
│    • Add approved finance reimbursements & retroactive arrears         │
│    • Gross Pay = Sum(Fixed Earnings) + OT + Arrears + Reimbursements   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. Statutory Deductions                                                │
│    • EPF Employee: min(15,000 * ratio, basic) * 12% (if APPLICABLE)    │
│    • ESIC Employee: Gross * 0.75% (rounded up to next ₹1)              │
│    • Professional Tax: State-specific slabs + Feb ₹300 surcharge       │
│    • TDS Withholding: New Regime Section 115BAC slabs or override      │
│    • Active Loan Recoveries: min(monthlyEmi, outstandingPrincipal)     │
│    • Total Deductions = EPF + ESIC + PT + TDS + Loans                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 4. Net Take-Home & Employer Cost                                       │
│    • Net Pay = Gross Pay - Total Deductions                            │
│    • Employer EPF: Equal to employee EPF (or 3.67% EPF + 8.33% EPS)    │
│    • Employer ESIC: Gross * 3.25% (rounded up to next ₹1)              │
│    • Employer Cost = Gross Pay + Employer EPF + Employer ESIC          │
│    • Immutable Snapshot recorded with trace & exceptions               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Seven-Stage Payroll State Machine

The workbench enforces valid sequential state transitions on the backend:

```
[DRAFT] ───► [VALIDATED] ───► [CALCULATED] ───► [REVIEWED] ───► [APPROVED] ───► [PAYMENT_READY] ───► [PAID]
```

- **`DRAFT`**: Initializes cycle for pay period and branch scope.
- **`VALIDATED`**: Pre-run audit verifying salary assignment, attendance, active policies, and bank verification.
- **`CALCULATED`**: Executes batch calculation for eligible employees and records itemized slips.
- **`REVIEWED`**: Variance analysis, gross-to-net reconciliation, exception review.
- **`APPROVED`**: Role-gated dual control; freezes inputs and outputs.
- **`PAYMENT_READY`**: Exports bank advice instructions; prohibits duplicate payment runs.
- **`PAID`**: Records bank transaction reference (UTR) and releases payslips to ESS.

Transitions require database transactions, role authorization, and state logging. Skipped transitions (e.g. `DRAFT` to `PAID`) are rejected with HTTP 400.

---

## 6. Application Security and Privacy Boundaries

1. **Role-Based Access Control (RBAC)**:
   - Strict middleware gates endpoints: `company_admin`, `payroll_admin`, `payroll_processor`, `finance_admin`, `hr_manager`, `employee`.
2. **Confidential Bank Details Masking**:
   - Regular employees querying `/api/v1/employees` receive masked account numbers (`••••••••1234`).
3. **Self-Service Ownership Enforcement**:
   - `GET /api/v1/self-service/payslips/:id` verifies `slip.employeeId === req.user.employeeId`. Cross-employee access attempts return HTTP 403 Forbidden.
4. **CSV Injection Protection**:
   - All spreadsheet exports sanitize cells starting with `=`, `+`, `-`, `@`, `\t`, or `\r` by prepending a single quote (`'`).
5. **Binary PDF Generation**:
   - Payslips are rendered dynamically into PDF binary buffers via `PDFKit` using real persisted database records.
