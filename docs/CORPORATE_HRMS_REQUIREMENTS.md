# Corporate HRMS & Payroll Platform - System Requirements Specification
## Enterprise-Grade Architecture Inspired by Spine HR Suite Scope

---

## 1. Executive Summary & Purpose

The **Corporate HRMS & Payroll Platform** is an enterprise-class, multi-entity Human Resource Management and Payroll system engineered for modern private corporations, multinational enterprises, IT services, manufacturing firms, and corporate offices.

It replaces academic/university mechanisms (such as pay commissions, GPF, and academic cadres) with corporate best practices:
- Complete **Hire-to-Retire Employee Lifecycle**
- **Indian Statutory Compliance Engine** (PF, ESI, PT, TDS, LWF, Gratuity, Bonus)
- **Multi-Entity & Multi-Branch Architecture**
- **Roster & Attendance Management** with Biometric/Web Clock-In and regularizations
- **Corporate Leave Policies** (Accrual, Carry Forward, Encashment, LOP)
- **Central Payroll Engine** with 7-stage corporate workflow (`DRAFT` → `VALIDATED` → `CALCULATED` → `REVIEWED` → `APPROVED` → `PAYMENT_READY` → `PAID`)
- **Talent Acquisition (ATS) & Digital Onboarding**
- **Performance Management System (PMS & OKRs)**
- **Expenses, Travel Desk & Timesheets**
- **Loans, Employee Asset Tracking & HR Help Desk**
- **Offboarding & Full-and-Final (F&F) Settlement**
- **Employee Self-Service (ESS)** with modern corporate portal and payslip designer

---

## 2. Organization & Multi-Company Structure

### 2.1 Multi-Tenancy & Entity Hierarchy
1. **Tenant / Holding Group:** Root corporate tenant for SaaS or dedicated private cloud deployment.
2. **Company / Legal Entity:** Supports multiple legal entities with independent registration details:
   - Corporate Identity Number (CIN), GSTIN, PAN, TAN.
   - Statutory codes: EPFO Establishment Code, ESIC Code, Professional Tax Registration Certificate (PTRC/PTEC), Factory License.
3. **Branches & Work Locations:** Distinct physical office addresses, state/city location, and local holiday calendar.
4. **Departments & Sub-Departments:** E.g., Engineering, Human Resources, Finance & Accounts, Sales & Marketing, Manufacturing Operations.
5. **Designations & Job Bands:** Structured hierarchy (e.g. Band 1: Associate, Band 2: Specialist, Band 3: Manager, Band 4: Director, Band 5: Executive VP).
6. **Cost Centers:** Financial accounting tags for salary and operational expense allocation.
7. **Employment Categories:**
   - Permanent Full-Time
   - Probationary
   - Fixed-Term Contract
   - Retainer / Consultant
   - Intern / Trainee

---

## 3. Core HRIS & Employee Database

### 3.1 Employee Master Record
- **Official Identity:** Employee ID/Code, Corporate Email, Date of Joining, Probation Period (Days), Confirmation Due Date, Confirmation Date.
- **Personal Details:** Full Name, Date of Birth, Gender, Marital Status, Blood Group, Personal Email, Mobile Number, Emergency Contacts.
- **Current Placement:** Company, Branch, Department, Designation, Grade/Band, Reporting Manager, HR Business Partner, Work Mode (Office, Remote, Hybrid).
- **Statutory & Bank Profile:**
   - Bank Account Number, Bank Name, IFSC Code, Branch.
   - Permanent Account Number (PAN).
   - Universal Account Number (UAN) & PF Member ID.
   - ESIC Insurance Number (IP).
   - Aadhaar Number (stored securely, masked for display).
- **Documents & Compliance:** Identity proofs, educational certificates, experience letters, signed NDAs, document expiry alerts.
- **Employment History & Timeline:** Automatic immutable tracking of promotions, salary revisions, transfers, and manager changes.

---

## 4. Recruitment & Applicant Tracking System (ATS)

