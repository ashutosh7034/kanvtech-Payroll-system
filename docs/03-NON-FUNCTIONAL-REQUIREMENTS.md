# Non-Functional Requirements

- **NFR-01 Security:** secure password hashing; short-lived access; revocable sessions; least privilege; server-side authorization; rate limiting; secure cookies or documented token strategy; validated inputs; safe upload handling; restricted exports.
- **NFR-02 Financial correctness:** decimal arithmetic for all monetary values; documented rounding; deterministic, versioned calculations; transactionally consistent state changes; immutable finalized snapshots.
- **NFR-03 Auditability:** record actor, action, timestamp, target entity, correlation ID and safe before/after differences for sensitive operations; never log secrets.
- **NFR-04 Privacy:** minimize PII exposure, mask bank/PAN/mobile where configured, scope employees by OU and self-service identity, restrict exports.
- **NFR-05 Reliability:** PostgreSQL transactions, constraints, unique keys, idempotency for generation/import/payment actions, backup and restore runbooks.
- **NFR-06 Maintainability:** TypeScript end-to-end, modular monolith, domain services, schema validation, migrations, documented API contracts and testable business logic.
- **NFR-07 Usability/accessibility:** responsive layouts, keyboard access, readable financial tables, clear validation, loading/empty/error states and confirmations for irreversible operations.
- **NFR-08 Performance:** pagination and indexed filtering; avoid loading all employees/transactions at once; define institutional volume targets before setting numeric SLAs.
- **NFR-09 Compatibility:** current supported evergreen browsers; PostgreSQL production; separate test database; no SQLite-only schema assumptions.
- **NFR-10 Operability:** health/readiness endpoints, structured logs, metrics guidance, environment-based configuration and documented rollback.
- **NFR-11 Compliance posture:** do not claim legal compliance until current applicable laws/rates and institution-specific rules have been verified and approved.
