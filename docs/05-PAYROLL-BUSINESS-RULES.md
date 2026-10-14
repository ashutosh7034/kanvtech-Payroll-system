# Payroll Business Rules and Clarifications

## Rules supported by the source
1. The documented lifecycle is Generated → Verified → Finalized → Approved (PDF pp. 19–20; similar staged processing appears for increments, arrears and other payments).
2. Financial year and payroll period are configurable; the 2026–2027 example is not the only year (PDF pp. 5–6).
3. Salary structures depend on institution-configured pay bands, grade scales, levels, pay-matrix cells and salary heads (PDF pp. 6–9).
4. Increment generation validates pay band/level/matrix cell and uses configured number/interval/percentage or matrix logic (PDF pp. 6–8, 33–34).
5. Tax declarations are financial-year based; tax is processed after declaration review/final submission in the described workflow (PDF pp. 20–21).
6. Only approved leave records should feed leave-related salary calculations; the guide describes leave mapping and configured date ranges (PDF pp. 27–28).
7. Arrear configuration has unique names and overlapping date ranges for the same employee/head must be prevented (PDF pp. 28–29).
8. GPF statements, balances and closures require ledger-style records and staged processing; the FAQ says approved statements should not be edited (PDF pp. 47–53).
9. The guide identifies feature flags for salary slip fields, masking, report behavior and salary configuration (PDF pp. 10–12).
10. Payment/bank reporting is separate from salary calculation and approval (PDF pp. 22–25, 35–38).

## Rules that must not be invented
- Income-tax slabs, rebates, cess, surcharge, exemptions and effective dates.
- GPF interest calculation basis, compounding, monthly credit convention and rounding.
- Exact DA/HRA/TA/NPA formulas, caps and city/pay-level eligibility.
- Leave deduction formulas and partial-period day-count conventions.
- Increment rounding/matrix progression details where configuration is insufficient.
- Loan interest method, installment rounding and recovery priority.
- Arrear treatment for tax, PF/GPF and employer contributions.
- Whether one person may hold multiple lifecycle roles or approve their own work.
- Archive/reversal authority, OTP requirements and retention period.
- Bank file format, payment API availability, PFMS/CFMS/FSCM integration contracts.

## Safe implementation behavior
Until the institution approves a missing rule, mark the relevant configuration as `BLOCKED_PENDING_POLICY`; allow draft/preview where safe, but do not finalize production payroll using a guessed formula. Persist calculation inputs, rule version IDs and explanation lines. Finalized/approved payroll is immutable; corrections use an explicit reversal/adjustment workflow.
