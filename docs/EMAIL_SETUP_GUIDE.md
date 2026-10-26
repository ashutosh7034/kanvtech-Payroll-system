# Corporate HRMS & Payroll Suite: Email Delivery Configuration Guide

## 1. Overview

The Apex Global Tech Corporate HRMS and Payroll Engine supports automated dispatch of password-protected, branded PDF payslips directly to employee corporate email inboxes following the finalization of monthly payroll runs (`PAID` status).

The email subsystem uses a resilient **Provider Abstraction** pattern supporting:
1. **Production SMTP Delivery:** Real email delivery via enterprise SMTP gateways (AWS SES, SendGrid, Office 365, Google Workspace, Mailgun, Postmark, or on-premise Exchange).
2. **Deterministic Mock Provider:** In-memory delivery simulator used during automated tests, CI/CD pipelines, and local development where live SMTP credentials are not configured.
3. **Idempotency & Duplicate Prevention:** Every dispatch operation tracks per-recipient delivery status (`DELIVERED`, `FAILED`, `SKIPPED`), message IDs, timestamps, attempt counters, and error diagnostics in the `PayslipDispatchRecord` PostgreSQL table. Already-delivered recipients are automatically skipped on repeated dispatches unless `forceResend: true` is explicitly provided.

---

## 2. Environment Variables Reference

Configure these environment variables in `backend/.env` (or via your cloud secret manager / container orchestration):

```bash
# ==============================================================================
# Corporate SMTP Email Gateway Configuration
# ==============================================================================

# Hostname of the corporate mail server
SMTP_HOST="smtp.mailgun.org"

# Port (Standard: 587 for STARTTLS, 465 for SSL/TLS, 25 for internal relay)
SMTP_PORT=587

# Use SSL/TLS (Set 'true' for port 465, 'false' for port 587 with STARTTLS)
SMTP_SECURE=false

# SMTP Authentication Username / API Key
SMTP_USER="postmaster@mg.apexglobal.tech"

# SMTP Authentication Password / Secret
SMTP_PASS="your-smtp-secret-or-api-key"

# Display Sender Address
SMTP_FROM="Apex Global Tech Payroll <payroll@apexglobal.tech>"

# Provider Mode: 'smtp' | 'mock'
# If set to 'mock' or if SMTP_HOST is omitted, system operates in mock simulation mode
EMAIL_PROVIDER="smtp"
```

---

## 3. Provider Setup Walkthroughs

### Option A: AWS Simple Email Service (SES)
1. In the AWS SES Console, verify your sending domain (e.g., `apexglobal.tech`).
2. Generate SMTP credentials in SES &rarr; **SMTP Settings** &rarr; **Create SMTP Credentials**.
3. Configure `backend/.env`:
   ```bash
   SMTP_HOST="email-smtp.us-east-1.amazonaws.com"
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER="[Your AWS SES Access Key ID]"
   SMTP_PASS="[Your AWS SES Secret Access Key]"
   SMTP_FROM="Apex Global Tech <payroll@apexglobal.tech>"
   ```

### Option B: SendGrid / Twilio
1. Navigate to SendGrid Settings &rarr; **API Keys** &rarr; Create Key with "Mail Send" permissions.
2. Configure `backend/.env`:
   ```bash
   SMTP_HOST="smtp.sendgrid.net"
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER="apikey"
   SMTP_PASS="SG.your_sendgrid_api_key_here"
   SMTP_FROM="Apex Global Tech Payroll <payroll@apexglobal.tech>"
   ```

### Option C: Google Workspace / Gmail
1. Ensure 2-Step Verification is enabled on the sending account.
2. Create an **App Password** under Google Account &rarr; Security &rarr; App Passwords.
3. Configure `backend/.env`:
   ```bash
   SMTP_HOST="smtp.gmail.com"
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER="payroll@apexglobal.tech"
   SMTP_PASS="abcd efgh ijkl mnop"
   SMTP_FROM="Apex Global Tech Payroll <payroll@apexglobal.tech>"
   ```

### Option D: Ethereal Email (Free Real SMTP Testing)
For testing real SMTP handshakes without delivering to actual inboxes:
1. Visit [https://ethereal.email/create](https://ethereal.email/create).
2. Copy generated credentials to `backend/.env`.

---

## 4. API Endpoints Reference

### 1. Dispatch Payslips (`POST /api/v1/payroll/runs/:id/send-payslips`)
- **Required Roles:** `company_admin`, `payroll_admin`, `finance_admin`
- **Precondition:** Run status must be `PAID`.
- **Request Body (JSON):**
  ```json
  {
    "forceResend": false,
    "retryFailedOnly": false
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Payslip dispatch cycle completed: 37 delivered, 0 failed, 0 skipped (provider: smtp).",
    "provider": "smtp",
    "deliveredCount": 37,
    "failedCount": 0,
    "skippedCount": 0,
    "totalEmployees": 37,
    "recipients": [
      {
        "employeeId": "uuid",
        "employeeCode": "APEX-1001",
        "recipientEmail": "rohit.sharma@apexglobal.tech",
        "status": "DELIVERED",
        "attemptCount": 1,
        "messageId": "<msg-id@apexglobal.tech>"
      }
    ]
  }
  ```

### 2. Query Dispatch Status & Audit Records (`GET /api/v1/payroll/runs/:id/dispatch-status`)
- **Required Roles:** `company_admin`, `payroll_admin`, `finance_admin`
- **Response (200 OK):**
  ```json
  {
    "runId": "uuid",
    "runNumber": "RUN-2026-10-6552",
    "periodName": "October 2026",
    "totalSlips": 37,
    "summary": {
      "deliveredCount": 37,
      "failedCount": 0,
      "skippedCount": 0,
      "pendingCount": 0
    },
    "dispatches": [ ... ]
  }
  ```

---

## 5. Security & Confidentiality Rules

1. **No Credentials in Frontend:** SMTP user/passwords are never passed to the frontend or included in HTTP response payloads.
2. **Access Control:** Employees can only download their own payslip PDF via authenticated ESS endpoints. Calling `send-payslips` as an employee returns `403 Forbidden`.
3. **Audit Logging:** Every bulk dispatch generates an immutable audit record in the `AuditLog` table capturing actor ID, timestamp, recipient count, and provider name.