1. **Requisitions:** Department vacancy creation with budget allocation, hiring manager, required skills, and approval workflow.
2. **Job Postings:** Internal and external job specifications.
3. **Candidate Pipeline:** Kanban workflow (`Applied` → `Shortlisted` → `Technical Interview` → `HR Round` → `Offer Extended` → `Offer Accepted` → `Hired` → `Rejected`).
4. **Interview Scheduling:** Panel assignment, interview schedule, rating scorecard, and feedback notes.
5. **Offer Management:** Compensation package configuration, offer letter generation, and candidate acceptance tracking.
6. **1-Click Conversion:** Automated conversion of hired candidate to employee master record.

---

## 5. Digital Onboarding

1. **Pre-Joining Checklist:** Document submission portal for candidate before Day 1.
2. **Asset Requisition:** IT equipment (laptop, monitor, accessories) and corporate ID card dispatch.
3. **Company Policy Acknowledgments:** Employee handbook, code of conduct, NDA, and data privacy policies.
4. **Induction & Training Schedule:** Assigned mentor, introductory sessions, and milestone reviews at Day 30, Day 60, and Day 90.

---

## 6. Attendance, Shifts & Time Management

1. **Shift Policies:**
   - General Shift (e.g., 09:30 - 18:30)
   - Morning Shift (06:00 - 14:30)
   - Evening Shift (14:00 - 22:30)
   - Night Shift (22:00 - 06:30)
   - Flexible Shift (minimum core working hours)
2. **Attendance Capture:**
   - Web Clock-In / Clock-Out with timestamp and IP/browser verification.
   - Biometric Device Integration Adapter (supports ZKTeco / Essl log formats).
   - CSV / Excel bulk punch imports.
3. **Shift Rostering:** Weekly shift assignments, rotational rosters, shift swaps with manager approval.
4. **Attendance Processing Rules:**
   - Grace period for late coming (e.g. 15 mins).
   - Half-day rules (minimum 4 hours working time).
   - Absenteeism detection for missing punches.
   - Overtime hours calculation.
5. **Regularization Workflow:** Employee requests for forgotten punch or on-duty client visits; approval by reporting manager.
6. **Monthly Attendance Lock:** Freeze attendance on payroll cutoff date (e.g. 25th of month) for payroll calculations.

---

## 7. Leave Management

1. **Configurable Leave Types:**
   - Casual Leave (CL)
   - Sick / Medical Leave (SL)
   - Privilege / Earned Leave (PL/EL)
   - Compensatory Off (Comp-Off)
   - Maternity Leave (ML) & Paternity Leave
   - Loss of Pay (LOP) / Unpaid Leave
2. **Leave Rules & Accrual:**
   - Monthly or annual credit (e.g. 1.75 days EL per month).
   - Maximum accumulation limit and carry-forward to next calendar/financial year.
   - Leave encashment rules upon exit or annual settlement.
3. **Application & Approvals:**
   - Multi-day and half-day leave applications.
   - Balance verification and sandwich leave rules (weekends between leaves).
   - Reporting manager approval workflow with automated notifications.

---

## 8. Compensation & CTC Engine

### 8.1 Salary Structure Components
1. **Earnings:**
   - **Basic Salary:** 40%–50% of monthly CTC.
   - **House Rent Allowance (HRA):** 40%–50% of Basic (metro vs. non-metro).
   - **Special Allowance:** Balancing component to match agreed gross.
   - **Conveyance / Transport Allowance:** Fixed monthly allowance.
   - **Medical Allowance:** Fixed monthly allowance.
   - **Variable Pay / Performance Bonus:** Configurable monthly or quarterly payouts.
   - **Shift Allowance / Overtime Pay:** Computed based on approved shifts.
