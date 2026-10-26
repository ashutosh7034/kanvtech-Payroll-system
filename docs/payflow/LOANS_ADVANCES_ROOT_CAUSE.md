# PayFlow HRMS & Payroll ERP — Loans & Advances Root Cause Diagnosis

## 1. Executive Summary

A forensic diagnosis was conducted on the Loans & Advances module across the frontend (`frontend/src/pages/LoansView.tsx`), API client, backend route controllers (`backend/src/modules/loans/loans.routes.ts`), Prisma schema, and live browser environment (`http://localhost:5173/loans`).

The table's display of **"No active loans recorded."** and the failure of Create, Read, Update, and Delete operations were caused by multiple cascading bugs:
1. **API Response Property Name Mismatch**: Backend returns `{ types: [...] }`, while the frontend accessed `tRes.loanTypes`.
2. **Swallowed Exceptions in Initial Data Fetch**: `loadLoans()` caught the resulting `TypeError` and silently logged it to the console without updating state or displaying an error notification.
3. **Fatal React Component Crash on Modal Open**: The sanction modal attempted `loanTypes.map(...)` on `undefined`, immediately crashing and unmounting the component.
4. **Non-Existent HTTP Endpoint on Form Submission**: Form submitted to `POST /api/v1/loans`, whereas the backend controller was mapped to `POST /api/v1/loans/apply`.
5. **Payload Key and Validation Discrepancy**: Form submitted `totalInstallments`, whereas backend Zod schema strictly demanded `tenureMonths`.
6. **Authorization Role Disparity**: The frontend displayed actions for `payroll_admin` and `payroll_pcm`, while the backend route strictly required `['finance_admin', 'company_admin', 'hr_manager']`, blocking payroll administrators with `403 Forbidden`.
7. **Missing Update / Cancel / History UI**: No interfaces existed for editing loan terms, actioning loan status (close/cancel), or inspecting repayment installments.

---

## 2. Detailed Root Cause Analysis

### Defect 1: Response Key Mismatch (`loanTypes` vs `types`)
- **Location**: `frontend/src/pages/LoansView.tsx`, lines 22–31:
  ```ts
  const [lRes, tRes, empRes]: any = await Promise.all([
    api.get('/loans'),
    api.get('/loans/types'),
    api.get('/employees')
  ]);
  setLoans(lRes.loans);
  setLoanTypes(tRes.loanTypes); // BUG: Backend returns { types: [...] }
  setEmployees(empRes.employees);

  if (tRes.loanTypes[0]) setLoanTypeId(tRes.loanTypes[0].id); // THROWS TypeError
  ```
- **Backend Response**: `backend/src/modules/loans/loans.routes.ts`, line 66:
  ```ts
  res.status(200).json({ types });
  ```
- **Impact**: `tRes.loanTypes` evaluates to `undefined`. Line 30 attempts to access index `0` of `undefined`, throwing:
  `TypeError: Cannot read properties of undefined (reading '0')`.

### Defect 2: Silent Error Swallowing
- **Location**: `frontend/src/pages/LoansView.tsx`, lines 32–34:
  ```ts
  } catch (err) {
    console.error(err);
  }
  ```
- **Impact**: The initial state of `loans` (`[]`) was preserved. The UI silently displayed the fallback text `"No active loans recorded."`, masking the fatal initialization failure from the user.

### Defect 3: React Crash on Opening "Sanction Advance / Loan"
- **Location**: `frontend/src/pages/LoansView.tsx`, lines 140–144:
  ```tsx
  <select className="form-select" value={loanTypeId} onChange={e => setLoanTypeId(e.target.value)}>
    {loanTypes.map(lt => ( // BUG: loanTypes is undefined!
      <option key={lt.id} value={lt.id}>{lt.name} (Max ₹{Number(lt.maxAmount).toLocaleString('en-IN')})</option>
    ))}
  </select>
  ```
- **Observed Browser Error**:
  ```
  TypeError: Cannot read properties of undefined (reading 'map')
      at LoansView (http://localhost:5173/src/pages/LoansView.tsx:320:161)
  ```
- **Impact**: Clicking the sanction button immediately crashed React, unmounting the entire view.

### Defect 4: Endpoint Mismatch on Loan Application (`POST /loans` vs `POST /loans/apply`)
- **Location**: `frontend/src/pages/LoansView.tsx`, line 44:
  ```ts
  await api.post('/loans', { ... });
  ```
