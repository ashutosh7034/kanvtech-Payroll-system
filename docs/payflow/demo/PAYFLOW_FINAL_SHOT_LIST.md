# PAYFLOW FINAL PRESENTATION VIDEO — SHOT LIST & TECHNICAL RUN SHEET (V2)

**Final Video File**: `docs/payflow/demo/PAYFLOW_FINAL_PRESENTATION.mp4`  
**Dimensions**: 1920 × 1080 (16:9 Full HD)  
**Frame Rate**: 25.00 fps  
**Video Codec**: H.264 (High Profile, Level 4.0, CRF 20, yuv420p, +faststart)  
**Total Runtime**: 07:00.00 (420.0 seconds)  
**Target Audience**: College Faculty, Academic Reviewers, Management & Evaluation Panels  

---

## Master Shot Catalog & Timecode Sheet

### Scene 1: Introduction & Perimeter Security (0:00 – 0:45)
- **Timecode Range**: `00:00:00` – `00:00:45` (45 seconds)
- **Application Route**: `http://localhost:5173/login`
- **UI Elements Featured**:
  - PayFlow Brand Gateway Header
  - Clean `Role Profile Access` panel (all secret passwords, tokens, and credential hints completely removed)
  - Work Email and Password inputs
  - Real-time server rejection banner (HTTP 401 alert on invalid password submission)
- **Actions Demonstrated**:
  1. Entry on clean Full HD login page (`clean_login_1.png`).
  2. Entering credentials (`clean_login_2.png`).
  3. Negative validation test: Submitting invalid credentials -> immediate red rejection banner (`clean_login_invalid.png`).

---

### Scene 2: Secure Access & Executive Dashboard (0:45 – 1:15)
- **Timecode Range**: `00:00:45` – `00:01:15` (30 seconds)
- **Application Route**: `http://localhost:5173/` (`/dashboard`)
- **UI Elements Featured**:
  - Global Header: Minimalist enterprise badge (`Apex Global Technologies`), user role badge (`System Administrator`)
  - Primary Sidebar Navigation
  - Executive KPI Cards: Active Headcount (3), Financial Year (`FY 2026-27 ACTIVE`), Approved Runs
  - 4-Stage Payroll Pipeline visual progress tracker (Generated → Verified → Finalized → Approved)
  - Headcount distribution charts & immutable audit log feed
- **Actions Demonstrated**:
  1. Authenticating as Company Administrator (`clean_login_submit.png`).
  2. Smooth entry to Executive Dashboard (`click_feedback_1792570182112.png`).
  3. Vertical inspection of department analytics and audit stream.

---

### Scene 3: Employee Master Management (1:15 – 1:45)
- **Timecode Range**: `00:01:15` – `00:01:45` (30 seconds)
- **Application Route**: `http://localhost:5173/employees`
- **UI Elements Featured**:
  - Employee Master Header & Search Input
  - Real-time directory filter with whitespace tokenization
  - Filtered employee record for `PF-1003` Rahul Mehta (Senior Software Engineer, BLR-TECH)
  - Full employee roster view:
    * `PF-1001`: Rohit Sharma (VP Engineering, MUM-HQ)
    * `PF-1002`: Ananya Verma (Lead Product Designer, MUM-HQ)
    * `PF-1003`: Rahul Mehta (Senior Software Engineer, BLR-TECH)
- **Actions Demonstrated**:
  1. Entering `"Rahul Mehta"` into search field -> Directory immediately isolates employee `PF-1003` (`clean_employee_search.png`).
  2. Full employee directory view showing role hierarchy and branch codes (`click_feedback_1792570203895.png`).

---

### Scene 4: Corporate Compensation & CTC Structuring (1:45 – 2:45)
- **Timecode Range**: `00:01:45` – `00:02:45` (60 seconds)
- **Application Route**: `http://localhost:5173/compensation`
- **UI Elements Featured**:
  - Three Horizontal Master Tabs (single-row flex layout with active blue indicator):
    1. `Structure Assignment & CTC Builder`
    2. `Salary Structure Templates`
    3. `Salary Components Master`
  - Populated Structure Templates Library (`clean_templates_tab.png`):
    * `EXEC-TECH-01`: Engineering Executive CTC Package (9 lines: 40% Basic, 20% HRA, Conveyance, Medical, Special Allowance, PF, PT, Gratuity)
    * `CORP-STANDARD`: Corporate Professional Standard CTC (7 lines)
  - Salary Components Master (`click_feedback_1792570239815.png`): 16 statutory and custom earnings, deductions, and employer contributions
  - CTC Reconciliation Card (`click_feedback_1792570262285.png`): Rahul Mehta's ₹15 LPA package reconciling to ₹1,12,532.50 Gross and ₹1,06,332.50 Net
- **Actions Demonstrated**:
  1. Overview of horizontal tabs container.
  2. Inspection of the 2 seeded corporate templates.
  3. Review of the 16 statutory components with tax & PF flags.
  4. Mathematical CTC breakdown showing exact zero variance.

---

