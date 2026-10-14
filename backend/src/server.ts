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
app.use(cors({
  origin: ENV.CORS_ORIGIN,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
app.listen(port, () => {
  console.log(`✓ Payroll Management System API listening on port ${port}`);
  console.log(`✓ Ready endpoint: http://localhost:${port}/api/v1/ready`);
  console.log(`✓ Base API URL: http://localhost:${port}/api/v1`);
});

export default app;