- **Backend Definition**: `backend/src/modules/loans/loans.routes.ts`, line 151:
  `loanRouter.post('/apply', ...)`
- **Impact**: Submitting a loan resulted in HTTP `404 Not Found` (`Cannot POST /api/v1/loans`).

### Defect 5: Payload Schema Mismatch (`totalInstallments` vs `tenureMonths`)
- **Frontend Submission**:
  ```json
  {
    "employeeId": "uuid",
    "loanTypeId": "uuid",
    "principalAmount": 50000,
    "totalInstallments": 24
  }
  ```
- **Backend Zod Schema**:
  ```ts
  const schema = z.object({
    employeeId: z.string().uuid().optional(),
    loanTypeId: z.string().uuid(),
    principalAmount: z.number().positive(),
    tenureMonths: z.number().int().min(1).max(60)
  });
  ```
- **Impact**: `tenureMonths` is marked required in Zod. Any request missing `tenureMonths` throws HTTP `400 Bad Request` validation failure.

### Defect 6: Role Authorization Inconsistency
- **Frontend Visibility Check**:
  ```tsx
  {hasRole(['payroll_admin', 'payroll_pcm']) && (
    <button className="btn btn-primary" onClick={() => setShowSanctionModal(true)}>
  ```
- **Backend Route Guard**:
  ```ts
  loanRouter.post('/apply', authenticate, requireRole(['finance_admin', 'company_admin', 'hr_manager']), ...)
  loanRouter.patch('/:id/status', authenticate, requireRole(['finance_admin', 'company_admin', 'hr_manager']), ...)
  ```
- **Impact**: `payroll_admin` users can see the button in the UI, but upon clicking submit, the backend rejects the request with HTTP `403 Forbidden` (`Access denied. Requires one of roles: finance_admin, company_admin, hr_manager`).

### Defect 7: Display Property Names Inconsistent with Prisma Schema
- In `LoansView.tsx`:
  * `l.sanctionOrderNumber`: Does not exist on `EmployeeLoan` model (the model has `id`).
  * `l.loanType?.interestRate`: In Prisma schema, the column is `interestRatePct`.
  * `l.monthlyInstallment`: In Prisma schema, the column is `monthlyEmi`.
  * `l.recoveredInstallments`: In Prisma schema, repayments are stored in `repayments: LoanRepayment[]`.
  * `l.totalInstallments`: In Prisma schema, the column is `tenureMonths`.

---

## 3. Repair Plan

1. **Backend Adjustments**:
   - Normalize `loanRouter.get('/types')` response to provide `{ types, loanTypes: types }` for backwards and forwards compatibility.
   - Support both `POST /loans` and `POST /loans/apply` for loan creation.
   - Support both `tenureMonths` and `totalInstallments` in the request schema.
   - Include `payroll_admin` and `payroll_pcm` in the authorized roles for loan sanctioning and status updates.
   - Support friendly sanction identifiers (e.g., `sanctionOrderNumber` mapped to `sanctionOrderNumber ?? id`).
   - Add endpoint `PATCH /loans/:id` for controlled loan amendments (principal/tenure update for active loans without corruption).
   - Add endpoint `DELETE /loans/:id` (safe deletion only if 0 repayments have been made; otherwise rejected with instructions to use Cancel/Close).
2. **Frontend UI Repair**:
   - Fix `loadLoans()` to safely parse `tRes.types ?? tRes.loanTypes ?? []`.
   - Implement proper loading, error, and empty states so failures are immediately visible with retry buttons.
   - Fix modal dropdowns and default selection handling.
   - Add full CRUD capabilities:
     * **Create**: Sanction Loan Modal with real validation, principal limits, EMI calculation preview, and self-sanctioning warning.
     * **Read**: Table with live outstanding balance, monthly EMI, interest rate, tenure progress, and borrower details.
     * **Update / Amend**: Controlled amendment modal to modify tenure/installment amounts.
     * **Cancel / Close**: Status action buttons to Close or Cancel loans safely.
     * **Repayments Drawer**: View detailed repayment history and installment schedule.
3. **Full Automated Verification**:
   - Run backend test suite.
   - Run frontend build.
   - Perform end-to-end browser verification.
