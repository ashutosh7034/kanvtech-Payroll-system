# Deployment and Operations Guide

## 1. Overview
This guide provides complete instructions for configuring, deploying, monitoring, and maintaining the independent Payroll Management System.

## 2. Infrastructure Requirements
- **Operating System:** Linux (Ubuntu 22.04 LTS / Debian 12 / RHEL 9) or Windows Server 2022+
- **Node.js:** v20.x or v22.x LTS (active LTS)
- **Database:** PostgreSQL 15, 16, 17, or 18 with SSL enabled in production
- **Memory:** Minimum 4 GB RAM (8 GB recommended for 5,000+ employees)
- **Disk:** 50 GB SSD with automated snapshot backups
- **Reverse Proxy:** Nginx or Caddy with TLS 1.3

## 3. Environment Configuration
The backend requires environment variables defined in `.env`:
```env
DATABASE_URL="postgresql://postgres:root@localhost:5432/payroll_management?schema=public"
PORT=4000
NODE_ENV=production
CORS_ORIGIN=http://localhost:5173
JWT_SECRET="replace-with-a-64-character-cryptographically-secure-random-secret"
JWT_EXPIRES_IN="8h"
```

The frontend requires:
```env
VITE_API_BASE_URL="http://localhost:4000/api/v1"
```

## 4. Database Setup & Migrations
1. Create the production database:
   ```bash
   createdb -U postgres -h localhost payroll_management
   ```
2. Run Prisma migrations:
   ```bash
   cd backend
   npx prisma migrate deploy
   ```
3. Seed essential masters and initial administrative accounts:
   ```bash
   npm run seed
   ```

## 5. Build and Execution
### Backend
```bash
cd backend
npm run build
NODE_ENV=production node dist/server.js
```
Or manage with PM2:
```bash
pm2 start dist/server.js --name "payroll-api" -i max
```

### Frontend
```bash
cd frontend
npm run build
```
Serve the `dist/` folder via Nginx or any static file server.

## 6. Health & Readiness Endpoints
- `GET /api/v1/health` - Fast liveness check
- `GET /api/v1/ready` - Readiness check (validates PostgreSQL connectivity and migration state)

## 7. Backup and Restore Procedures
### Backup
Execute automated daily logical backups using `pg_dump`:
```bash
pg_dump -U postgres -h localhost -Fc -f "/var/backups/payroll_$(date +%Y%m%d_%H%M%S).dump" payroll_management
```
Retain daily backups for 90 days, monthly backups for 7 years (statutory financial requirement).

### Restore
```bash
pg_restore -U postgres -h localhost -d payroll_management_restored -c "/var/backups/payroll_20261014_110000.dump"
```

## 8. Audit and Security Safeguards
1. All payroll transitions (`GENERATED` -> `VERIFIED` -> `FINALIZED` -> `APPROVED`) are logged to immutable `AuditLog` and `PayrollTransition` tables.
2. Direct updates to finalized payroll records are prohibited at the API layer.
3. Password hashing uses standard bcrypt/scrypt.
4. Rate limiting is applied to authentication endpoints (`/api/v1/auth/login`).
