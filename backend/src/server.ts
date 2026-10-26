import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ENV } from './config/env.js';
import { checkDatabaseConnection } from './config/db.js';
import { apiRouter } from './routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
const allowedOrigins = ENV.CORS_ORIGIN.includes(',')
  ? ENV.CORS_ORIGIN.split(',').map((s) => s.trim())
  : (ENV.CORS_ORIGIN === '*' ? true : ENV.CORS_ORIGIN);

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Correlation ID & Request Tracking Middleware (with input sanitization against header injection)
app.use((req, res, next) => {
  const rawId = (req.headers['x-correlation-id'] as string) || (req.headers['x-request-id'] as string);
  // Strict format validation: safe alphanumeric, hyphen, underscore, dot (max 64 chars)
  const isValid = typeof rawId === 'string' && /^[a-zA-Z0-9_\-.]{1,64}$/.test(rawId);
  const correlationId = isValid ? rawId : (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `req_${Date.now()}`);
  req.headers['x-correlation-id'] = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  next();
});

// Health endpoint
app.get('/api/v1/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'payroll-management-api',
    version: '2.1.26',
    timestamp: new Date().toISOString()
  });
});

// Readiness endpoint
app.get('/api/v1/ready', async (_req, res) => {
  const isDbConnected = await checkDatabaseConnection();
  if (!isDbConnected) {
    res.status(503).json({
      status: 'not_ready',
      database: 'disconnected',
      timestamp: new Date().toISOString()
    });
    return;
  }
  res.status(200).json({
    status: 'ready',
    database: 'connected',
    timestamp: new Date().toISOString()
  });
});

// Telemetry & Metrics endpoint (JSON SRE Golden Signals)
app.get('/api/v1/metrics', async (_req, res) => {
  const isDbConnected = await checkDatabaseConnection();
  res.status(200).json({
    service: 'payroll-management-api',
    status: isDbConnected ? 'healthy' : 'degraded',
    uptimeSeconds: Math.floor(process.uptime()),
    memoryUsageMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
    nodeVersion: process.version,
    database: isDbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Mount All APIs
app.use('/api/v1', apiRouter);

// Central error handling
app.use(errorHandler);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested API endpoint does not exist'
    }
  });
});

const port = ENV.PORT;
app.listen(port, '0.0.0.0', () => {
  console.log(`✓ Payroll Management System API listening on port ${port} (0.0.0.0)`);
  console.log(`✓ Ready endpoint: http://localhost:${port}/api/v1/ready`);
  console.log(`✓ Base API URL: http://localhost:${port}/api/v1`);
});

export default app;
