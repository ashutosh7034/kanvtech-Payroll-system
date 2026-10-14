# REST API Specification (initial contract)

Base path: `/api/v1`. JSON responses use a consistent envelope; list endpoints accept `page`, `pageSize`, `sort`, and safe filter parameters. Every endpoint requires authenticated, scoped authorization unless explicitly public.

## Auth and access
- `POST /auth/login`, `POST /auth/logout`, `POST /auth/refresh`
- `POST /auth/password/forgot`, `POST /auth/password/reset`
- `GET /auth/me`, `GET /admin/users`, `POST /admin/users`, `PATCH /admin/users/:id`
- `GET /admin/roles`, `PUT /admin/users/:id/roles`

## Organization and employees
- CRUD `/institutions`, `/organizational-units`, `/departments`, `/designations`
- `GET|POST /employees`, `GET|PATCH /employees/:id`, `POST /employees/:id/deactivate`
- `GET /employees/:id/salary-history`, `GET /employees/:id/documents`

## Masters and salary configuration
- CRUD `/financial-years`, `/payroll-periods`, `/pay-bands`, `/grade-pay-scales`, `/pay-levels`, `/pay-matrix-cells`
- CRUD `/salary-heads`, `/salary-structures`, `/salary-structures/:id/versions`
- `POST /employees/:id/salary-assignment`

## Payroll lifecycle
- `POST /payroll-runs/preview`
- `POST /payroll-runs` (idempotency key required)
- `GET /payroll-runs`, `GET /payroll-runs/:id`, `GET /payroll-runs/:id/records`
- `POST /payroll-runs/:id/verify`, `/finalize`, `/approve`, `/return`
- `POST /payroll-records/:id/recalculate` (draft/generated only)
- `GET /payroll-records/:id/explanation`, `GET /payroll-records/:id/payslip.pdf`

## Supporting modules
- CRUD `/tax/rule-sets`, `/tax/declarations`, `POST /tax/declarations/:id/submit`, `POST /tax/declarations/:id/review`
- CRUD `/loans`, `/loan-requests`, `POST /loan-requests/:id/approve`, `GET /employees/:id/loan-ledger`
- CRUD `/leave-types`, `/leave-records`, `/leave-salary-mappings`
- CRUD `/arrears/configurations`, `POST /arrears/preview`, `POST /arrears/generate`, lifecycle actions under `/arrears/:id`
- `POST /increments/preview`, `POST /increments/generate`, lifecycle actions under `/increments/:id`
- CRUD `/other-payments`, lifecycle actions under `/other-payments/:id`
- CRUD `/gpf/accounts`, `/gpf/transactions`, `/gpf/statements`, `POST /gpf/statements/:id/verify`, `/finalize`, `/approve`, `/gpf/accounts/:id/close`
- `POST /imports/:type/validate`, `POST /imports/:id/commit`, `GET /imports/:id/errors`
- `POST /payment-batches`, `POST /payment-batches/:id/export`, `POST /payment-batches/:id/reconcile`
- `GET /reports/:reportType`, `POST /reports/:reportType/export`
- `GET /audit-logs`, `GET /health`, `GET /ready`

## API safeguards
- Validate all request bodies/params with schemas.
- Recalculate financial totals on the server.
- Require idempotency for generation/import/payment actions.
- Lifecycle transitions must use compare-and-swap/version checks and append transition records.
- Exports require explicit permission and OU scope; sensitive exports should be audited.
