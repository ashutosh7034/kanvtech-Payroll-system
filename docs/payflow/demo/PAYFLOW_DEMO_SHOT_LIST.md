# PAYFLOW HRMS & PAYROLL ERP — DEMO VIDEO SHOT LIST & ROUTE CATALOG

**Video File**: `docs/payflow/demo/PAYFLOW_PRODUCT_DEMO.mp4`  
**Dimensions**: 1920 × 1080 (16:9 Full HD)  
**Frame Rate**: 25.00 fps  
**Video Codec**: H.264 (High Profile, Level 4.0, CRF 20, yuv420p, +faststart)  
**Duration**: 06:30.00 (Master Full Demo cut)  

---

## Shot Catalog & Scene Breakdown

### Scene 1: Introduction & System Perimeter (0:00 – 0:45)
- **Timecode Range**: `00:00:00` – `00:00:45` (45 seconds)
- **Application Route**: `http://localhost:5173/login`
- **UI Elements Featured**:
  - PayFlow Brand Gateway Header
  - Email & Password Credential Fields
  - Role-Based Instant Authentication triggers (Company Admin, HR Lead, Payroll Specialist, Finance Controller, Employee)
  - Negative input error alert banner (`401 Rejection`)
- **Recorded User Actions**:
  1. Entry on clean login viewport (1920x1080).
  2. Input of invalid email `admin@payflow.com` and password `WrongPassword123!`.
  3. Submission displaying genuine red warning alert for invalid credentials.
- **Visual Artifacts**: `click_feedback_1792570074965.png`, `click_feedback_1792570084018.png`, `click_feedback_1792570092565.png`

---

### Scene 2: Login and Executive Dashboard (0:45 – 1:15)
- **Timecode Range**: `00:00:45` – `00:01:15` (30 seconds)
- **Application Route**: `http://localhost:5173/` (`/dashboard`)
- **UI Elements Featured**:
  - Global Header: Minimalist company badge (`Apex Global Technologies`), user avatar, role status
  - Left Primary Sidebar Navigation (Dashboard, Employees, Attendance, Leave, Shifts, Compensation, Payroll, Reports)
  - Key Performance Stat Cards: Total Headcount, Active Financial Year, Active Loans, Approved Payroll Runs
  - 4-Stage Payroll Pipeline Status Bar (Generated → Verified → Finalized → Approved)
  - Headcount Distribution Chart and Immutable System Activity Log
- **Recorded User Actions**:
  1. Authorized login as Company Administrator (`admin@apexglobal.tech`).
  2. Instant navigation to Executive Dashboard.
  3. Smooth vertical scroll down to inspect department distribution analytics and audit feed.
  4. Smooth vertical scroll back to header.
- **Visual Artifacts**: `click_feedback_1792570148502.png`, `click_feedback_1792570182112.png`

---

### Scene 3: Employee Master & Directory (1:15 – 1:45)
- **Timecode Range**: `00:01:15` – `00:01:45` (30 seconds)
- **Application Route**: `http://localhost:5173/employees`
- **UI Elements Featured**:
  - Employee Master Header & Search Input
  - Real-time Filter & Quick Action Toolbar
  - Employee Profile Cards / Table Rows showing Code, Name, Department, Designation, Work Mode, and Status
  - Synthetic Demo Roster:
    * `PF-1001`: Rohit Sharma (VP Engineering, MUM-HQ)
    * `PF-1002`: Ananya Verma (Lead Product Designer, MUM-HQ)
    * `PF-1003`: Rahul Mehta (Senior Software Engineer, BLR-TECH)
- **Recorded User Actions**:
  1. Click 'Employee Master' in primary sidebar.
  2. Real-time typing of `"Rahul Mehta"` into the directory search field.
  3. Directory isolates Rahul Mehta (`PF-1003`).
  4. Clearing search restores full 3-member roster.
- **Visual Artifacts**: `click_feedback_1792570191982.png`, `click_feedback_1792570203895.png`

---

### Scene 4: Corporate Compensation & CTC Engine (1:45 – 2:45)
- **Timecode Range**: `00:01:45` – `00:02:45` (60 seconds)
- **Application Route**: `http://localhost:5173/compensation`
- **UI Elements Featured**:
  - Corporate Compensation Page Header
  - **Horizontal Tabs Container** (One-row flex layout with active blue pill indicator):
    1. `Structure Assignment & CTC Builder`
    2. `Salary Components Master`
    3. `Salary Structure Templates`
  - Salary Components Grid (16 statutory and custom earnings/deductions)
  - Predefined Corporate Structure Templates
  - CTC Breakdown Card for Rahul Mehta:
    * Annual CTC: ₹15,00,000.00
    * Monthly Gross: ₹1,12,532.50
    * Monthly Take-Home: ₹1,06,332.50
    * Itemized Earnings: Basic (₹50k), HRA (₹25k), Conveyance (₹5k), Medical (₹6k), Special Allowance (₹26,532.50)
    * Statutory Deductions: Employee PF (₹6k), Professional Tax (₹200)
- **Recorded User Actions**:
  1. Click 'Salary Structures (CTC)' in sidebar.
  2. Inspect horizontal tabs directly under title.
  3. Switch to 'Salary Components Master' tab to inspect 16 statutory components.
  4. Switch to 'Salary Structure Templates' tab.
  5. Return to 'Structure Assignment & CTC Builder' tab to verify ₹15 LPA mathematical reconciliation.
