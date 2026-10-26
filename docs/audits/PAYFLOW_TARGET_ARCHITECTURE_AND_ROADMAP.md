# PAYFLOW — Target Architecture, Phased Roadmap & Design Specification

**Document Reference**: `PAYFLOW-TARGET-ARCH-006`  
**Execution Timestamp**: `2026-10-26T11:55:00+05:30`  
**Platform**: PAYFLOW Enterprise Payroll System  
**Status**: `VERIFIED & ROADMAPPED`

---

## 1. Architectural Principles

1. **Build PAYFLOW as PAYFLOW**: Preserve PAYFLOW's strengths (TypeScript, React, PostgreSQL, Decimal.js, AST Formula Engine) while incorporating product patterns from Spine HRNG and Saral PayPack.
2. **Deterministic Financial Math**: Pure-decimal arithmetic for all salary components, deductions, tax withholdings, and loan recoveries. Zero IEEE 754 floating-point inaccuracies.
3. **Strict State Immutability**: Historical payroll runs once `PAID` are permanently locked against in-place mutations. Any retrospective adjustments must flow through audited adjustment lines or formal arrears runs.
4. **Segregation of Duties (SOD)**: Separation between calculation, review, approval, and payment instruction release.
5. **Multi-Tenant Isolation**: Authoritative tenant scoping on every route, query, notification, and document attachment.

---

## 2. Proposed Phased Roadmap

### Phase 1: Core Foundation & Feature Parity (COMPLETED & VERIFIED)
- **Expenses & Reimbursements Separation**: Separate `Submit Expense` vs `Submit Reimbursement` pathways, receipt document uploads, and claim resubmission workflow.
- **Hierarchical Claim Management**: Claim-driven employee list, employee profile drawer, and action controls.
- **7-Stage Payroll Studio Simplification**: Plain enterprise terminology, period selection, live metrics, visual stepper, and contextual action buttons.
- **Admin-Controlled Payroll Permissions Dashboard**: Granular RBAC across 7 categories, role templates, and SOD warnings.
- **Status**: `COMPLETED (15 TEST SUITES PASSED — 289 / 289 TESTS)`

---

### Phase 2: Advanced Compensation & Structure Operations (RECOMMENDED NEXT PHASE)
- **Salary Structure Sheet Mode Spreadsheet View**:
  - Add a fast 4-column balanced spreadsheet view (Allowances, Deductions, Variables, Attendance) inside Compensation View inspired by Spine's Sheet Mode (`Screenshot image.png`).
- **Proposed vs. Approved Salary Structure Workflows**:
  - Introduce formal approval lifecycle for salary revisions: HR proposes revision → Executive approves → Becomes active for subsequent payroll runs.
- **Bulk Variable Import / Export for Monthly Salary Editor**:
  - Enhance `MonthlySalaryEditorModal.tsx` with one-click Excel template download and CSV upload for bulk attendance adjustments and incentives, mirroring Saral PayPack's `Entry` tab.

---

### Phase 3: Retrospective Engines & Financial Integrations (PHASE 3)
- **Multi-Period Retrospective Arrears Engine**:
  - Provide a formal Arrears calculation engine (`From Month` to `To Month`, `Pay In Month`) that evaluates the difference between original payslips and revised salary structures, generating an itemized `ARREARS` head.
- **Tally-Compatible Journal Voucher (JV) Export**:
  - Export monthly payroll accounting entries in Tally-compliant XML / Excel format, mapping salary components to organization GL codes (e.g., Salary Expense Debit, PF Payable Credit, Bank Disbursement Credit).

---

### Phase 4: Actuarial Statements & Enterprise Governance (PHASE 4)
- **Formal Gratuity Actuarial Statement**:
  - Generate statutory Gratuity calculation statements under Payment of Gratuity Act, 1972 (`(15 * Last Drawn Basic * Years of Service) / 26`).
- **Periodic Shadow Payroll Execution Pipeline**:
  - Automated parallel shadow payroll runner to verify payroll calculation parity against historical legacy runs before cutover.

---

## 3. Essential Questions Requiring Business Confirmation

To ensure business alignment on future phases, the following three specific questions are recorded:

1. **Arrears Disbursal Policy**:
   - When retroactive salary increments span multiple months, does the organization require arrears to be taxed at marginal rates in the payout month, or should Form 10E Section 89 relief calculations be automatically projected?
2. **General Ledger Mapping**:
   - For the Tally Journal Voucher export, does the organization maintain distinct cost-center-level GL accounts for departments/branches, or is a centralized company-wide chart of accounts used?
3. **Gratuity Forfeiture Rules**:
   - In the Full & Final settlement statement, should gratuity eligibility automatically enforce the statutory 5-year continuous service rule (excepting death/disability), or does the company policy provide contractual gratuity earlier?
