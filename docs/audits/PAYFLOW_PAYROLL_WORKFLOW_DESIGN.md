# PAYFLOW — Payroll Workflow Architecture & Specification

**Document Reference**: `PAYFLOW-WORKFLOW-DESIGN-002`  
**Execution Timestamp**: `2026-10-26T12:05:00+05:30`  
**Standard**: Indian Corporate Payroll / ISO 27001 / SOC 2 Type II  
**Status**: `VERIFIED & OPERATIONAL`

---

## 1. Executive Summary

This specification establishes PAYFLOW's authoritative corporate payroll workflow design, synthesizing the best functional patterns from Spine HRNG and Saral PayPack while preserving PAYFLOW's modern SaaS architecture, TypeScript type safety, and strict financial segregation controls.

---

## 2. 7-Stage Deterministic State Machine

```
[STAGE 1: DRAFT] ──> [STAGE 2: VALIDATE] ──> [STAGE 3: CALCULATE]
       ^                     │
       │ (Recalculate)       v
       └────────────── [STAGE 4: REVIEW]
                             │
                             v
                       [STAGE 5: APPROVE]
                             │
                             v
                    [STAGE 6: PAYMENT_READY]
                             │
                             v
                        [STAGE 7: PAID]
```

### 2.1 Sequential Stage Mapping

| Stage | System Status | Enterprise UI Action | Required Inputs | Operation Performed | Permitted Roles | Blocking Conditions |
|:---:|:---|:---|:---|:---|:---|:---|
| **1** | `DRAFT` | **Initialize Monthly Batch** | `periodId` | Enrolls all eligible active/probation employees for calendar month | `payroll_admin`, `payroll_processor`, `company_admin` | Period is already locked/paid; Non-existent period |
| **2** | `VALIDATED` | **Validate Attendance & Inputs** | Run ID, attendance, LOP | Scans for missing salary structures, LOP days, mid-month joins | `payroll_admin`, `payroll_processor`, `company_admin` | Run not in `DRAFT` state |
| **3** | `CALCULATED` | **Calculate Pay Slips** | Run ID, CTC formulas, loans | Computes earnings, deductions, PF/ESI/PT, and loan EMIs via Decimal.js | `payroll_admin`, `payroll_processor`, `company_admin` | Run not in `VALIDATED` state; Zero eligible employees |
| **4** | `REVIEWED` | **Audit Variance & Freeze** | Run ID, prior run | Audits variance delta against prior batch and flags high deductions (>50%) | `payroll_admin`, `company_admin` | Run not in `CALCULATED` state |
| **5** | `APPROVED` | **Authorize Disbursement** | Run ID, authorization | Formal executive signoff enforcing Segregation of Duties (SOD) | `finance_admin`, `company_admin` | Run not in `REVIEWED` state; Initiator attempting self-approval |
| **6** | `PAYMENT_READY` | **Generate Bank Payment File** | Run ID | Generates electronic bank payment advice (NEFT register) | `finance_admin`, `company_admin` | Run not in `APPROVED` state |
| **7** | `PAID` | **Record Bank UTR & Finalize** | Run ID, Bank UTR | Confirms settlement reference, recovers loan EMIs, releases slips to ESS | `finance_admin`, `company_admin` | Missing UTR; Run not in `PAYMENT_READY` state |

---

## 3. Financial Controls & Governance Rules

1. **Controlled Recalculation**:
   - Before executive signoff, an authorized admin can return a run from `REVIEWED` back to `VALIDATED` via `POST /runs/:id/recalculate` to adjust attendance, arrears, or incentives.
   - Once a run reaches `PAID`, recalculation is permanently locked (`400 Bad Request`).
2. **Segregation of Duties (SOD)**:
   - The user who initialized, validated, or reviewed the payroll run cannot approve it. An independent finance executive or company administrator is strictly required.
3. **Decoupled Payout vs. Finalization**:
   - `APPROVED` certifies calculation accuracy.
   - `PAYMENT_READY` exports the bank advice.
   - `PAID` requires explicit settlement reference (Bank UTR).
   - Payslips are strictly hidden from Employee Self-Service until Stage 7 (`PAID`).
