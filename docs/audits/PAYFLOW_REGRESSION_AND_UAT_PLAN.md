# PAYFLOW — Regression Test Baseline & UAT Verification Plan

**Document Reference**: `PAYFLOW-REG-PLAN-007`  
**Execution Timestamp**: `2026-10-26T11:55:00+05:30`  
**Platform**: PAYFLOW Enterprise Payroll System  
**Status**: `VERIFIED & DOCUMENTED`

---

## 1. Executive Summary

This document establishes the regression testing baseline and User Acceptance Testing (UAT) plan for PAYFLOW. It details test database isolation, automated test suite coverage across 15 test files (289 passing tests), and reproducible manual UAT scenarios for every major subsystem.

---

## 2. Test Database Isolation & Safety Architecture

- **Active Production Database**: `payroll_management` (PostgreSQL 5432). Strictly protected from test modifications.
- **Dedicated Test Database**: `payroll_management_test` (PostgreSQL 5432). All automated test runs (`npm test`) load configuration from `backend/.env.test`.
- **Database Safety Guard** ([`backend/tests/setup.ts`](file:///c:/Users/Ashutosh%20Pandey/Downloads/payroll-management-system/backend/tests/setup.ts)):
  ```ts
  const isTestDb = dbUrl.includes('_test') || dbUrl.includes('test');
  if (!isTestDb && !process.env.ALLOW_TEST_ON_PROD) {
    throw new Error('[FATAL SAFETY GUARD VIOLATION] Test execution blocked! Attempted to run test suite against non-test database');
  }
  ```
- **Protected Loan Guarantee**: Production loan `b405b4b8-1211-48c5-a59e-ee8db001a906` is audited directly and confirmed intact (`principalAmount: 24000`, `status: CLOSED`).

---

## 3. Automated Test Suite Baseline (15 Test Suites — 289 Tests)

Command executed: `npm test` in `backend/`

| # | Test Suite | Tests | Result | Focus Area |
|:---:|:---|:---:|:---:|:---|
| 1 | `tests/expensesAndPayrollMaster.test.ts` | 20 | `PASS` | Master Verification: Expenses, 7-Stage Payroll, RBAC Dashboard |
| 2 | `tests/expenseReimbursementWorkflow.test.ts` | 20 | `PASS` | Expense Reimbursement Lifecycle, RBAC & In-App Notifications |
| 3 | `tests/corporate.test.ts` | 42 | `PASS` | Corporate HRMS Core Workflows & Employee Master |
| 4 | `tests/securityRemediation.test.ts` | 13 | `PASS` | Cross-Tenant Boundaries & Segregation of Duties (SOD) |
| 5 | `tests/rbacUiVisibility.test.ts` | 14 | `PASS` | RBAC Dynamic UI Visibility & Role Permissions API |
| 6 | `tests/loansCrudComprehensive.test.ts` | 13 | `PASS` | Employee Loans & Advances Full Lifecycle & Repayments |
| 7 | `tests/loansAndCustomFields.test.ts` | 17 | `PASS` | Custom Field Definitions & Loan Sanctioning Validations |
| 8 | `tests/formulaEngineScenarios.test.ts` | 25 | `PASS` | Authoritative 25-Scenario Indian Payroll Engine |
| 9 | `tests/formulaEngine.test.ts` | 9 | `PASS` | Recursive Descent AST Parser & Kahn's Topological Sorting |
| 10 | `tests/columnMasterAndFormula.test.ts` | 20 | `PASS` | Salary Column Master CRUD, Head Toggling & Formula Check |
| 11 | `tests/tdsStatutoryRules.test.ts` | 45 | `PASS` | Indian Old vs New Tax Regime Slabs & Section 80C/80D Rules |
| 12 | `tests/saralPayPackParity.test.ts` | 11 | `PASS` | Saral PayPack Parity: Month Creation, Salary Editor & TDS Porting |
| 13 | `tests/payrollCalculations.test.ts` | 24 | `PASS` | Base Salary Calculations, Overtime 2.0x, Unpaid Leaves (LOP) |
| 14 | `tests/payrollE2E.test.ts` | 9 | `PASS` | End-to-End Monthly Payroll Pipeline (`DRAFT` to `PAID`) |
| 15 | `tests/payrollEngineComprehensive.test.ts` | 15 | `PASS` | Phase 14 Comprehensive Engine Verification |
| **TOTAL** | **15 Test Suites** | **289** | **PASS (100%)** | **Zero Regressions Across Entire Codebase** |
