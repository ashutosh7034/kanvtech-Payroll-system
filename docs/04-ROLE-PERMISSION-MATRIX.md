# Role and Permission Matrix

This is a conservative initial mapping from role descriptions in PDF pages 3–4 and 14–15. The PDF describes responsibility areas but does not fully specify every action permission. Final action-level permissions require institution approval.

| Role | Primary responsibility from PDF | Initial allowed scope | Important restriction/open point |
|---|---|---|---|
| `payroll_admin` | Full payroll administration | Configure masters, users/roles, feature settings; broad payroll administration | High-risk approval/archive actions should be separately audited |
| `payroll_admin_view` | Read-only access | Read payroll data and reports | No create/edit/import/generate/approve |
| `payroll_ou_admin` | Configure/manage payroll for assigned OU and child OUs | OU-scoped employee/payroll configuration and review | Must not access other OUs |
| `payroll_pcm` | Payroll Change Manager | Configure salary components and update employee salary heads | No automatic final approval unless explicitly granted |
| `payroll_pda` | Payroll Dealing Assistant | Generate individual/bulk salaries; prepare processing | Must not approve own generated payroll by default |
| `payroll_pvo` | Payroll Verifying Officer | Verify generated payroll | Cannot silently edit finalized/approved records |
| `payroll_pfo` | Payroll Finalizing Officer | Finalize verified payroll | Cannot alter frozen calculation snapshot |
| `payroll_ar_salary` | Payroll Approving Officer | Approve finalized salary | Cannot approve unfinalized or invalid payroll |
| `payroll_incometax_admin` | Income-tax administration | Tax configuration/declaration review and tax reports | Tax rules changes must be versioned and approved |
| `employee_self_service` | Employee portal (implementation role) | Read own payslips, declarations, GPF/loan data; submit own declarations/requests | Strict self-only scope |
| `platform_admin` | Optional technical administration (implementation role) | Tenant/user provisioning and operational health | No default access to payroll PII or approval powers |

## Permission vocabulary
`read`, `create`, `update`, `deactivate`, `import`, `generate`, `verify`, `finalize`, `approve`, `reject_return`, `archive`, `reverse`, `export`, `manage_config`.

All checks must be enforced in backend middleware/services and scoped by institution/OU/employee. UI visibility is not a security boundary. Require separation of duties for generation, verification, finalization and approval unless the institution explicitly approves an exception.
