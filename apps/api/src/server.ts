import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { v1Router } from './routes/v1.js';
import { eventIndexer } from './services/indexer.js';
import { db } from './db/store.js';

const app = express();
const PORT = process.env.PORT || 3400;

// CORS: restrict browser access to explicitly trusted origins in production.
// A wildcard is intentionally ignored in production because credentialed
// requests cannot use `Access-Control-Allow-Origin: *` safely.
const configuredOrigins = (process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? (configuredOrigins.filter((origin) => origin !== '*').length > 0
      ? configuredOrigins.filter((origin) => origin !== '*')
      : ['https://peribolos.vercel.app'])
  : configuredOrigins.length > 0
    ? configuredOrigins
    : ['http://localhost:3000', 'http://localhost:3001'];

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? (requestOrigin, callback) => {
        callback(null, !requestOrigin || allowedOrigins.includes(requestOrigin));
      }
    : true, // Allow all in dev for convenience
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));

// Rate Limiter: max 200 requests per 1-minute window
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'TOO_MANY_REQUESTS',
    message: 'Too many requests from this IP. Please wait before retrying.'
  }
});
app.use(limiter);

// Health Check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'peribolos-api',
    version: '2.0.0',
    network: 'Arc Testnet (5042002)',
    timestamp: new Date().toISOString()
  });
});

// API Routes V1
app.use('/v1', v1Router);

// Global Error Handler — catches unhandled errors, prevents process crash
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[API] Unhandled error:', err.message, err.stack);
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred.'
      : err.message
  });
});

// Start Event Indexer only outside tests
const isTestRuntime =
  process.env.NODE_ENV === 'test' ||
  process.env.PERIBOLOS_DISABLE_INDEXER === '1' ||
  process.argv.some((a) => a.includes('test') || a.includes('node:test'));
if (!isTestRuntime) {
  eventIndexer.start();
}

// Ensure demo API key is seeded for instant testing
const demoKeyRaw = 'pb_live_demo1234567890abcdef1234567890abcdef';
const crypto = await import('node:crypto');
const demoKeyHash = crypto.createHash('sha256').update(demoKeyRaw).digest('hex');

if (!db.getApiKeyByHash(demoKeyHash)) {
  db.addApiKey({
    id: 'key_demo',
    workspaceId: 'ws_default',
    agentId: 'ag_demo',
    keyPrefix: demoKeyRaw.substring(0, 12),
    keyHash: demoKeyHash,
    name: 'Demo Agent API Key',
    status: 'active',
    createdAt: new Date().toISOString()
  });
}

let server: any;
if (process.env.NODE_ENV !== 'test' && (!process.argv[1] || process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'))) {
  server = app.listen(PORT, () => {
    console.log(`🚀 Peribolos V2 Backend API listening on http://localhost:${PORT}`);
    console.log(`🔑 Demo API Key for testing: ${demoKeyRaw}`);
  });
}

export { app, server };
