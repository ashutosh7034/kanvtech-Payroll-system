# Corporate HRMS & Payroll Engine: Security & Compliance Checklist

## 1. Role-Based Authorization Matrix

| Endpoint / Operation | Minimum Required Role | Verified Behavior | Test Verification |
| :--- | :--- | :--- | :--- |
| `POST /compensation/components` | `company_admin`, `payroll_admin` | Rejects regular users with 403 Forbidden | `matrix50Scenarios.test.ts` (Scen. 1) |
| `PUT /compensation/components/:id` | `company_admin`, `payroll_admin` | Rejects unprivileged modification | `matrix50Scenarios.test.ts` (Scen. 2) |
| `POST /compensation/structures` | `company_admin`, `payroll_admin` | Gated to payroll administration | `matrix50Scenarios.test.ts` (Scen. 4) |
| `POST /compensation/assign` | `company_admin`, `payroll_admin`, `hr_manager` | Requires HR or payroll role | `matrix50Scenarios.test.ts` (Scen. 7) |
| `PUT /employees/:id/payroll-policy` | `company_admin`, `payroll_admin`, `hr_manager` | Gated statutory policy modification | `matrix50Scenarios.test.ts` (Scen. 48) |
| `POST /corporate-payroll/runs/:id/advance` | Stage-gated: Processor for Draft->Calc; Admin for Approve | Gated approval workflow | `matrix50Scenarios.test.ts` (Scen. 35-37) |
| `POST /corporate-payroll/runs/:id/payment` | `finance_admin`, `company_admin` | Dual-control disbursement gating | `corporate.test.ts` |
| `GET /self-service/payslips/:id` | `employee` (Owned record only) | Ownership check enforces `slip.employeeId == user.employeeId` | `matrix50Scenarios.test.ts` (Scen. 39) |
| `GET /employees` (directory) | Any authenticated user | Masks `bankAccountNumber`, `panNumber` for non-privileged | `matrix50Scenarios.test.ts` (Scen. 40) |

---

## 2. Sensitive Data Privacy & Masking Standards

1. **Bank Account Details**:
   - In general employee directory listings, account numbers for non-privileged callers are masked (`••••••••1234`).
   - Unmasked banking records are restricted to payroll administrators, finance disbursers, and the authenticated owner.
2. **Tax Identification Numbers (PAN, UAN, ESIC)**:
   - PAN numbers are masked as `XXXXX1234F` on public views.
   - UAN and ESIC numbers are omitted from general directory payloads.
3. **Compensation Structures**:
   - Standard employees cannot query other employees' compensation records (`salaryStructure: null` returned for peers).

---

## 3. Application Security Controls

### 3.1 Formula Engine Sandbox Security
- **No Dynamic Code Execution**: Prohibits `eval()`, `new Function()`, `setTimeout()`, and shell process execution.
- **Lexical AST Tokenization**: Expressions are parsed into an explicit Abstract Syntax Tree.
- **Identifier Whitelist**: Identifiers are restricted to known salary component codes and approved math functions (`MIN`, `MAX`, `ROUND`, `CEIL`, `FLOOR`).
- **Cycle Detection**: Direct and indirect circular formula references are caught during compilation using DFS recursion stack analysis, preventing denial-of-service (DoS) stack overflows.

### 3.2 CSV Spreadsheet Formula Injection (CSV Injection / DDE)
- When generating CSV exports (Salary Register, Bank Advice), all string fields are sanitized using `sanitizeCsvCell()`.
- Leading characters that trigger formula execution in spreadsheet software (`=`, `+`, `-`, `@`, `\t`, `\r`) are automatically escaped by prepending a single quote (`'`).

### 3.3 Multi-Tenancy & Company Boundary Isolation
- Every database query in Prisma includes a tenant filter `where: { companyId: req.user.companyId }`.
- Cross-company resource ID lookups return `404 Not Found` or `403 Forbidden`.

### 3.4 Audit Trail Logging
The platform records comprehensive audit records in `PayrollAuditTrail` and `CorporatePayrollTransition`:
- **Actor Identity**: User ID, username, and user full name.
- **Action Type**: E.g. `CREATE_SALARY_COMPONENT`, `UPDATE_PAYROLL_POLICY`, `ADVANCE_PAYROLL_STAGE`.
- **Resource Identifier**: Target table name and record UUID.
- **Before / After Snapshot**: JSON delta of modified properties.
- **Timestamp**: High-precision UTC timestamp.

---

## 4. Operational Security Recommendations

1. **Production Secret Management**:
   - Rotate `JWT_SECRET` prior to production deployment; store secrets in AWS Secrets Manager, HashiCorp Vault, or equivalent KMS.
2. **HTTPS / TLS 1.3**:
   - Enforce TLS encryption in transit for all client-to-API and API-to-PostgreSQL connections.
3. **Database Network Isolation**:
   - PostgreSQL should reside in a private VPC subnet inaccessible from the public internet.
4. **Periodic Penetration Testing**:
   - Schedule annual third-party application security assessments and statutory compliance audits.