- **Visual Artifacts**: `click_feedback_1792570230121.png`, `click_feedback_1792570239815.png`, `click_feedback_1792570251522.png`, `click_feedback_1792570262285.png`

---

### Scene 5: Corporate Payroll Operations (2:45 – 3:45)
- **Timecode Range**: `00:02:45` – `00:03:45` (60 seconds)
- **Application Route**: `http://localhost:5173/payroll`
- **UI Elements Featured**:
  - 7-Stage Payroll Engine Pipeline Header
  - Payroll Cycles & Run Directory
  - October 2026 Run Card (`PR-2026-10-001`, Run `#cb1505`) with status pill `CALCULATED`
  - Itemized Payroll Slip Modal / Inspector:
    * Total Days: 31 | Payable Days: 31 | LOP: 0
    * Gross Disbursable: ₹1,12,532.50
    * Total Statutory Deductions: ₹6,200.00
    * Net Disbursable: ₹1,06,332.50
    * Employer Contribution: ₹8,405.00
- **Recorded User Actions**:
  1. Click '7-Stage Payroll Engine' in sidebar.
  2. View isolated October 2026 payroll run.
  3. Click 'Inspect' on run card to open detailed calculation breakdown and verified slip values.
- **Visual Artifacts**: `click_feedback_1792570282175.png`, `click_feedback_1792570293712.png`

---

### Scene 6: Attendance, Leave & Compliance Reports (3:45 – 4:30)
- **Timecode Range**: `00:03:45` – `00:04:30` (45 seconds)
- **Application Routes**:
  - `/attendance` (Shifts & Attendance)
  - `/leave` (Leave Management)
  - `/reports` (Registers & NEFT Export)
- **UI Elements Featured**:
  - Attendance Engine: Shift allocation (`GS-0930`), daily check-in log (`09:02 AM`), grace period tracker
  - Leave Management: Leave balance cards, casual/sick leave requests, approval workflow
  - Registers & Reports: Head-Wise Salary Summary, Department-Wise Pay Bill, Bank NEFT payment batch export, immutable audit trail
- **Recorded User Actions**:
  1. Click 'Shifts & Attendance' in sidebar.
  2. Click 'Leave Management' in sidebar.
  3. Click 'Registers & NEFT Export' in sidebar.
- **Visual Artifacts**: `click_feedback_1792570324808.png`, `click_feedback_1792570336415.png`, `click_feedback_1792570349693.png`

---

### Scene 7: Actual QA Demonstration (4:30 – 5:30)
- **Timecode Range**: `00:04:30` – `00:05:30` (60 seconds)
- **Application Routes**: `/login`, `/dashboard`, API endpoints
- **UI Elements Featured**:
  - Negative Authentication Alert banner
  - Authorized User Session Header
  - Profile Dropdown Menu (`Sign Out` action)
  - Route Guard Interceptor (Redirect to `/login`)
- **Recorded User Actions**:
  1. Re-verification of invalid credentials rejection.
  2. Re-verification of authenticated session validation.
  3. Opening profile menu and executing clean logout.
  4. Attempting direct browser navigation to internal protected URL while logged out -> Verifying route guard interceptor redirects immediately to `/login`.
- **Visual Artifacts**: `click_feedback_1792570092565.png`, `click_feedback_1792570119805.png`, `click_feedback_1792570374287.png`, `click_feedback_1792570384776.png`

---

### Scene 8: Conclusion & Verification Summary (5:30 – 6:00)
- **Timecode Range**: `00:05:30` – `00:06:00` (30 seconds)
- **Application Route**: `http://localhost:5173/` (`Executive Dashboard`)
- **UI Elements Featured**:
  - Executive Overview recap
  - 100% automated test suite passing confirmation
  - Zero TypeScript and build error signoff
- **Visual Artifacts**: `click_feedback_1792570182112.png`

---

## Route & API Endpoint Reference Table

| Route | View Component | HTTP Verb / Endpoint | Permissions |
| :--- | :--- | :--- | :--- |
| `/login` | `LoginView.tsx` | `POST /api/v1/auth/login` | Public |
| `/` / `/dashboard`| `DashboardView.tsx` | `GET /api/v1/auth/me`, `GET /api/v1/payroll/stats`| Authenticated (All Roles) |
| `/employees` | `EmployeesView.tsx` | `GET /api/v1/employees` | HR, Admin |
| `/compensation` | `CompensationView.tsx` | `GET /api/v1/salary-components`, `GET /api/v1/salary-structures` | HR, Admin |
| `/payroll` | `CorporatePayrollView.tsx`| `GET /api/v1/corporate-payroll/runs` | Payroll, Admin |
| `/attendance` | `AttendanceView.tsx` | `GET /api/v1/attendance/shifts` | HR, Admin |
| `/leave` | `LeaveView.tsx` | `GET /api/v1/leaves` | All Roles |
| `/reports` | `ReportsView.tsx` | `GET /api/v1/reports/registers` | Finance, Admin |
| `/self` | `SelfServiceView.tsx` | `GET /api/v1/self-service/profile` | Employee |
