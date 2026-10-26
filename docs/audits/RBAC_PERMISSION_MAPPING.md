# PAYFLOW — Role-to-Permission Mapping Matrix

**Specification ID:** MAP-PAYFLOW-RBAC-2026-10-26  
**Version:** 2.0 (Authoritative Dynamic RBAC)  
**Scope:** PayFlow Corporate Platform, Enterprise Modules, Navigation, Fields & Actions  

---

## 1. System Roles Overview

| Role Identifier | Role Display Name | Scope / Responsibility |
|---|---|---|
| `company_admin` | Company Administrator | Full institutional administration across all modules, permissions, users, and audit logs. |
| `platform_admin` | Platform Superadmin | Multi-tenant platform maintenance and administrative override. |
| `asset_manager` | IT Asset & Help Desk Manager | Company hardware inventory, asset lifecycle, custodian assignments, ticket resolution. |
| `hr_manager` | Human Resources Manager | Employee master, recruitment ATS, offboarding, leave approvals, attendance, policy administration. |
| `payroll_admin` | Payroll Administrator | Salary component master, CTC structures, 7-stage payroll engine, formula configuration. |
| `payroll_pcm` | Payroll Compliance Maker | Employee enrollment, attendance sync, draft payroll run preparation. |
| `finance_admin` | Finance / Disbursal Officer | Bank NEFT register review, payroll disbursement approval, F&F settlement payouts, loan sanction. |
| `department_manager` | Department Head / Reviewer | Team shift regularization, leave approval, team expense claim review. |
| `recruiter` | Talent Acquisition Specialist | Job openings, candidate pipeline management, interview evaluations. |
| `employee` | Institutional Employee | Self-service portal (ESS), attendance punching, personal claims, personal leave, IT helpdesk tickets. |

---

## 2. Comprehensive Role-to-Permission Matrix

### 2.1 Module & Tab Level Permissions

| Permission Key | Description | `company_admin` | `asset_manager` | `hr_manager` | `payroll_admin` | `finance_admin` | `recruiter` | `employee` |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `module:dashboard` | Executive Dashboard | **✓** | **✓** | **✓** | **✓** | **✓** | **✓** | **✓** |
| `module:employees` | Employee Master & Directory | **✓** | ✗ | **✓** | **✓** | **✓** | ✗ | ✗ |
| `module:recruitment` | Recruitment & ATS Pipeline | **✓** | ✗ | **✓** | ✗ | ✗ | **✓** | ✗ |
| `module:offboarding` | Separation & F&F Settlement | **✓** | ✗ | **✓** | ✗ | **✓** | ✗ | ✗ |
| `module:attendance` | Shifts & Daily Punches | **✓** | ✗ | **✓** | ✗ | ✗ | ✗ | ✗ |
| `module:leave` | Leave Quotas & Approvals | **✓** | ✗ | **✓** | ✗ | ✗ | ✗ | ✗ |
| `module:column_master`| Salary Column Master | **✓** | ✗ | ✗ | **✓** | ✗ | ✗ | ✗ |
| `module:compensation` | Salary Structures (CTC) | **✓** | ✗ | ✗ | **✓** | ✗ | ✗ | ✗ |
| `module:payroll` | 7-Stage Payroll Engine | **✓** | ✗ | ✗ | **✓** | **✓** | ✗ | ✗ |
| `module:loans` | Loans, Advances & Recoveries | **✓** | ✗ | **✓** | **✓** | **✓** | ✗ | ✗ |
| `module:expenses` | Expenses & Reimbursements | **✓** | ✗ | **✓** | ✗ | **✓** | ✗ | **✓** |
| `module:assets_helpdesk`| Hardware Assets & IT Helpdesk| **✓** | **✓** | **✓** | ✗ | ✗ | ✗ | **✓** |
| `module:reports` | Salary Registers & NEFT Export| **✓** | ✗ | **✓** | **✓** | **✓** | ✗ | ✗ |
| `module:self_service` | My Self-Service (ESS) | **✓** | **✓** | **✓** | **✓** | **✓** | **✓** | **✓** |
| `tab:assets:inventory`| Company Hardware Inventory | **✓** | **✓** | ✗ | ✗ | ✗ | ✗ | ✗ |
| `tab:assets:helpdesk` | IT Helpdesk Support Tickets | **✓** | **✓** | **✓** | ✗ | ✗ | ✗ | **✓** |
| `tab:expenses:claims` | Expense Claims Workbench | **✓** | ✗ | **✓** | ✗ | **✓** | ✗ | **✓** |
| `tab:expenses:travel` | Travel Desk Advance Requests | **✓** | ✗ | **✓** | ✗ | **✓** | ✗ | **✓** |

---

### 2.2 Action & Operational Permissions

