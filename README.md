# Enterprise Payroll Management System

An independent, enterprise-grade Payroll Management System built from scratch in strict accordance with the 53-page Samarth eGov Suite specification (`payrol structure.pdf` / User Manual PMSG-003, v2.1.26).

---

## 1. System Overview & Core Capabilities

- **Strict Database Independence:** Completely isolated in its dedicated PostgreSQL database (`payroll_management`). No dependency on external or legacy systems.
- **Audited 4-Stage Lifecycle:** Real database state machine transitions with separation of duties:
  `GENERATED` (PDA) → `VERIFIED` (PVO) → `FINALIZED` (PFO) → `APPROVED` (AR Salary)
- **Deterministic Decimal Financial Engine:** Pure `Decimal(18,2)` arithmetic for Basic pay, DA (50%), HRA (27%), TA, NPS (10% Tier 1), TDS, PT, LOP leave proration, and active loan recoveries with historical snapshots.
- **7th Central Pay Commission (CPC) Pay Matrix:** Complete hierarchical support for Pay Bands, Grade Pay, Levels (e.g. Levels 4, 7, 10, 11, 12, 13, 14), and matrix cells.
- **Complete Module Coverage:**
  - Organization & Employee CRUD with primary bank accounts and tax profiles.
  - Salary Masters (Heads, Templates, City Categories X/Y/Z).
  - General Provident Fund (GPF) with immutable statements and interest rate versions.
  - Income Tax (Old & New Regimes, Section 80C, 80D, 24b, and TDS deductions).
  - Loans & Advances with automatic monthly recovery schedules.
  - Leave-linked salary adjustments and Loss of Pay (LOP) calculations.
  - Pay Arrears & Pay Fixation difference calculations.
  - Annual Increments with automatic matrix step progression.
  - Payment Batches, SBI Bank Advice generation, and NEFT/RTGS export.
  - 15+ Financial and departmental reports with CSV/PDF exports.
  - Employee Self-Service (ESS) portal with official formatted payslip generation and data masking (PAN, Bank).
  - Append-only security audit trail recording actor, IP, timestamp, and metadata.

---

## 2. Technology Stack

- **Backend:** Node.js, Express 5, TypeScript, Prisma ORM, PostgreSQL, Zod, JWT, Decimal.js, Helmet, CORS.
- **Frontend:** React 19, TypeScript, Vite, React Router 7, Context API, Vanilla CSS Design System with CSS tokens, Lucide React icons.
- **Testing:** Vitest, Supertest.

---

## 3. Seed Accounts & Credentials

The system comes pre-seeded with synthetic test data for the National Institute of Higher Education & Research (NIHER):

| Username | Role Identifier | Functional Purpose | Password |
|---|---|---|---|
| `admin` | `payroll_admin` | Full System & Configuration Administrator | `Admin@123` |
| `pda_officer` | `payroll_pda` | Payroll Drawing & Disbursing Authority (Generate) | `Admin@123` |
| `pvo_officer` | `payroll_pvo` | Payroll Verification Officer (Verify) | `Admin@123` |
| `pfo_officer` | `payroll_pfo` | Payroll Finalization Officer (Finalize) | `Admin@123` |
| `ar_salary` | `payroll_ar_salary` | Assistant Registrar Salary (Approve & Payments) | `Admin@123` |
| `tax_admin` | `payroll_incometax_admin` | Income Tax Administrator | `Admin@123` |
| `vikram.sharma` | `employee_self_service` | Employee Self-Service (Professor, Computer Science) | `Admin@123` |

---

## 4. Quick Start & Execution

### Prerequisites
- Node.js 20+
- PostgreSQL 15+ (Running locally or configured via `.env`)

### Backend Setup & Launch
```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev
npm run seed
npm run dev
```
Backend runs on `http://localhost:4000`. Health: `http://localhost:4000/api/v1/health`

### Frontend Setup & Launch
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on `http://localhost:5173`. Proxies `/api` to port 4000.

---

## 5. Automated Testing

Run the comprehensive unit and integration test suite:
```bash
cd backend
npm test
```
**Results:** 17 tests passed (100% success rate across calculation engine, 4-stage lifecycle, role permissions, and reports).

---

## 6. Architecture & Documentation Directory

- `docs/PROJECT_AUDIT.md`: 53-page source-to-code gap analysis and audit findings.
- `docs/01-PDF-ANALYSIS.md`: Detailed structural breakdown of Samarth User Manual.
- `docs/04-ROLE-PERMISSION-MATRIX.md`: Complete matrix of the 9 PDF roles and explicit permissions.
- `docs/05-PAYROLL-BUSINESS-RULES.md`: Mathematical rules, formula explanations, and proration logic.
- `docs/06-DATABASE-ARCHITECTURE.md`: Entity-relationship schema, indexes, and decimal precision rules.
- `docs/07-API-SPECIFICATION.md`: REST API catalog with request/response schemas.
- `docs/09-REQUIREMENTS-TRACEABILITY.md`: Traceability matrix with verified implementation statuses.
- `docs/10-OPEN-QUESTIONS.md`: Policy blockers and institutional decisions required before production disbursement.
- `docs/13-DEPLOYMENT-GUIDE.md`: Production deployment, backup scripts, and rollback procedures.
