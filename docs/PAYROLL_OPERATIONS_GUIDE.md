# Corporate HRMS & Payroll Engine: Operations & Processing Guide

## 1. System Setup & Environment Configuration

### 1.1 Prerequisites
- Node.js v20.x or higher
- PostgreSQL 14+ running locally or remotely
- Modern Web Browser (Chrome, Firefox, Edge, Safari)

### 1.2 Configuration Files
Ensure `backend/.env` is configured:
```env
PORT=4000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/payroll_db?schema=public"
JWT_SECRET="corporate-payroll-super-secure-production-jwt-key-2026"
CORS_ORIGIN="http://localhost:5173"
NODE_ENV="development"
```

Ensure `frontend/.env` (or default API base) is configured:
```env
VITE_API_URL="http://localhost:4000/api/v1"
```

### 1.3 Local Startup Commands

**Terminal 1 (Backend API Service)**:
```powershell
cd backend
npm run dev
# Server listens on http://localhost:4000
# Ready check: http://localhost:4000/api/v1/ready
```

**Terminal 2 (Frontend Client Application)**:
```powershell
cd frontend
npm run dev
# Web application available at http://localhost:5173
```

---

## 2. Standard User Roles & Permissions

| Role Name | Scope & Authority | Primary Responsibilities |
| :--- | :--- | :--- |
| `company_admin` | Global Company Scope | System configuration, statutory master setup, dual approval |
| `payroll_admin` | Payroll Operations | Salary structure creation, payroll workbench execution, approvals |
| `payroll_processor` | Operational Processing | Attendance synchronization, pre-validation audit, calculation |
| `finance_admin` | Disbursement & Bank Advice | Dual-control approvals, payment instruction export, UTR entry |
| `hr_manager` | Employee Records & Policy | Employee onboarding, salary assignment, policy management |
| `employee` | Self-Service Only | Own profile, own attendance/leaves, own payslip download |

---

## 3. Step-by-Step Monthly Payroll Execution

Follow this sequential workflow every monthly cycle:

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ 1. Attendance   │ ────► │ 2. Initialize   │ ────► │ 3. Pre-Run      │ ────► │ 4. Batch        │
│    Locking      │       │    Draft Run    │       │    Validation   │       │    Calculation  │
└─────────────────┘       └─────────────────┘       └─────────────────┘       └────────┬────────┘
                                                                                       │
                                                                                       ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ 8. Payslips to  │ ◄──── │ 7. Record UTR & │ ◄──── │ 6. Export Bank  │ ◄──── │ 5. Variance &   │
│    Self-Service │       │    Mark PAID    │       │    Advice       │       │    Dual Approval│
└─────────────────┘       └─────────────────┘       └─────────────────┘       └─────────────────┘
```

### Step 1: Attendance & Leave Finalization
- Navigate to **Attendance Management**.
- Ensure all employee biometric punches, daily logs, and regularization requests are approved.
- Confirm approved leaves and verify unexcused absences are recorded as Loss of Pay (LOP).

### Step 2: Initialize Payroll Draft (`DRAFT`)
- Navigate to **Payroll Processing Workbench**.
- Click **"Create Payroll Run"**.
- Select the active pay period (e.g. October 2026) and company/branch scope.
- The workbench creates the run in `DRAFT` status and previews the eligible employee population.

### Step 3: Execute Pre-Run Validation (`VALIDATED`)
- Click **"Validate Eligibility & Attendance"**.
- The validation engine checks:
  1. Active salary structures assigned to all eligible staff.
  2. Attendance records and LOP days finalized.
  3. Employee statutory policies (PF, ESIC, PT) configured.
  4. Bank account information presence and valid IFSC format.
- Actionable warnings are displayed with employee identifiers.

### Step 4: Execute Authoritative Calculation (`CALCULATED`)
- Click **"Calculate Payroll Batch"**.
- The decimal calculation engine evaluates all eligible staff:
  - Prorates fixed components based on exact calendar days.
  - Adds verified overtime, arrears, and approved expense claims.
  - Deducts statutory contributions (EPF, ESIC, PT, TDS) and loan EMIs.
  - Persists an immutable calculation trace snapshot on each slip.

### Step 5: Variance Analysis & Review (`REVIEWED`)
- Click **"Submit for Review"**.
- Review the aggregate metrics:
  - Total Gross Earnings, Total Deductions, Net Payout, Total Employer Cost.
  - Period-over-period variance comparison against previous month.
  - Inspect negative net pay flags or statutory exceptions.

### Step 6: Dual-Control Approval (`APPROVED`)
- Authorized `company_admin` or `finance_admin` reviews the batch.
- Click **"Approve Payroll Run"**.
- This freezes all calculation inputs and slip records against ordinary edits.

### Step 7: Export Bank Payment Advice (`PAYMENT_READY`)
- Click **"Prepare Payment Instructions"**.
- Navigate to **Reports & Exports**.
- Download **Bank Advice CSV** (formula-injection sanitized).
- Transmit the payment advice file to the corporate banking portal.

### Step 8: Confirm Disbursement & Mark Paid (`PAID`)
- Once bank transfer confirmation is received, enter the **Bank UTR / Transaction Reference** and **Payment Date**.
- Click **"Confirm Payment & Finalize Run"**.
- The cycle status transitions to `PAID`. Records become permanent and immutable.

### Step 9: Employee Self-Service (ESS) Distribution
- Finalized payslips immediately reflect in each employee's **Self-Service Portal**.
- Employees can view their breakdown and download official PDF payslips.

---

## 4. Troubleshooting & Operational Recovery

### Issue: "Salary Component Circular Dependency Detected"
- **Cause**: Formula expressions reference components forming a loop (e.g. `A` references `B`, and `B` references `A`).
- **Resolution**: Use the Salary Component Master to inspect formula dependency chains. Break the cycle by referencing independent base components (`BASIC`, `GROSS`).

### Issue: "Cannot transition from DRAFT to APPROVED"
- **Cause**: Workbench strictly enforces sequential stages.
- **Resolution**: Advance through `VALIDATED` -> `CALCULATED` -> `REVIEWED` before requesting final approval.

### Issue: "Employee Net Pay is Negative"
- **Cause**: Statutory deductions or loan EMIs exceed monthly earned gross salary.
- **Resolution**: Check LOP days or adjust loan repayment schedule before final approval.