### Scene 5: 7-Stage Corporate Payroll Engine (2:45 – 3:45)
- **Timecode Range**: `00:02:45` – `00:03:45` (60 seconds)
- **Application Route**: `http://localhost:5173/payroll`
- **UI Elements Featured**:
  - 7-Stage Payroll Engine Lifecycle Header
  - October 2026 Run Card (`PR-2026-10-001`, Run `#cb1505`) with verified status badge `CALCULATED`
  - Itemized Payroll Slip Drawer:
    * Total Days: 31 | Payable Days: 31 | Loss of Pay (LOP): 0
    * Gross Salary: ₹1,12,532.50
    * Deductions: ₹6,200.00 (EPF ₹6k + PT ₹200)
    * Net Disbursable Salary: ₹1,06,332.50
    * Employer Cost: ₹8,405.00
- **Actions Demonstrated**:
  1. Viewing October 2026 payroll run row (`click_feedback_1792570282175.png`).
  2. Inspecting detailed calculation snapshot and itemized employee slip (`click_feedback_1792570293712.png`).

---

### Scene 6: Attendance, Leave & Compliance Reports (3:45 – 4:30)
- **Timecode Range**: `00:03:45` – `00:04:30` (45 seconds)
- **Application Routes**:
  - `/attendance` (Shifts & Attendance)
  - `/leave` (Leave Management)
  - `/reports` (Registers & NEFT Export)
- **UI Elements Featured**:
  - Shifts & Attendance: General Shift `GS-0930`, daily check-in logs (`09:02 AM`), grace period tracker
  - Leave Management: Leave balance cards, approved casual leave request, zero LOP deduction
  - Registers & Reports: Head-Wise Salary Summary, Department-Wise Pay Bill, Bank NEFT batch export, immutable audit trail
- **Actions Demonstrated**:
  1. Navigating to Shifts & Attendance (`click_feedback_1792570324808.png`).
  2. Navigating to Leave Management (`click_feedback_1792570336415.png`).
  3. Navigating to Registers & NEFT Export (`click_feedback_1792570349693.png`).

---

### Scene 7: Genuine Live QA Demonstration (4:30 – 5:30)
- **Timecode Range**: `00:04:30` – `00:05:30` (60 seconds)
- **Application Routes**: `/login`, `/dashboard`, API endpoints
- **UI Elements Featured**:
  - Negative Authentication Alert banner (`clean_login_invalid.png`)
  - Authorized User Session Header (`clean_login_submit.png`)
  - Profile Dropdown Menu (`click_feedback_1792570374287.png`)
  - Route Guard Interceptor (`click_feedback_1792570384776.png`)
- **Actions Demonstrated**:
  1. Invalid credentials rejection test.
  2. Authorized session authentication.
  3. Secure profile logout flow.
  4. Direct browser navigation to `/dashboard` while unauthenticated -> intercepted and redirected to `/login`.
  5. Single active session rejection test (`SESSION_REVOKED`).

---

### Scene 8: Final Presentation Closing Card (5:30 – 6:15)
- **Timecode Range**: `00:05:30` – `00:07:00` (90 seconds / concluding hold)
- **Visual Asset**: `closing_slide.png` (High-definition 1920×1080 presentation slide)
- **UI Elements Featured**:
  - Title: `PayFlow — HRMS & Payroll Management`
  - Subtitle: `Enterprise HRMS & Statutory Payroll ERP — End-to-End System Evaluation`
  - Evaluation Pill: `PROJECT EVALUATION & UAT SIGN-OFF`
  - 5 Verified Functional Modules (Employee Master, Compensation CTC Engine, 7-Stage Payroll, Attendance/Leave, Reports & Access Control)
  - Verified QA Evidence (166/166 Vitest tests passing, 0 TypeScript compile errors, clean production build, ₹0.00 CTC variance)
  - Corporate branch footer (Apex Global Technologies • Mumbai HQ • Bengaluru Tech Center)

---

## Route & Permissions Mapping Table

| Route | View Component | HTTP Verb / Endpoint | Permissions |
| :--- | :--- | :--- | :--- |
| `/login` | `LoginView.tsx` | `POST /api/v1/auth/login` | Public |
| `/` / `/dashboard`| `DashboardView.tsx` | `GET /api/v1/auth/me`, `GET /api/v1/payroll/stats` | Authenticated (All Roles) |
| `/employees` | `EmployeesView.tsx` | `GET /api/v1/employees?search=...` | HR, Admin |
| `/compensation` | `CompensationView.tsx` | `GET /api/v1/compensation/components`, `GET /api/v1/compensation/structures` | HR, Admin |
| `/payroll` | `PayrollProcessingView.tsx` | `GET /api/v1/payroll/runs`, `GET /api/v1/payroll/runs/:id` | Payroll, Admin |
| `/attendance` | `AttendanceView.tsx` | `GET /api/v1/attendance/shifts` | HR, Admin |
| `/leave` | `LeaveView.tsx` | `GET /api/v1/leave` | All Roles |
| `/reports` | `ReportsView.tsx` | `GET /api/v1/reports/corporate` | Finance, Admin |
| `/self` | `SelfServiceView.tsx` | `GET /api/v1/self-service/profile` | Employee |
