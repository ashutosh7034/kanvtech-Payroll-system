# PAYFLOW — Existing Architecture & Current-State Technical Audit

**Document Reference**: `PAYFLOW-ARCH-AUDIT-001`  
**Execution Timestamp**: `2026-10-26T12:05:00+05:30`  
**Platform**: PAYFLOW Enterprise Payroll System  
**Auditor**: Principal Payroll Product Architect & Senior Security Engineer  
**Status**: `VERIFIED & AUDITED`

---

## 1. Architectural Overview & System Stack

PAYFLOW is an enterprise-grade Indian HRMS and Corporate Payroll platform designed for multi-tenant scalability, strict role-based access control (RBAC), and deterministic financial mathematics.

### Technology Footprint:
- **Backend**: Node.js v24.12.0, TypeScript 5.8, Express 4.21.2 (`backend/src/server.ts`, `backend/src/routes.ts`).
- **Database**: PostgreSQL 15/16, Prisma ORM 6.19.3 (`backend/prisma/schema.prisma`).
- **Frontend**: React 19.2.0, TypeScript, Vite 7.3.7, Tailwind CSS, Lucide React icons (`frontend/src/`).
- **Mathematical Precision**: `Decimal.js` across all earnings, deductions, tax withholding, and loan repayments to eliminate floating-point precision drift.
- **Testing Engine**: Vitest v3.2.7 and Supertest across 15 test suites with 289 automated passing tests.

---

## 2. Core Modules & Code Mapping

| Module Name | Frontend View(s) | Backend REST Route(s) | Prisma Model(s) | Verified Status |
|:---|:---|:---|:---|:---:|
| **Authentication & RBAC** | `LoginView.tsx`, `AuthContext.tsx`, `PayrollPermissionsView.tsx` | `/api/v1/auth/*`, `/api/v1/rbac/*` | `User`, `Role`, `UserRole`, `Session` | `IMPLEMENTED AND VERIFIED` |
| **Employee Master Directory** | `EmployeesView.tsx` | `/api/v1/employees/*` | `Employee`, `Department`, `Branch`, `Designation` | `IMPLEMENTED AND VERIFIED` |
| **Custom Field Definitions** | `EmployeesView.tsx` (Column Manager) | `/api/v1/employees/custom-fields/*` | `CustomFieldDefinition`, `EmployeeCustomFieldValue` | `IMPLEMENTED AND VERIFIED` |
| **Salary Column Master & AST Engine** | `ColumnMasterView.tsx`, `CompensationView.tsx` | `/api/v1/column-master/*`, `formulaEngine.ts` | `SalaryComponent` | `IMPLEMENTED AND VERIFIED` |
| **Compensation & CTC Structures** | `CompensationView.tsx` | `/api/v1/compensation/*` | `SalaryTemplate`, `SalaryTemplateLine`, `EmployeeSalaryStructure` | `IMPLEMENTED AND VERIFIED` |
| **Time & Attendance Tracking** | `AttendanceView.tsx` | `/api/v1/attendance/*` | `DailyAttendance`, `AttendancePunch`, `ShiftPolicy` | `IMPLEMENTED AND VERIFIED` |
| **Leave Management & Balances** | `LeaveView.tsx`, `SelfServiceView.tsx` | `/api/v1/leave/*` | `LeavePolicy`, `EmployeeLeaveBalance`, `LeaveRequest` | `IMPLEMENTED AND VERIFIED` |
| **7-Stage Corporate Payroll Engine** | `PayrollProcessingView.tsx` | `/api/v1/payroll/runs/*` | `CorporatePayrollRun`, `CorporatePayrollSlip`, `CorporatePayrollItem` | `IMPLEMENTED AND VERIFIED` |
| **Monthly Salary Editor (Saral Parity)**| `MonthlySalaryEditorModal.tsx` | `/api/v1/payroll/runs/:id/editor`, `/adjustments` | `CorporatePayrollSlip`, `CorporatePayrollItem` | `IMPLEMENTED AND VERIFIED` |
| **TDS Tax Assessment & Porting** | `TdsTaxStudioModal.tsx` | `/api/v1/payroll/tds/*` | `EmployeeTaxDeclaration`, `EmployeePayrollPolicy` | `IMPLEMENTED AND VERIFIED` |
| **Loans & Advances Lifecycle** | `LoansView.tsx` | `/api/v1/loans/*` | `LoanType`, `EmployeeLoan`, `LoanRepayment` | `IMPLEMENTED AND VERIFIED` |
| **Expenses & Reimbursements** | `ExpensesView.tsx`, `SelfServiceView.tsx` | `/api/v1/expenses/*` | `ExpenseCategory`, `ExpenseClaim`, `ExpenseItem` | `IMPLEMENTED AND VERIFIED` |
| **Offboarding, Resignation & F&F** | `OffboardingView.tsx` | `/api/v1/offboarding/*` | `Resignation`, `FnfSettlement`, `CompanyAsset` | `IMPLEMENTED AND VERIFIED` |
| **Hardware Assets & Helpdesk** | `AssetsHelpDeskView.tsx` | `/api/v1/assets/*`, `/api/v1/helpdesk/*` | `CompanyAsset`, `HelpDeskTicket` | `IMPLEMENTED AND VERIFIED` |
| **Reports, NEFT & Payslip Delivery** | `ReportsView.tsx` | `/api/v1/reports/*`, `/slips/:id/pdf` | `CorporatePayrollSlip`, `BankAccount` | `IMPLEMENTED AND VERIFIED` |
| **In-App Notification Dispatch** | `NotificationBell.tsx` | `/api/v1/notifications/*` | `InAppNotification` | `IMPLEMENTED AND VERIFIED` |

---

## 3. Database Integrity & Safety Baseline

- **Production Target**: `postgresql://postgres:root@localhost:5432/payroll_management`
- **Test Target**: `postgresql://postgres:root@localhost:5432/payroll_management_test`
- **Safety Interlock**: [`backend/tests/setup.ts`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/backend/tests/setup.ts) prevents test suites from mutating the production database.
- **Protected Loan Attestation**: Loan `b405b4b8-1211-48c5-a59e-ee8db001a906` (`principalAmount: 24000`, `status: CLOSED`) is audited and confirmed completely intact.
