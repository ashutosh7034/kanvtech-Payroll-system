# PAYFLOW — Combined Manual UAT & Acceptance Test Report

**Document ID**: `PAYFLOW-UAT-COMBINED-001`  
**Execution Timestamp**: `2026-10-26T11:47:00+05:30`  
**Environment**: Local Development & Synthetic Staging Testbed (Ports 4000 & 5173)  
**Status**: `VERIFIED & ACCEPTED (100% PASS)`

---

## 1. Executive Summary

This report documents the end-to-end User Acceptance Testing (UAT) executed across the three master deliverables:
1. **Expenses & Reimbursements Redesign**: Distinct workflows, receipt uploads, claim correction lifecycle, and claim-driven HR hierarchical management.
2. **7-Stage Payroll Workflow Simplification**: Plain enterprise language, period selection, live metrics, visual stepper, and contextual action buttons.
3. **Admin-Controlled Payroll Permissions Dashboard**: Granular permission management across 7 categories, standard role templates, and Segregation of Duties (SOD) alerts.

All test scenarios were executed with synthetic staging data. No production funds were disbursed, no real statutory filings were made, and no database records were truncated.

---

## 2. Expense & Reimbursement UAT Execution

| # | UAT Scenario | Step-by-Step Procedure | Expected Result | Actual Result | Status |
|:---:|:---|:---|:---|:---|:---:|
| **E-01** | Employee Self-Service Navigation | 1. Sign in as employee (`ananya.verma` / `Admin@123`).<br>2. Navigate to ESS Dashboard (`/`). | Both `+ Submit Expense` and `+ Submit Reimbursement` buttons are visible with separate lists. | Both buttons render properly; separate tabs for My Expenses and My Reimbursements active. | `PASS` |
| **E-02** | Submit Single Expense (Receipt Optional) | 1. Click `+ Submit Expense`.<br>2. Select category `Travel Expense`.<br>3. Enter date, amount `₹2,200`, remarks.<br>4. Leave receipt empty.<br>5. Click `Submit Expense Claim`. | Claim is created with reference `EXP-2026-XXXX`. Total amount validated server-side. | Claim `EXP-2026-0001` created successfully with status `PENDING`. | `PASS` |
| **E-03** | Submit Expense with Receipt Upload | 1. Click `+ Submit Expense`.<br>2. Upload `invoice.pdf` (Base64).<br>3. Submit claim. | Document uploaded securely to `uploads/expenses/`. Claim references secure attachment URL. | Receipt uploaded with secure URL `/api/v1/expenses/attachments/...`; viewable via authenticated endpoint. | `PASS` |
| **E-04** | Disallowed File Type Upload | 1. Select `script.exe` or `.bat` file for upload. | Rejected immediately with clear error message: *Only JPEG, PNG, WEBP, and PDF files are allowed*. | Validation error displayed; file rejected. | `PASS` |
| **E-05** | Submit Multi-Item Reimbursement | 1. Click `+ Submit Reimbursement`.<br>2. Add 2 line items: Local travel (`₹1,500`) and Client stationery (`₹850`).<br>3. Submit voucher. | Claim generated with `REIM-2026-XXXX` and server-summed total `₹2,350`. | Reconciled correctly; voucher created with status `PENDING`. | `PASS` |
| **E-06** | HR Reviewer Claim-Driven Employee List | 1. Sign in as HR Reviewer (`hr.manager` / `Admin@123`).<br>2. Navigate to `Expenses & Travel` (`/expenses`).<br>3. Switch to *Claim-Driven Employees* view. | Shows only employees with active submitted claims. Excludes employees with 0 claims. | List displays Ananya Verma with claim count, pending amount, and total claimed. Non-claimants excluded. | `PASS` |
| **E-07** | Reviewer Requests Corrections | 1. Open Ananya's claim detail drawer.<br>2. Click `Request Corrections`.<br>3. Supply reason: *Please attach official GST invoice*. | Status transitions to `CORRECTION_REQUESTED`. Employee is notified. | Status updated; audit history records reviewer name, timestamp, and justification. | `PASS` |
| **E-08** | Employee Claim Resubmission | 1. Sign in as employee (`ananya.verma`).<br>2. Open flagged claim.<br>3. Notice edit form enabled.<br>4. Add GST invoice notes and click `Resubmit Corrected Claim`. | Claim status transitions back to `PENDING`. Resubmission timestamp recorded. | Status returns to `PENDING`. Reviewers notified of resubmission. History preserved. | `PASS` |
| **E-09** | Segregation of Duties (Self-Approval Prohibited) | 1. Sign in as user who submitted a claim.<br>2. Attempt to approve own claim. | Blocked with `403 Forbidden` (`Segregation of duties: You cannot approve your own expense claim`). | Prohibited by server; action rejected cleanly. | `PASS` |

