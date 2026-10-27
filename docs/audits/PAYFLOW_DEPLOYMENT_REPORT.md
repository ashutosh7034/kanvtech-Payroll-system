# PAYFLOW DEPLOYMENT & RELEASE READINESS REPORT

**Date:** October 27, 2026  
**Repository:** `https://github.com/ashutosh7034/kanvtech-Payroll-system.git`  
**Current Branch:** `main` (tracking `origin/main`)  
**Deployment Status:** **LOCAL VERIFICATION COMPLETE — AWAITING EXPLICIT USER AUTHORIZATION TO PUSH / DEPLOY**

---

## 1. Hosting Architecture & Service Topology

| Component | Target Platform | Live Production URL | Configuration File | Build Command | Output / Start Command |
|---|---|---|---|---|---|
| **Frontend** | **Vercel** | `https://kanvtech-payroll-system.vercel.app` | `vercel.json` | `npm run build --prefix frontend` | `frontend/dist` (Vite SPA) |
| **Backend** | **Render** | `https://kanvtech-payroll-system.onrender.com/api/v1` | `render.yaml` | `npm install && npx prisma generate && npm run build` | `npx prisma migrate deploy && npm start` |
| **Database** | **Render / Neon Managed PostgreSQL** | Internal connection string | Managed | Automatic schema sync via Prisma | Postgres 15+ |
| **CI/CD** | **GitHub Actions** | Triggered on push to `main` | `.github/workflows/ci.yml` | Full test & build pipeline | Gated deployment trigger |

---

## 2. Environment Variables Specification

### A. Frontend (Vercel)
- `VITE_API_BASE_URL`: `https://kanvtech-payroll-system.onrender.com/api/v1` (points to the live Render backend).
- `NODE_VERSION`: `20.x`

### B. Backend (Render)
- `NODE_ENV`: `production`
- `PORT`: `10000` (Render default)
- `DATABASE_URL`: Production PostgreSQL connection string.
- `JWT_SECRET`: Production cryptographic key for JWT signing.
- `CORS_ORIGIN`: `https://kanvtech-payroll-system.vercel.app`

---

## 3. Deployment Trigger Mechanics

1. **GitHub Repository Sync**:
   - Both Vercel and Render are integrated via GitHub Webhooks connected to branch `main`.
2. **Automated Deployment Flow Upon Authorized Push**:
   - **Step 1 (GitHub CI)**: `.github/workflows/ci.yml` runs full backend test suite (374 tests) and frontend build check.
   - **Step 2 (Vercel Frontend)**: Automatically pulls `main`, executes `npm run build --prefix frontend`, and serves the updated SPA at `https://kanvtech-payroll-system.vercel.app`.
   - **Step 3 (Render Backend)**: Automatically pulls `main`, runs `npx prisma migrate deploy` applying `20261027000000_leave_loan_enhancements`, compiles TypeScript, and restarts the web service without downtime.

---

## 4. Safety Guardrails & Authorization Status

- **Status**: **NOT DEPLOYED TO PRODUCTION YET**.
- In strict adherence to Section 15 and Section 20 of the Master Execution Prompt:
  > *"Do not commit, push, deploy, reset a database, or initiate a real financial transaction without explicit authorization."*
- All code, database migrations, tests, and CI configurations are prepared, verified, and staged locally.
- Awaiting user review and explicit command to commit and push to `origin/main`.
