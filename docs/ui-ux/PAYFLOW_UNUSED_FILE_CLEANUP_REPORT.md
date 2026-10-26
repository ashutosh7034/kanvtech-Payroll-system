# PAYFLOW — UNUSED FILE AUDIT & CLEANUP REPORT
**Date:** October 26, 2026  
**Auditor:** Principal Enterprise UI/UX Designer & Senior Full-Stack Architect  
**Repository:** `c:\Users\Ashutosh Pandey\Downloads\payroll-management-system`  
**Status:** REFERENCE-AWARE CLEANUP EXECUTED & VERIFIED  

---

## 1. Executive Summary

As mandated in **Phase E (Cleanup)** of the Enterprise UI/UX Redesign specification:
- Obsolete UI components must only be removed when confirmed unused.
- Unused dependencies and files must be checked against the active import graph.
- Reusable business logic, working endpoints, and active documentation must be preserved.
- Cleanup must be reference-aware and evidence-based.

This report documents the static analysis, import graph tracing, dependency verification, and cleanup decisions for the PAYFLOW codebase.

---

## 2. Static Import Graph Analysis

Every file in `frontend/src/pages/` was cross-referenced against `frontend/src/main.tsx` and all active component imports using ripgrep pattern matching (`Includes: ["*.ts", "*.tsx"]`).

### 2.1 Active Routed Modules in Production (16 Modules)

| Route ID / Module | Component File | Routing / Consumer | Status |
| :--- | :--- | :--- | :--- |
| `dashboard` | `pages/DashboardView.tsx` | `main.tsx:7` | ACTIVE |
| `employees` | `pages/EmployeesView.tsx` | `main.tsx:8` | ACTIVE |
| `recruitment` | `pages/RecruitmentView.tsx` | `main.tsx:9` | ACTIVE |
| `offboarding` | `pages/OffboardingView.tsx` | `main.tsx:15` | ACTIVE |
| `attendance` | `pages/AttendanceView.tsx` | `main.tsx:10` | ACTIVE |
| `leave` | `pages/LeaveView.tsx` | `main.tsx:11` | ACTIVE |
| `column-master` | `pages/SalaryColumnMasterView.tsx` | `main.tsx:20` | ACTIVE |
| `compensation` | `pages/CompensationView.tsx` | `main.tsx:12` | ACTIVE |
| `payroll` | `pages/PayrollProcessingView.tsx` | `main.tsx:13` | ACTIVE |
| `loans` | `pages/LoansView.tsx` | `main.tsx:19` | ACTIVE |
| `expenses` | `pages/ExpensesView.tsx` | `main.tsx:14` | ACTIVE |
| `assets-helpdesk` | `pages/AssetsHelpDeskView.tsx` | `main.tsx:16` | ACTIVE |
| `reports` | `pages/ReportsView.tsx` | `main.tsx:17` | ACTIVE |
| `self` | `pages/SelfServiceView.tsx` | `main.tsx:18` | ACTIVE |
| `payroll-permissions` | `pages/PayrollPermissionsView.tsx` | `main.tsx:21` | ACTIVE |
| `login` | `pages/LoginView.tsx` | `main.tsx:6` | ACTIVE |

---

### 2.2 Unwired Legacy Files Identified (7 Files)

The following files resided in `frontend/src/pages/` from earlier prototyping iterations. A full AST and grep scan confirmed that **none** of these files were imported or routed anywhere in `frontend/src`:

| File Name | File Size | Consumer References Found | Consolidated Functionality Destination | Action Taken |
| :--- | :--- | :--- | :--- | :--- |
| `ArrearsView.tsx` | 8,102 bytes | 0 imports (only self-definition) | Consolidated into `PayrollProcessingView.tsx` (Salary Review & Editor Arrears column) | Removed |
| `GpfView.tsx` | 14,654 bytes | 0 imports (only self-definition) | Consolidated into `SalaryColumnMasterView.tsx` and statutory deduction components | Removed |
| `ImportsView.tsx` | 9,690 bytes | 0 imports (only self-definition) | Consolidated into `AttendanceView.tsx` CSV imports & `ReportsView.tsx` | Removed |
| `IncrementsView.tsx` | 8,372 bytes | 0 imports (only self-definition) | Consolidated into `CompensationView.tsx` (Versioned CTC assignment & revision reason) | Removed |
| `MastersView.tsx` | 19,692 bytes | 0 imports (only self-definition) | Replaced by `SalaryColumnMasterView.tsx` (AST Formula engine & component groups) | Removed |
| `PaymentBatchesView.tsx` | 10,041 bytes | 0 imports (only self-definition) | Consolidated into `PayrollProcessingView.tsx` (Stage 6 NEFT Advice & Stage 7 Payment Confirmation) | Removed |
| `TaxView.tsx` | 9,572 bytes | 0 imports (only self-definition) | Consolidated into `PayrollProcessingView.tsx` (Tab 3: Income Tax TDS Studio) | Removed |

---

## 3. Evidence of Unused Status

Grep search command outputs executed on `frontend/src`:

1. `grep_search "ArrearsView" frontend/src`
   ```json
   {"File":"frontend/src/pages/ArrearsView.tsx","LineNumber":6,"LineContent":"export const ArrearsView: React.FC = () => {"}
   ```
   *Matches: 1 (self-definition only, zero consumers).*

2. `grep_search "GpfView" frontend/src`
   ```json
   {"File":"frontend/src/pages/GpfView.tsx","LineNumber":6,"LineContent":"export const GpfView: React.FC = () => {"}
   ```
   *Matches: 1 (self-definition only, zero consumers).*

3. `grep_search "ImportsView" frontend/src`
   ```json
   {"File":"frontend/src/pages/ImportsView.tsx","LineNumber":6,"LineContent":"export const ImportsView: React.FC = () => {"}
   ```
   *Matches: 1 (self-definition only, zero consumers).*

4. `grep_search "IncrementsView" frontend/src`
   ```json
   {"File":"frontend/src/pages/IncrementsView.tsx","LineNumber":6,"LineContent":"export const IncrementsView: React.FC = () => {"}
   ```
   *Matches: 1 (self-definition only, zero consumers).*

5. `grep_search "MastersView" frontend/src`
   ```json
   {"File":"frontend/src/pages/MastersView.tsx","LineNumber":6,"LineContent":"export const MastersView: React.FC = () => {"}
   ```
   *Matches: 1 (self-definition only, zero consumers).*

6. `grep_search "PaymentBatchesView" frontend/src`
   ```json
   {"File":"frontend/src/pages/PaymentBatchesView.tsx","LineNumber":6,"LineContent":"export const PaymentBatchesView: React.FC = () => {"}
   ```
   *Matches: 1 (self-definition only, zero consumers).*

7. `grep_search "TaxView" frontend/src`
   ```json
   {"File":"frontend/src/pages/TaxView.tsx","LineNumber":6,"LineContent":"export const TaxView: React.FC = () => {"}
   ```
   *Matches: 1 (self-definition only, zero consumers).*

---

## 4. Verification Post-Cleanup

Following removal of the 7 unwired files:
1. `npm run typecheck --prefix frontend` was executed: **0 errors**.
2. `npm run build --prefix frontend` was executed: **1,950 modules transformed, build succeeded in 2.53s**.
3. `npm test --prefix backend` was executed: **16 test files passed, 303 tests passing 100%**.
4. Database safety verified via `verify_safety.ts`: Protected loan `b405b4b8-1211-48c5-a59e-ee8db001a906` intact.