| Permission Key | Action Name | `company_admin` | `asset_manager` | `hr_manager` | `payroll_admin` | `finance_admin` | `recruiter` | `employee` |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `asset:create` | Register Hardware Asset | **✓** | **✓** | ✗ | ✗ | ✗ | ✗ | ✗ |
| `asset:allocate` | Assign Custodian | **✓** | **✓** | ✗ | ✗ | ✗ | ✗ | ✗ |
| `asset:view_inventory`| View Hardware Details | **✓** | **✓** | ✗ | ✗ | ✗ | ✗ | ✗ |
| `ticket:create` | Raise Help Desk Ticket | **✓** | **✓** | **✓** | **✓** | **✓** | **✓** | **✓** |
| `ticket:resolve` | Resolve/Close Ticket | **✓** | **✓** | ✗ | ✗ | ✗ | ✗ | ✗ |
| `employee:create` | Enroll New Employee | **✓** | ✗ | **✓** | **✓** | ✗ | ✗ | ✗ |
| `employee:edit` | Update Employee Master | **✓** | ✗ | **✓** | **✓** | ✗ | ✗ | ✗ |
| `recruitment:create_job`| Post Job Opening | **✓** | ✗ | **✓** | ✗ | ✗ | **✓** | ✗ |
| `recruitment:move_stage`| Advance Candidate Stage | **✓** | ✗ | **✓** | ✗ | ✗ | **✓** | ✗ |
| `recruitment:hire` | 1-Click Convert to Employee | **✓** | ✗ | **✓** | ✗ | ✗ | ✗ | ✗ |
| `offboarding:initiate` | Submit Resignation Request | **✓** | ✗ | **✓** | ✗ | ✗ | ✗ | **✓** |
| `offboarding:settle` | Compute & Settle F&F | **✓** | ✗ | **✓** | ✗ | **✓** | ✗ | ✗ |
| `attendance:manage_shifts`| Configure Work Shifts | **✓** | ✗ | **✓** | ✗ | ✗ | ✗ | ✗ |
| `leave:approve` | Approve Leave Applications | **✓** | ✗ | **✓** | ✗ | ✗ | ✗ | ✗ |
| `salary_component:create`| Add Salary Head | **✓** | ✗ | ✗ | **✓** | ✗ | ✗ | ✗ |
| `salary_component:edit` | Edit Component & Rules | **✓** | ✗ | ✗ | **✓** | ✗ | ✗ | ✗ |
| `salary_component:toggle`| Enable/Disable Head | **✓** | ✗ | ✗ | **✓** | ✗ | ✗ | ✗ |
| `payroll:run_draft` | Stage 1: Initialize Run | **✓** | ✗ | ✗ | **✓** | ✗ | ✗ | ✗ |
| `payroll:run_approve` | Stage 5: Executive Sign-off | **✓** | ✗ | ✗ | ✗ | **✓** | ✗ | ✗ |
| `payroll:run_pay` | Stage 6: Disburse Bank NEFT | **✓** | ✗ | ✗ | ✗ | **✓** | ✗ | ✗ |
| `loan:apply` | Sanction Advance / Loan | **✓** | ✗ | **✓** | **✓** | **✓** | ✗ | ✗ |
| `loan:approve` | Amend Terms / Close Advance | **✓** | ✗ | ✗ | **✓** | **✓** | ✗ | ✗ |
| `loan:delete` | Delete Unrecovered Advance | **✓** | ✗ | ✗ | **✓** | **✓** | ✗ | ✗ |
| `expense:submit` | Submit Reimbursement Claim | **✓** | ✗ | **✓** | ✗ | **✓** | ✗ | **✓** |
| `expense:review` | Review & Approve Claim | **✓** | ✗ | **✓** | ✗ | **✓** | ✗ | ✗ |
| `reports:export` | Export Salary / Tax Slips | **✓** | ✗ | **✓** | **✓** | **✓** | ✗ | ✗ |
| `rbac:manage` | Configure Role Permissions | **✓** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

---

### 2.3 Sensitive Data Fields

| Permission Key | Field Protected | `company_admin` | `hr_manager` | `payroll_admin` | `finance_admin` | `employee` |
|---|---|:---:|:---:|:---:|:---:|:---:|
| `field:employee:basic_pay` | Basic Pay amount column in Employee Directory & Modals | **✓** | ✗ | **✓** | **✓** | ✗ |
| `field:employee:bank_account` | Bank Name, Account Number, IFSC Code | **✓** | ✗ | **✓** | **✓** | ✗ |
| `field:employee:pan_uan` | Full Permanent Account Number (PAN) & UAN | **✓** | ✗ | **✓** | **✓** | ✗ |

---

## 3. Dynamic UI Rule Enforcement

1. **Non-Rendering Rule:** Any control, button, or column for which the user lacks the explicit permission key is **completely omitted from the DOM** (`null` in React JSX). Controls are never merely greyed out or disabled.
2. **Empty Section Truncation:** Sidebar navigation sections that evaluate to 0 authorized items have their section headers pruned dynamically, preventing empty navigational containers.
3. **Deep Link Interception:** Direct URL navigation or manual `currentPage` state modification triggers `<AccessDeniedView>` with the technical requirement badge (`Required: module:<page>`), preventing protected component lifecycle execution.
