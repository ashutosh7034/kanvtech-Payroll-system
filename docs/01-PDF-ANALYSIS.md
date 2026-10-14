# PDF Analysis — Payroll Management System

## Source and method
Primary source: `payrol structure.pdf`, 53 pages, a screenshot-based Samarth Payroll Management System guide (document number PMSG-003, version 2.1.26; page 1 shows a last-updated date of May 09, 2026). The document is image-based, so this analysis used OCR as a navigation aid and the rendered page images as the source of truth. OCR may misread small text; verify exact labels against the PDF before implementation.

## Page-by-page inventory
- **Page 1:** Module overview, payroll purpose, key features, prerequisites and initial role descriptions.
- **Page 2:** Additional payroll features: income tax declarations, other taxable payments, GPF, pension/gratuity, increments, advances, recovery, leave and arrears.
- **Page 3:** Pay fixation, payslips, bill generation, reports, prerequisites and payroll roles.
- **Page 4:** Role descriptions and administrator dashboard overview.
- **Page 5:** Payroll settings, financial cycle and financial-year configuration.
- **Page 6:** Financial-cycle settings, increment count/interval/percentage and pay-band categories.
- **Page 7:** Pay-band categories, grade-pay scales, levels and pay-matrix setup.
- **Page 8:** Pay-matrix fields, payroll entries and salary component configuration.
- **Page 9:** Salary structure templates, system-wide changes and employee/payroll groups.
- **Page 10:** Employee group management, managed payroll groups and feature settings.
- **Page 11:** Feature-setting controls for payslip, tax, contributions, employee information and report visibility.
- **Page 12:** TA allowance master, report templates and bulk upload management introduction.
- **Page 13:** Bulk upload categories including salary, progression, recurring/one-time data, city categories, arrears, pay matrix, PF/GPF and running advances; loan configuration begins.
- **Page 14:** Loan/advance heads and master settings; role mapping and responsibilities.
- **Page 15:** Role-user mapping, bank details, pay commissions, tax declaration and GPF/PF subscription settings.
- **Page 16:** Other payment listing, PFMS/salary component codes and income-tax configuration.
- **Page 17:** Income-tax sections, tax slabs, constants, surcharge slabs and employer contribution settings.
- **Page 18:** All Applications/Menu and employee payroll status categories.
- **Page 19:** Individual/bulk salary generation and processing steps.
- **Page 20:** Generated salary review, verification, finalization, approval, reports, provident-fund contributions and income-tax section.
- **Page 21:** Tax declarations, review/correction, final submission, previous income and salary structure overview.
- **Page 22:** Archive salary, archive logs, FSCM mapping and payment-scheme configuration.
- **Page 23:** Salary bill generation and salary deduction mapping prerequisites.
- **Page 24:** Manage salary deductions, bill/deduction details and employer contribution management.
- **Page 25:** Reversed contribution details, advances/loans, loan request/approval and other taxable payment sections.
- **Page 26:** Other taxable payment entry, processing, verification, finalization, approval and approved list.
- **Page 27:** Other taxable payment impact and leave salary component/leave mapping.
- **Page 28:** Leave salary mapping and arrear process introduction.
- **Page 29:** Arrear types/configuration, date range validation and arrear generation.
- **Page 30:** Arrear processing, verification, finalization, approval and payment modes.
- **Page 31:** Pay-fixation arrears: configuration and salary-component inputs.
- **Page 32:** Pay-fixation arrears: generate, process, verify, finalize, approve and payment.
- **Page 33:** Increment prerequisites, pay matrix validation and financial-cycle increment configuration.
- **Page 34:** Increment generation, processing, verification, finalization, approval and approved list.
- **Page 35:** Pay-matrix/next-increment-date setup and other-section reports including PFMS and CFMS.
- **Page 36:** Payroll reports: pre-processing, monthly salary comparison, bank data, payslips, employee-wise salary and income-tax reports.
- **Page 37:** Salary TDS, other payment TDS, employee income tax, approved salary, provident fund, salary head and monthly bank advice reports.
- **Page 38:** OU-wise, other payment, financial-year, contingent bill, remittance, earnings/deductions and related reports.
- **Page 39:** Additional report details and notification/email-related information.
- **Page 40:** Employee self-service and employee user-account setup.
- **Page 41:** GPF module configuration and GPF financial-year setup.
- **Page 42:** GPF display settings, employee account and transaction management.
- **Page 43:** GPF statement/processing screens and financial-year processing details.
- **Page 44:** GPF processing details, records and statement generation.
- **Page 45:** Financial-year GPF processing examples and monthly/yearly data behavior.
- **Page 46:** GPF processing, statement review/approval and account closure.
- **Page 47:** Final closed GPF accounts and closure/final payment handling.
- **Page 48:** GPF Broad Sheet and yearly reporting.
- **Page 49:** Audit, access/security details and GPF-related settings.
- **Page 50:** GPF FAQ and behavior clarifications.
- **Page 51:** GPF FAQ: approved statement immutability and related questions.
- **Page 52:** Financial-year setup, payroll periods and period examples.
- **Page 53:** Glossary and GPF transaction terminology.

