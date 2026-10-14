# UI/UX Screen Inventory

## Shared shell
- Login, forgot/reset password, account/session page
- Role-aware navigation, institution/OU selector (only if user is authorized), notification center
- Reusable tables with server pagination, filtering, column preferences and export controls
- Confirmation dialogs, accessible validation, loading/empty/error states

## Admin and masters
- Admin dashboard and processing queues
- Institution, OU, department, designation, employee group and managed payroll group screens
- User/role/permission management and audit viewer
- Financial year and payroll period setup
- Pay band, grade scale, pay level, matrix cell, salary head and contribution mapping
- Salary structure builder, effective-dated versions, feature settings, salary-slip/report template designer
- TA allowance and system-wide salary change screens

## Payroll operations
- Employee directory, profile, employment/pay history and salary assignment
- Bulk import center (template → upload → validate → preview → commit → results)
- Payroll preview, validation exceptions, individual/bulk generation
- Generated, Verified, Finalized, Approved and returned/correction queues
- Payroll record detail with calculation explanation and immutable audit timeline
- Payslip preview/PDF, salary bill and payment scheme mapping

## Supporting modules
- Tax configuration, employee declarations, reviewer queue, annual reconciliation and tax reports
- Loan/advance products, employee requests, approval, installment/recovery ledger
- Leave types, approved leave records, salary mapping and leave-impact preview
- Arrear configuration, arrear preview, generation and processing queues
- Pay fixation configuration, before/after comparison and approval
- Increment eligibility, matrix validation, bulk generation and lifecycle queue
- Other taxable payment entry/import and lifecycle queues
- GPF configuration, employee account ledger, monthly statement builder, review/approval, closure and Broad Sheet
- Payment batches, bank-file export, reconciliation, failed payments, reversal/adjustment
- Report catalog with filters, permissions, PDF/XLSX export and generated-file history

## Employee self-service
- Employee dashboard, own profile, payslip archive, salary history
- Own tax declaration and supporting document upload
- Own GPF and loan details where applicable
- Notifications and declaration/request status

Design direction: restrained enterprise styling, strong table readability, consistent tokens, modest charts only where they add insight, no decorative gradients or placeholder buttons. Every control must be connected to a real API or clearly disabled with an explanation.
