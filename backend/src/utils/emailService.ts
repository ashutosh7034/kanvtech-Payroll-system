import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  provider: 'smtp' | 'mock';
  error?: string;
  timestamp: Date;
}

export interface IEmailProvider {
  readonly name: 'smtp' | 'mock';
  send(options: SendEmailOptions): Promise<SendEmailResult>;
  verify(): Promise<{ success: boolean; message: string }>;
}

// -------------------------------------------------------------
// Real SMTP Provider (Production / Configured Environment)
// -------------------------------------------------------------
export class SmtpEmailProvider implements IEmailProvider {
  readonly name = 'smtp' as const;
  private transporter: Transporter;
  private fromAddress: string;

  constructor(config?: {
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    pass?: string;
    from?: string;
  }) {
    const host = config?.host || process.env.SMTP_HOST || 'localhost';
    const port = Number(config?.port || process.env.SMTP_PORT || 587);
    const secure = config?.secure !== undefined ? config.secure : (process.env.SMTP_SECURE === 'true' || port === 465);
    const user = config?.user !== undefined ? config.user : process.env.SMTP_USER;
    const pass = config?.pass !== undefined ? config.pass : process.env.SMTP_PASS;

    this.fromAddress = config?.from || process.env.SMTP_FROM || 'Apex Global Tech Payroll <payroll@apexglobal.tech>';

    const transportConfig: any = {
      host,
      port,
      secure,
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production'
      }
    };

    if (user && pass) {
      transportConfig.auth = { user, pass };
    }

    this.transporter = nodemailer.createTransport(transportConfig);
  }

  async verify(): Promise<{ success: boolean; message: string }> {
    try {
      await this.transporter.verify();
      return { success: true, message: `SMTP connection established to ${process.env.SMTP_HOST}` };
    } catch (err: any) {
      return { success: false, message: `SMTP connection verification failed: ${err.message}` };
    }
  }

  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    const timestamp = new Date();
    try {
      const info = await this.transporter.sendMail({
        from: this.fromAddress,
        to: options.to,
        subject: options.subject,
        text: options.text || options.html.replace(/<[^>]+>/g, ''),
        html: options.html,
        attachments: options.attachments?.map(att => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType || 'application/pdf'
        }))
      });

      return {
        success: true,
        messageId: info.messageId,
        provider: 'smtp',
        timestamp
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Unknown SMTP error during transmission',
        provider: 'smtp',
        timestamp
      };
    }
  }
}

// -------------------------------------------------------------
// Mock Provider (Deterministic Testing & Unconfigured Dev)
// -------------------------------------------------------------
export class MockEmailProvider implements IEmailProvider {
  readonly name = 'mock' as const;
  private sentMessages: Array<SendEmailOptions & { messageId: string; timestamp: Date }> = [];
  private failureRules: Map<string, string> = new Map();

  setSimulatedFailure(recipientPattern: string, errorMessage: string) {
    this.failureRules.set(recipientPattern, errorMessage);
  }

  clearSimulatedFailures() {
    this.failureRules.clear();
  }

  getSentMessages() {
    return [...this.sentMessages];
  }

  clearSentMessages() {
    this.sentMessages = [];
  }

  async verify(): Promise<{ success: boolean; message: string }> {
    return { success: true, message: 'Mock email provider initialized and ready' };
  }

  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    const timestamp = new Date();

    // Check simulated failure rules
    for (const [pattern, errorMsg] of this.failureRules.entries()) {
      if (options.to.includes(pattern)) {
        return {
          success: false,
          error: `Simulated Provider Failure: ${errorMsg}`,
          provider: 'mock',
          timestamp
        };
      }
    }

    const messageId = `mock-msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}@apexglobal.tech`;

    this.sentMessages.push({
      ...options,
      messageId,
      timestamp
    });

    return {
      success: true,
      messageId,
      provider: 'mock',
      timestamp
    };
  }
}

// -------------------------------------------------------------
// Singleton Provider Resolver
// -------------------------------------------------------------
let activeProvider: IEmailProvider | null = null;
const mockProviderInstance = new MockEmailProvider();

export function getEmailProvider(): IEmailProvider {
  if (activeProvider) {
    return activeProvider;
  }

  // If in automated test suite or explicitly instructed to use mock
  if (process.env.EMAIL_PROVIDER === 'mock' || process.env.NODE_ENV === 'test') {
    activeProvider = mockProviderInstance;
    return activeProvider;
  }

  // Check if real SMTP credentials exist
  if (process.env.SMTP_HOST && process.env.SMTP_HOST.trim().length > 0) {
    activeProvider = new SmtpEmailProvider();
    return activeProvider;
  }

  // Fallback to Mock provider for local development without credentials
  activeProvider = mockProviderInstance;
  return activeProvider;
}

export function setCustomEmailProvider(provider: IEmailProvider | null) {
  activeProvider = provider;
}

export function getMockEmailProvider(): MockEmailProvider {
  return mockProviderInstance;
}