## Document-derived modules
1. Payroll settings and financial cycle.
2. Pay-band categories, grade-pay scales, levels, pay matrices, salary heads and salary structure templates.
3. Organization/OU, employee groups, managed payroll groups and user-role mapping.
4. Employee salary configuration, individual/bulk salary generation and salary processing.
5. Payroll lifecycle: Generated → Verified → Finalized → Approved.
6. Income-tax declarations, tax configuration, previous-employment income, review and reports.
7. Loans/advances, recoveries and installment deductions.
8. Leave-linked salary and leave mapping, including HPL/EOL examples.
9. Arrears, pay-fixation arrears and increments.
10. Other taxable payments (e.g. child education allowance, honorarium, incentives, separately processed bonus).
11. PF/GPF subscriptions, GPF accounts, monthly transactions, statements, interest, closure and reports.
12. Salary bills, deductions, employer contributions, FSCM/payment-scheme mapping and bank/payment reports.
13. Bulk upload templates and row/category-specific data imports.
14. Payslips, employee self-service, configurable display/masking and report exports.
15. Audit logs, archive/reversal handling, dashboards and FAQs.

## Important source-derived details
- Page 1 describes the product as a university/HEI payroll system with salary calculation, salary slips, deductions, increments, arrears, loans, GPF, tax, reports and budget/financial integration.
- Pages 3–4 list the core payroll roles: `payroll_admin`, `payroll_admin_view`, `payroll_ou_admin`, `payroll_pcm`, `payroll_pda`, `payroll_pvo`, `payroll_pfo`, `payroll_ar_salary`, and `payroll_incometax_admin`.
- Pages 5–12 define financial-cycle configuration, salary masters, feature flags, TA allowance, report templates and bulk upload categories.
- Pages 18–21 describe salary generation and the Generated/Verified/Finalized/Approved flow, plus income-tax declaration review and salary archiving.
- Pages 22–25 describe FSCM salary bill mapping, deductions, employer contributions, advances/loans and other taxable payments.
- Pages 27–33 cover leave-linked salary, arrears, pay fixation and increments.
- Pages 35–38 enumerate payroll, income-tax, PF/GPF, bank advice, OU-wise, financial-year, remittance, contingent-bill and other reports.
- Pages 41–53 cover GPF settings, financial years, statements, closure, reporting, FAQs and glossary.

## Distinguish source facts from engineering decisions
**Explicitly supported by the guide:** listed modules, named roles, the four-stage payroll lifecycle, feature toggles, financial-year configuration, bulk-upload categories, GPF statement processing, configurable salary-slip/report fields, and report categories.

**Implementation decisions:** React/TypeScript/Vite, Express/TypeScript, Prisma, PostgreSQL, REST endpoints, modular-monolith boundaries, database constraints, session/token design, CI, and test frameworks. These are selected by the build brief, not dictated by the PDF.

**Requires institutional clarification:** exact statutory tax rates and effective dates; rounding rules; GPF interest convention and credit timing; detailed pay/allowance formulas; permission boundaries for all role actions; approval separation/combination; archive reversal authority; exact banking/PFMS/FSCM integrations; institution-specific leave and pay-fixation policies; and retention/backup periods.
