import { prisma } from '../../config/db.js';
import { getEmailProvider } from '../../utils/emailService.js';
import { recordAudit } from '../../middleware/auth.js';
import type { Request } from 'express';

export interface CreateNotificationParams {
  companyId: string;
  userId: string;
  title: string;
  message: string;
  link?: string;
  type?: string;
  entityId?: string;
}

/**
 * Creates an in-app notification for a specific user within tenant isolation.
 */
export async function createInAppNotification(params: CreateNotificationParams) {
  try {
    return await prisma.inAppNotification.create({
      data: {
        companyId: params.companyId,
        userId: params.userId,
        title: params.title,
        message: params.message,
        link: params.link,
        type: params.type || 'EXPENSE_CLAIM',
        entityId: params.entityId,
        isRead: false
      }
    });
  } catch (err: any) {
    console.error('Failed to create in-app notification:', err.message);
    return null;
  }
}

/**
 * Notifies all authorized HR & Admin reviewers in the tenant when a new expense claim is submitted.
 * Strictly adheres to tenant boundaries and prevents notifying unauthorized recipients or the claimant themselves.
 */
export async function notifyExpenseReviewersOnSubmission(
  claim: {
    id: string;
    claimNumber?: string | null;
    title: string;
    totalAmount: any;
    claimDate: Date;
    createdAt: Date;
    employee: {
      id: string;
      companyId: string;
      firstName: string;
      lastName: string;
      employeeCode: string;
      department?: { name: string } | null;
    };
  },
  claimantUserId?: string
) {
  const companyId = claim.employee.companyId;
  const claimantName = `${claim.employee.firstName} ${claim.employee.lastName}`;
  const claimRef = claim.claimNumber || `EXP-${claim.id.slice(0, 8).toUpperCase()}`;
  const amountStr = Number(claim.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  // 1. Resolve authorized reviewers in this company only
  const reviewerRoles = ['finance_admin', 'company_admin', 'hr_manager'];
  const eligibleUsers = await prisma.user.findMany({
    where: {
      companyId,
      active: true,
      userRoles: {
        some: {
          role: {
            name: { in: reviewerRoles }
          }
        }
      },
      // Do not notify claimant if they also happen to hold an admin role
      ...(claimantUserId ? { id: { not: claimantUserId } } : {})
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      username: true
    }
  });

  const notificationTitle = `New Reimbursement Claim: ${claimRef}`;
  const notificationMessage = `${claimantName} (${claim.employee.employeeCode}) submitted a claim for ₹${amountStr}: "${claim.title}".`;
  const notificationLink = `/expenses?claimId=${claim.id}`;

  const emailProvider = getEmailProvider();

  for (const user of eligibleUsers) {
    // A. In-app notification
    await createInAppNotification({
      companyId,
      userId: user.id,
      title: notificationTitle,
      message: notificationMessage,
      link: notificationLink,
      type: 'EXPENSE_CLAIM_SUBMITTED',
      entityId: claim.id
    });

    // B. Email notification (non-blocking, failsafe, sanitizes sensitive data)
    if (user.email) {
      emailProvider
        .send({
          to: user.email,
          subject: `[PayFlow] Action Required: New Expense Claim from ${claimantName} (${claimRef})`,
          html: `
            <div style="font-family: sans-serif; line-height: 1.6; color: #1e293b;">
              <h3 style="color: #0f172a; margin-bottom: 8px;">New Expense Reimbursement Claim</h3>
              <p>An expense claim has been submitted and is awaiting approval:</p>
              <table style="width: 100%; max-width: 500px; border-collapse: collapse; margin: 16px 0;">
                <tr><td style="padding: 6px 0; color: #64748b;">Claim Reference:</td><td style="font-weight: 600;">${claimRef}</td></tr>
                <tr><td style="padding: 6px 0; color: #64748b;">Claimant:</td><td style="font-weight: 600;">${claimantName} (${claim.employee.employeeCode})</td></tr>
                <tr><td style="padding: 6px 0; color: #64748b;">Title:</td><td>${claim.title}</td></tr>
                <tr><td style="padding: 6px 0; color: #64748b;">Total Amount:</td><td style="font-weight: 700; color: #0284c7;">₹${amountStr}</td></tr>
                <tr><td style="padding: 6px 0; color: #64748b;">Submission Date:</td><td>${new Date(claim.createdAt).toLocaleDateString()}</td></tr>
              </table>
              <p style="margin-top: 16px;">
                <a href="${process.env.CORS_ORIGIN || 'http://localhost:5173'}/expenses?claimId=${claim.id}" 
                   style="background: #0284c7; color: #ffffff; padding: 8px 16px; border-radius: 4px; text-decoration: none; font-size: 14px; font-weight: 600; display: inline-block;">
                  Review & Approve Claim
                </a>
              </p>
            </div>
          `
        })
        .catch(err => {
          console.error(`Email delivery failure to reviewer ${user.email}:`, err.message);
        });
    }
  }

  return { notifiedCount: eligibleUsers.length };
}

/**
 * Notifies the claimant employee when their reimbursement claim has been reviewed (APPROVED / REJECTED).
 */
export async function notifyClaimantOnAction(
  claim: {
    id: string;
    claimNumber?: string | null;
    title: string;
    totalAmount: any;
    employeeId: string;
    status: string;
    rejectionReason?: string | null;
    employee: {
      id: string;
      companyId: string;
      firstName: string;
      lastName: string;
      workEmail: string;
    };
  },
  reviewerName: string
) {
  const companyId = claim.employee.companyId;
  const isApproved = claim.status === 'APPROVED';
  const isCorrection = claim.status === 'CORRECTION_REQUESTED';
  const isPaid = claim.status === 'PAID';
  const statusLabel = isApproved ? 'Approved' : isCorrection ? 'Correction Requested' : isPaid ? 'Paid' : 'Rejected';
  const claimRef = claim.claimNumber || `EXP-${claim.id.slice(0, 8).toUpperCase()}`;
  const amountStr = Number(claim.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  // Locate the user account for the employee
  const user = await prisma.user.findFirst({
    where: {
      employeeId: claim.employeeId,
      companyId
    },
    select: { id: true, email: true }
  });

  const title = `Expense Claim ${statusLabel}: ${claimRef}`;
  const message = isApproved
    ? `Your claim "${claim.title}" for ₹${amountStr} has been approved by ${reviewerName}. It will be included in the upcoming payroll cycle.`
    : isCorrection
    ? `Corrections requested for your claim "${claim.title}" by ${reviewerName}.${claim.rejectionReason ? ` Reason: ${claim.rejectionReason}` : ''} Please open the claim, update the required details, and resubmit.`
    : isPaid
    ? `Your claim "${claim.title}" for ₹${amountStr} has been recorded as paid.`
    : `Your claim "${claim.title}" for ₹${amountStr} was rejected by ${reviewerName}.${claim.rejectionReason ? ` Reason: ${claim.rejectionReason}` : ''}`;

  if (user) {
    await createInAppNotification({
      companyId,
      userId: user.id,
      title,
      message,
      link: `/expenses?claimId=${claim.id}`,
      type: isApproved ? 'EXPENSE_CLAIM_APPROVED' : isCorrection ? 'EXPENSE_CLAIM_CORRECTION_REQUESTED' : isPaid ? 'EXPENSE_CLAIM_PAID' : 'EXPENSE_CLAIM_REJECTED',
      entityId: claim.id
    });
  }

  // Email to claimant
  const recipientEmail = user?.email || claim.employee.workEmail;
  if (recipientEmail) {
    const emailProvider = getEmailProvider();
    emailProvider
      .send({
        to: recipientEmail,
        subject: `[PayFlow] Status Update: ${title}`,
        html: `
          <div style="font-family: sans-serif; line-height: 1.6; color: #1e293b;">
            <h3 style="color: ${isApproved ? '#16a34a' : '#dc2626'}; margin-bottom: 8px;">
              Expense Claim ${isApproved ? 'Approved' : 'Rejected'}
            </h3>
            <p>${message}</p>
            <p><strong>Claim Reference:</strong> ${claimRef}</p>
            <p><strong>Total Amount:</strong> ₹${amountStr}</p>
            <p><strong>Reviewed by:</strong> ${reviewerName}</p>
          </div>
        `
      })
      .catch(err => {
        console.error(`Email delivery failure to claimant ${recipientEmail}:`, err.message);
      });
  }
}
