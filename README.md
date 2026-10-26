# Corporate HRMS & Payroll Management Platform
## Enterprise-Grade Suite (Inspired by the Functional Scope of Commercial HRMS Suites)

An independent, enterprise-grade Corporate HRMS and Payroll Platform built from scratch for private companies, SMEs, manufacturing organizations, IT enterprises, and service businesses.

The platform provides complete hire-to-retire employee lifecycle management, configurable Indian statutory compliance, multi-branch organization control, a 7-stage payroll calculation engine, and a modern Employee Self-Service (ESS) portal.

---

## 1. System Overview & Core Capabilities

- **Strict Multi-Entity & Branch Hierarchy:** Independent corporate entities with multi-branch scoping (HQ Mumbai, Bengaluru Tech Center, Pune Operations).
- **Core HRIS & Employee Master:** Full employee profile, employment history, bank details, PAN/Aadhaar, and automatic probation & milestone timelines.
- **Configurable Indian Statutory Engine:**
  - **EPF / EPS:** 12% employee deduction + 12% employer contribution (8.33% EPS capped at ₹15,000 wage ceiling + 3.67% EPF + 0.5% admin).
  - **ESIC:** 0.75% employee contribution + 3.25% employer contribution (applicable when monthly gross ≤ ₹21,000).
  - **Professional Tax (PT):** State slab-based deduction engine (Maharashtra ₹200/mo, Karnataka ₹200/mo).
  - **Income Tax / TDS:** Dual regime calculation (New vs Old Tax Regime, Section 80C, 80D, HRA exemption).
  - **Payment of Gratuity:** Statutory formula `(15 × Basic × Years of Service) / 26` for completed service ≥ 5 years.
- **Compensation & CTC Builder:** Configurable earnings and deductions (Basic Pay, HRA, Special Allowance, Conveyance, Medical, Employer PF, Employer Gratuity) with deterministic `Decimal(18,2)` arithmetic.
- **Time, Shifts & Attendance:** Fixed, rotational, and night shifts; Web Clock-In/Clock-Out punch tracking, biometric integration adapter, and attendance regularization requests.
- **Corporate Leave Management:** Policy-driven allocations for Casual Leave (CL), Sick Leave (SL), Privilege/Earned Leave (PL), Compensatory Off (COMP), and Loss of Pay (LOP) leave proration.
- **Central 7-Stage Payroll Engine:**
  ```
  DRAFT → VALIDATED → CALCULATED → REVIEWED → APPROVED → PAYMENT_READY → PAID
  ```
  Audited state transitions, role separation, net-pay validation, duplicate run prevention, and frozen immutable payroll snapshots.
- **Recruitment & Applicant Tracking System (ATS):** Manpower planning, job requisitions, candidate pipeline (Applied → Screening → Interview → Offer → Hired), scorecard evaluation, and 1-click candidate-to-employee onboarding.
- **Expenses & Travel Desk:** Employee reimbursement claims, multi-item receipt submissions, finance approvals, and business travel advance requisitions.
- **Offboarding & Full-and-Final (F&F) Settlement:** Resignation workflows, notice period shortfall recovery, privilege leave encashment `(Basic / 30) × PL`, gratuity computation, outstanding loan offset, and automated settlement statements.
- **Company Assets & Corporate Help Desk:** Hardware inventory (laptops, monitors, mobile devices, access cards), employee custodian tracking, and ticketing system with comment threads.
- **Reports & Electronic Banking Advice:** Monthly salary registers, statutory EPFO / ESIC / PT summary challans, and electronic NEFT bank transfer advice file generator.
- **Employee Self-Service (ESS):** Mobile-responsive portal for attendance punches, leave balance checks, payslip downloads with detailed itemized breakdowns, and statutory tax declarations.

---

## 2. Technology Stack

- **Backend:** Node.js, Express, TypeScript, Prisma ORM, PostgreSQL 18.1, Decimal.js, Zod validation, JWT authentication, Helmet, CORS.
- **Frontend:** React 19, TypeScript, Vite, React Router, Context API, Lucide React icons, and a custom CSS design system.
- **Testing:** Vitest, Supertest (15/15 tests passing with 100% success rate).

---

## 3. Seed Accounts & Credentials

The system comes pre-seeded with synthetic test data for **Apex Global Technologies Pvt. Ltd.**:

| Username | Role Identifier | Functional Purpose | Password |
|---|---|---|---|
| `admin` | `company_admin` | Full Corporate Platform & Security Administrator | `Admin@123` |
| `hr.manager` | `hr_manager` | HR Lead (Recruitment, Employees, Leave Approvals) | `Admin@123` |
| `payroll.officer` | `payroll_admin` | Payroll Specialist (7-Stage Processing Lifecycle) | `Admin@123` |
| `finance.lead` | `finance_admin` | Finance Controller (Reimbursements, F&F, NEFT Advice) | `Admin@123` |
| `rohit.sharma` | `department_manager` | Engineering VP (Team Approvals & Timesheets) | `Admin@123` |
| `rahul.mehta` | `employee` | Employee Self-Service (ESS Portal User) | `Admin@123` |

---

## 4. Quick Start & Execution

### Prerequisites
- Node.js 20+
- PostgreSQL 15+ running on `localhost:5432` with database `payroll_management`

### Backend Setup & Launch
```bash
cd backend
npm install

# Run database push and seed
npx prisma db push
npm run seed

# Run automated test suite
npm test

# Start development API server (Port 4000)
npm run dev
```

### Frontend Setup & Launch
```bash
cd frontend
npm install

# Build for production validation
npm run build

# Start frontend development server (Port 5173)
npm run dev
```

---

## 5. Live Endpoints

- **Frontend Application:** `http://localhost:5173`
- **Backend API Base:** `http://localhost:4000/api/v1`
- **Health Check:** `http://localhost:4000/api/v1/health`
- **Readiness Check:** `http://localhost:4000/api/v1/ready`

---

## 6. Architecture & Quality Standards

- **Zero University / Legacy Code:** 100% of university-specific assumptions, academic cadres, and GPF ledgers were permanently retired in favor of commercial corporate entities, designations, and statutory policies.
- **Authoritative Server Calculations:** Authoritative salary, statutory deductions, and F&F calculations are strictly executed on the server using `Decimal.js` and PostgreSQL `Decimal(18,2)`.
- **Tenant & Entity Scoping:** Every query and mutation enforces company ID scoping derived strictly from the authenticated JWT session.
- **Immutable Historical Snapshots:** Payroll slips and full-and-final settlements store component-level line snapshots that remain immutable once transitioned to `PAID`.
