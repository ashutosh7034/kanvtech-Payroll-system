# PAYFLOW — Role-Based User Acceptance Testing (RBAC UAT) Report

**Document Reference**: `docs/audits/PAYFLOW_ROLE_BASED_UAT.md`  
**Execution Timestamp**: `2026-10-26T12:35:00+05:30`  
**Lead Auditor**: Senior Application Security Tester & Release Auditor  
**Status**: `VERIFIED & CERTIFIED`

---

## 1. Overview & Evaluation Principles

The purpose of this evaluation is to verify that PAYFLOW enforces strict role-based access control (RBAC), tenant isolation, and Segregation of Duties (SOD).

### Testing Principles:
1. **Dynamic UI Masking**: If a user lacks permission to access an operational area, button, action, or tab, the UI completely hides that item without flashing or leaking context.
2. **Independent Backend Authorization**: The frontend hiding an item is never treated as a security control; every REST API endpoint enforces authorization independently.
3. **Segregation of Duties (SOD)**: Consequential operations (batch calculation vs batch approval, loan request vs loan sanctioning, leave request vs approval, expense submission vs approval) strictly prohibit self-approval.
4. **Tenant Isolation**: Users belonging to Company Alpha cannot view, update, calculate, or approve records belonging to Company Beta.

---

## 2. Tested Personas & Role Matrix

| Persona ID | System Role Name | Test Account Credentials | Permitted Domains | Prohibited Domains |
|:---|:---|:---|:---|:---|
| **PER-01** | `employee` | `rahul.mehta` / `Admin@123` | ESS Dashboard, Leave Request, Punch Attendance, Submit Claims, View Own Payslips | Salary Master, Payroll Workbench, Employee Master, RBAC Dashboard |
| **PER-02** | `hr_manager` | `hr.manager` / `Admin@123` | Employee Master, Leave Approvals, Attendance Regularization, Draft Payroll Batch | Self-Approval of Payroll, Sanctioning Own Loans, System Admin |
| **PER-03** | `finance_lead` | `finance.lead` / `Admin@123` | Review Payroll Variance, Approve Batch (Checker), Export Bank Advice, UTR Entry | Initiating Payroll Drafts (Maker SOD), Employee Resignations |
| **PER-04** | `company_admin` | `admin` / `Admin@123` | Pay Code Master, Formula Builder, RBAC Permissions, Company Settings | Self-Sanctioning Loans (`SEC-SOD-002`), Cross-Tenant Access |
| **PER-05** | `auditor` | `auditor.user` / `Admin@123` | View Salary Registers, Audit Logs, Tax Deductions (Read-Only) | All POST, PUT, PATCH, DELETE mutating endpoints |

---

## 3. Persona UAT Scenario Execution & Results

### Persona 1: Standard Employee (`employee`)

| Scenario ID | Test Workflow / Action | Expected Result | Actual Result | Status |
|:---:|:---|:---|:---|:---:|
| **UAT-EMP-01** | Login and view navigation sidebar | Only ESS and Claims links visible; Admin/Payroll modules omitted. | Sidebar displays only Dashboard, Self-Service, and Claims. | `PASS` |
| **UAT-EMP-02** | Direct browser URL navigation to `/payroll` | Route guard displays `AccessDeniedView` with required permission info. | Clean access denied page rendered; zero confidential batch data rendered. | `PASS` |
| **UAT-EMP-03** | Attempt API request: `POST /api/v1/payroll/runs/draft` | Request rejected with HTTP 403 Forbidden. | HTTP 403 returned: `Access denied. Requires one of roles: company_admin, hr_manager`. | `PASS` |
| **UAT-EMP-04** | View own payslip catalog | Returns payslips belonging to authenticated user only. | All returned slips match `employeeId`. | `PASS` |
| **UAT-EMP-05** | Attempt API request: `GET /api/v1/self-service/payslips/:peerId` | Request rejected with HTTP 403 Forbidden. | HTTP 403 returned: `Access denied: You are not authorized to view another employee’s payslip`. | `PASS` |
| **UAT-EMP-06** | Submit reimbursement claim with receipt | Receipt stored as base64 asset; claim created with status `PENDING`. | Claim created; HR reviewers notified in-app. | `PASS` |
| **UAT-EMP-07** | Query peer timesheets via `GET /timesheets/entries?employeeId=...` | Request rejected with HTTP 403 Forbidden (DEF-01). | HTTP 403 returned: `Access denied: You are not authorized to view another employee’s timesheet entries`. | `PASS` |
| **UAT-EMP-08** | Query peer leave balances via `GET /leave/balances?employeeId=...` | Request rejected with HTTP 403 Forbidden (DEF-06). | HTTP 403 returned: `Access denied: You are not authorized to view another employee’s leave balances`. | `PASS` |

