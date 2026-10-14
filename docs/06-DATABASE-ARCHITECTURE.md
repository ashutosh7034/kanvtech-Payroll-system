# Database Architecture

Production database: PostgreSQL with Prisma migrations. Use `Decimal`/PostgreSQL `numeric` for money, never binary floating-point. Store timestamps in UTC and payroll-effective dates as date values where appropriate.

## Core entities
- `Institution`, `OrganizationalUnit`, `Department`, `Designation`
- `User`, `Role`, `Permission`, `UserRole`, `Session`
- `Employee`, `EmploymentHistory`, `EmployeeBankAccount`, `EmployeeTaxProfile`, `EmployeeDocument`
- `FinancialYear`, `PayrollPeriod`
- `PayBand`, `GradePayScale`, `PayLevel`, `PayMatrixCell`
- `SalaryHead`, `SalaryStructure`, `SalaryStructureVersion`, `SalaryStructureLine`, `EmployeeSalaryAssignment`
- `PayrollRun`, `PayrollRecord`, `PayrollLine`, `PayrollCalculationSnapshot`, `PayrollTransition`
- `TaxRuleSet`, `TaxRuleVersion`, `TaxDeclaration`, `TaxDeclarationDocument`, `TaxCalculation`
- `LoanProduct`, `EmployeeLoan`, `LoanInstallment`, `LoanRecovery`
- `LeaveType`, `LeaveRecord`, `LeaveSalaryMapping`
- `ArrearType`, `ArrearConfiguration`, `ArrearCalculation`, `PayFixation`
- `IncrementBatch`, `EmployeeIncrement`
- `OtherPaymentType`, `OtherPayment`
- `GpfAccount`, `GpfTransaction`, `GpfStatement`, `GpfStatementLine`, `GpfClosure`
- `PaymentBatch`, `PaymentInstruction`, `PaymentReconciliation`
- `ImportJob`, `ImportRowError`, `ReportJob`, `Notification`, `AuditLog`
- `InstitutionSetting`, `FeatureFlag`, `ConfigurationVersion`

## Integrity rules
- Unique employee identifier within institution (or globally if the institution requires it).
- Unique payroll record per employee + period + run type unless a documented correction/re-run workflow is used.
- Unique increment per employee + effective date.
- Unique idempotency key for bulk generation, imports and payment-file creation.
- Every payroll line references the salary-head and configuration version used.
- Every finalized/approved payroll has immutable calculation snapshot and transition audit.
- GPF balance is derived/reconciled from opening balance + ledger entries; never stored as the only source of truth.
- Every query must scope by institution and, where relevant, OU/employee.
- Use optimistic concurrency/version columns for lifecycle transitions and transactions for multi-record changes.
