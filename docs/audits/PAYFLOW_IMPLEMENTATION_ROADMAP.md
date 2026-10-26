# PAYFLOW — Phased Implementation Roadmap & Feature Evolution Plan

**Document Reference**: `PAYFLOW-ROADMAP-003`  
**Execution Timestamp**: `2026-10-26T12:05:00+05:30`  
**Platform**: PAYFLOW Enterprise Payroll System  
**Status**: `VERIFIED & ROADMAPPED`

---

## 1. Phased Implementation Sequence

```
[Phase 1: Foundation Parity] ──> [Phase 2: Advanced Compensation] ──> [Phase 3: Retrospective Engines] ──> [Phase 4: Actuarial Reports]
(COMPLETED & VERIFIED)            • Sheet Mode Spreadsheet View        • Multi-Period Arrears Engine        • Gratuity Statements
• Expenses Separation             • Proposed vs Approved CTC           • Tally XML Journal Voucher          • Shadow Payroll Pipeline
• 7-Stage Payroll Engine          • Bulk Variable CSV Import/Export
• Admin RBAC Dashboard
```

### Phase 1: Core Foundation & Feature Parity (COMPLETED & VERIFIED)
- **Expenses & Reimbursements Separation**: Separate `Submit Expense` vs `Submit Reimbursement` pathways, receipt document uploads, and claim resubmission workflow.
- **Hierarchical Claim Management**: Claim-driven employee list, employee profile drawer, and reviewer action controls.
- **7-Stage Payroll Studio Simplification**: Plain enterprise terminology, period selection, live metrics, visual stepper, and contextual action buttons.
- **Admin-Controlled Payroll Permissions Dashboard**: Granular RBAC across 7 categories, role templates, and SOD warnings.
- **Verification**: 15 test suites passed (289 / 289 tests — 100% success rate).

---

### Phase 2: Advanced Compensation & Structure Operations (RECOMMENDED NEXT WORK PACKAGE)
1. **Salary Structure Sheet Mode Spreadsheet View**:
   - Provide a fast 4-column balanced spreadsheet view (Allowances, Deductions, Variables, Attendance) inside Compensation View inspired by Spine's Sheet Mode (`Screenshot image.png`).
2. **Proposed vs. Approved Salary Structure Workflows**:
   - Introduce formal maker-checker lifecycle for salary revisions: HR proposes revision → Executive approves → Becomes active for subsequent payroll runs.
3. **Bulk Variable Input Import / Export**:
   - Enhance `MonthlySalaryEditorModal.tsx` with one-click Excel template download and CSV upload for bulk attendance adjustments and incentives, mirroring Saral PayPack's `Entry` tab.

---

### Phase 3: Retrospective Engines & Financial Integrations
1. **Multi-Period Retrospective Arrears Engine**:
   - Automated Arrears calculation engine (`From Month` to `To Month`, `Pay In Month`) that evaluates the difference between original payslips and revised salary structures, generating an itemized `ARREARS` head.
2. **Tally-Compatible Journal Voucher (JV) Export**:
   - Export monthly payroll accounting entries in Tally-compliant XML / Excel format, mapping salary components to organization GL codes.

---

### Phase 4: Actuarial Statements & Enterprise Governance
1. **Formal Gratuity Actuarial Statement**:
   - Standalone Gratuity calculation statements under Payment of Gratuity Act, 1972 (`(15 * Last Drawn Basic * Years of Service) / 26`).
2. **Periodic Shadow Payroll Execution Pipeline**:
   - Automated parallel shadow payroll runner to verify payroll calculation parity against legacy outputs before cutover.