2. **Employee Deductions:**
   - **Provident Fund (EPF):** 12% of Basic (+ DA if any), capped at ₹1,800/month or uncapped based on corporate policy.
   - **Employee State Insurance (ESIC):** 0.75% of Gross if gross salary <= ₹21,000/month.
   - **Professional Tax (PT):** State-specific tiered slab deduction (e.g., Maharashtra, Karnataka, Telangana, Tamil Nadu).
   - **Tax Deducted at Source (TDS):** Monthly income tax deducted under Old or New Tax Regime.
   - **Labour Welfare Fund (LWF):** State-specific statutory deduction.
   - **Loan EMI & Advance Recovery:** Auto-deducted from monthly salary.
3. **Employer Statutory Contributions (Part of CTC):**
   - **Employer PF:** 12% total (3.67% EPF + 8.33% EPS capped at ₹1,250 + EDLI & Admin charges).
   - **Employer ESIC:** 3.25% of Gross (if gross <= ₹21,000).
   - **Gratuity Provision:** 4.81% of Basic pay.

---

## 9. Corporate Payroll Engine & 7-Stage Lifecycle

```
[1. DRAFT] ──> [2. VALIDATED] ──> [3. CALCULATED] ──> [4. REVIEWED] ──> [5. APPROVED] ──> [6. PAYMENT_READY] ──> [7. PAID]
```

1. **Draft:** Period initialized for company and payroll group.
2. **Validated:** Attendance and leave data synced, LOP days calculated, loan EMIs fetched.
3. **Calculated:** Deterministic pure `Decimal(18,2)` calculation of earnings, deductions, net pay, and company CTC.
4. **Reviewed:** HR/Payroll Reviewer validates exceptions, negative net pay warnings, and monthly variance.
5. **Approved:** Authorized Finance/Corporate Approver approves payroll.
6. **Payment Ready:** NEFT/RTGS bank advice file and payment instructions generated.
7. **Paid & Reconciled:** Bank confirmation reference recorded, payroll frozen, and payslips released to Employee Self-Service.

---

## 10. Employee Self-Service (ESS) Portal

1. **Dashboard:** Profile summary, attendance status, upcoming holidays, leave balance cards.
2. **Payslips & Tax:**
   - Download official monthly PDF payslips.
   - Tax regime selection (Old vs. New Regime).
   - Investment declarations (Section 80C, 80D, HRA rent receipts, Home Loan interest 24b).
3. **Time & Requests:**
   - Web check-in / check-out.
   - Leave applications and balance tracking.
   - Attendance regularization requests.
   - Expense claim submission with receipts.
   - Travel requests and advances.
   - Help desk tickets and service requests.

---

## 11. Extended Enterprise Modules

1. **Expenses & Reimbursements:** Category-based claims (Travel, Meal, Internet, Fuel), receipt attachment, multi-level manager/finance approval, payment disbursement.
2. **Travel Desk:** Travel requisitions, budget estimation, booking details, advance reconciliation.
3. **Timesheets & Project Tracking:** Project/client master, daily/weekly time tracking, billable/non-billable hours, manager approval.
4. **Performance Management (PMS):** Annual/half-yearly appraisal cycles, goal setting (OKRs/KPIs), self-evaluation, manager evaluation, calibration, 1–5 performance rating, appraisal letters.
5. **Training Management:** Course catalog, training calendar, employee nominations, attendance, and feedback.
6. **Loans & Advances:** Company loan policies, EMI schedules, interest calculation, automated payroll deductions.
7. **Asset Management:** IT and physical assets inventory, employee assignment, condition tracking, return clearance.
8. **HR Help Desk:** Internal ticketing system with SLAs, priorities, comments, and resolution metrics.
9. **Offboarding & Full-and-Final (F&F):** Resignation, notice period tracking, asset return clearance, F&F calculation (unpaid days + leave encashment + gratuity - loan dues), relieving/experience letters.
10. **Visitor Management:** Guest pass creation, host notification, check-in/out tracking.
11. **Reports & Statutory Returns:** Monthly payroll register, bank advice, PF ECR export format, ESIC return format, PT statement, CTC variance analysis.