---

### Persona 2: HR Manager (`hr_manager`)

| Scenario ID | Test Workflow / Action | Expected Result | Actual Result | Status |
|:---:|:---|:---|:---|:---:|
| **UAT-HR-01** | Employee master directory management | Can view, search, and update employee records and assign CTC structures. | Employee roster loaded; updates persist cleanly. | `PASS` |
| **UAT-HR-02** | Initialize monthly payroll batch (`DRAFT`) | Payroll run created in `DRAFT` status with audit timestamp. | Batch created; run status is `DRAFT`. | `PASS` |
| **UAT-HR-03** | Run attendance & roster validation (`VALIDATED`) | Batch transitions to `VALIDATED` and checks payable days. | Validation checks pass; transition succeeds. | `PASS` |
| **UAT-HR-04** | Calculate monthly payroll (`CALCULATED`) | Batch transitions to `CALCULATED`; AST engine computes slips. | AST engine computes gross, deductions, and net pay. | `PASS` |
| **UAT-HR-05** | Attempt to Approve own calculated batch | Request rejected due to Segregation of Duties. | HTTP 403 returned: `Segregation of duties: Maker cannot approve their own payroll run`. | `PASS` |
| **UAT-HR-06** | Approve employee reimbursement claims | Can approve peer claims; cannot approve own claims. | Peer claim approved; own claim approval rejected (403). | `PASS` |

---

### Persona 3: Finance Lead (`finance_lead`)

| Scenario ID | Test Workflow / Action | Expected Result | Actual Result | Status |
|:---:|:---|:---|:---|:---:|
| **UAT-FIN-01** | Review payroll variance on calculated batch | Can inspect earnings, tax withholdings, and loan repayments. | Variance table renders; flags highlighted. | `PASS` |
| **UAT-FIN-02** | Independent Checker Approval (`APPROVED`) | Batch transitions from `REVIEWED` to `APPROVED`. | Batch approved; `approvedBy` and `approvedAt` recorded. | `PASS` |
| **UAT-FIN-03** | Prepare Bank Advice (`PAYMENT_READY`) | Batch transitions to `PAYMENT_READY`. | Transition succeeds. | `PASS` |
| **UAT-FIN-04** | Download NEFT bank advice CSV | Export CSV contains beneficiary account numbers, IFSC codes, and net pay. | CSV downloads; total amount matches batch net pay. | `PASS` |
| **UAT-FIN-05** | Attempt to activate own employee loan without override | Request rejected due to self-sanctioning prohibition (`SEC-SOD-002`). | HTTP 403 returned: `Self-sanctioning prohibited`. | `PASS` |

---

### Persona 4: Company Administrator (`company_admin`)

| Scenario ID | Test Workflow / Action | Expected Result | Actual Result | Status |
|:---:|:---|:---|:---|:---:|
| **UAT-ADM-01** | Configure Salary Column Master | Add component, configure AST formula, validate syntax. | Formula AST validates syntax; saves component. | `PASS` |
| **UAT-ADM-02** | Centralized RBAC Permissions Management | Can toggle module permissions for any role; updates persist. | Role permissions updated via PATCH; UI updates dynamically. | `PASS` |
| **UAT-ADM-03** | Record Bank Settlement Reference (`PAID`) | Record UTR `HDFC1234567890`; batch transitions to `PAID`. | Batch locked; status updated to `PAID`. | `PASS` |
| **UAT-ADM-04** | Attempt to recalculate `PAID` batch | Request strictly rejected. | HTTP 400 returned: `Payroll for this period is already PAID and locked`. | `PASS` |

---

### Persona 5: Cross-Tenant Isolation Boundaries

| Scenario ID | Test Workflow / Action | Expected Result | Actual Result | Status |
|:---:|:---|:---|:---|:---:|
| **UAT-TEN-01** | Tenant B Admin attempts to validate Tenant A run | Request rejected with HTTP 404 / 403. | HTTP 404 returned: `Run not found`. | `PASS` |
| **UAT-TEN-02** | Tenant B Admin attempts to calculate Tenant A run | Request rejected with HTTP 404 / 403. | HTTP 404 returned: `Run not found`. | `PASS` |
| **UAT-TEN-03** | Tenant B Admin attempts to approve Tenant A run | Request rejected with HTTP 404 / 403. | HTTP 404 returned: `Run not found`. | `PASS` |
| **UAT-TEN-04** | Tenant B Admin attempts to view Tenant A loan | Request rejected with HTTP 404 / 403. | HTTP 404 returned: `Loan not found in your organization`. | `PASS` |
| **UAT-TEN-05** | Tenant B Admin attempts to approve Tenant A claim | Request rejected with HTTP 404 / 403. | HTTP 404 returned: `Expense claim not found or does not belong to your company`. | `PASS` |