---

## 3. Payroll Workflow Simplification UAT Execution

| # | UAT Scenario | Step-by-Step Procedure | Expected Result | Actual Result | Status |
|:---:|:---|:---|:---|:---|:---:|
| **P-01** | Redesigned Payroll Studio Dashboard | 1. Sign in as Payroll Lead (`payroll.admin` or `admin`).<br>2. Open Payroll Studio (`/payroll`). | Plain enterprise terminology displayed: *Monthly Payroll Runs*, *Salary Review & Editor*, *Income Tax & TDS*. | All simplified labels render without confusing technical jargon. | `PASS` |
| **P-02** | Prominent Period Selector & Financial Summary | 1. Select active calendar month (e.g. *October 2026*). | Header highlights month, FY 2026-27, cutoff date, and 6 summary cards with actual data. | Cards render accurate figures for Enrolled, Calculated, Attention Required, Gross, Deductions, Net Pay. | `PASS` |
| **P-03** | 7-Stage Visual Stepper | 1. Open details for active payroll run. | Interactive stepper displays Stages 1-7 with real-time status highlights and timestamps. | Stepper reflects current stage accurately with intuitive icons and completion checkmarks. | `PASS` |
| **P-04** | Actionable Validation Error Resolution | 1. Trigger validation on run containing unconfigured CTC structure. | Displays clear amber warning card indicating affected employee and 1-click link to resolve. | Actionable guidance displayed explaining exact reason calculation cannot proceed. | `PASS` |
| **P-05** | Contextual Next Actions | 1. Inspect action bar at each stage (Draft, Validated, Calculated, Reviewed, Approved, Payment Ready). | Displays only the valid next action permissible for the user's role. | Unqualified actions are completely hidden from UI. | `PASS` |
| **P-06** | Stage 7 Settlement Finalization | 1. Sign in as Finance Lead (`finance.lead`).<br>2. Record bank UTR `UTR-2026-NEFT-991204`.<br>3. Finalize run. | Run transitions to `PAID`. Slips become accessible to employees in ESS. | Slips released to ESS; run locked from recalculation. | `PASS` |

---

## 4. Payroll Access & Permissions Dashboard UAT Execution

| # | UAT Scenario | Step-by-Step Procedure | Expected Result | Actual Result | Status |
|:---:|:---|:---|:---|:---|:---:|
| **R-01** | Admin Navigation to Permissions Dashboard | 1. Sign in as Company Admin (`admin`).<br>2. Navigate to `Admin Dashboard → Access Control → Payroll Permissions`. | Permission management dashboard loads with user search, role list, and permission groups. | Accessible under `/payroll-permissions`; renders full matrix. | `PASS` |
| **R-02** | Non-Admin Access Prevention | 1. Sign in as standard employee (`ananya.verma`).<br>2. Attempt direct route access to `/payroll-permissions`. | Blocked by client-side Route Guard and redirected to dashboard with access alert. | Protected route rejects navigation cleanly; unauthorized UI hidden. | `PASS` |
| **R-03** | User Search & Effective Permissions Inspection | 1. Search for user `finance.lead` or `rohit.sharma`.<br>2. Select user. | Displays assigned roles, inherited role permissions, and active permissions. | Displays accurate permissions mapped to selected user. | `PASS` |
| **R-04** | Granular Permission Modification & Role Update | 1. Toggle `payroll:view_employee_details` for target role.<br>2. Click `Save Permissions`. | API `PATCH /rbac/roles/:id/permissions` updates database and records audit log. | Server returns `200 OK`; audit log `UPDATE_ROLE_PERMISSIONS` recorded. | `PASS` |
| **R-05** | Role Template 1-Click Application | 1. Select role.<br>2. Click `Apply Template` → `Payroll Administrator`. | Pre-populates all standard operational permissions with SOD safety review. | Standard permissions applied instantly to permission checkboxes. | `PASS` |
| **R-06** | Segregation of Duties (SOD) Conflict Alert | 1. Select both `payroll:calculate` and `payroll:approve` on the same profile. | Displays prominent amber warning badge alerting administrator to SOD violation. | SOD alert banner renders with explicit conflict description. | `PASS` |
| **R-07** | Direct API Tamper Resistance | 1. Make direct curl/fetch `PATCH /rbac/roles/:id/permissions` with employee token. | Server returns `403 Forbidden` (`Access denied. Requires one of roles: company_admin, platform_admin`). | Verified: backend authorization cannot be bypassed by client-side tampering. | `PASS` |

---

## 5. UAT Signoff & Release Decision

- **Total UAT Scenarios**: 22
- **Passed Scenarios**: 22 (100%)
- **Failed Scenarios**: 0
- **Blocked Scenarios**: 0
- **Final Decision**: `APPROVED FOR PRODUCTION DEPLOYMENT`
