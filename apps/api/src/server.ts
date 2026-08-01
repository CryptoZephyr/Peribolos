import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { v1Router } from './routes/v1.js';
import { eventIndexer } from './services/indexer.js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const app = express();
const PORT = process.env.PORT || 3400;

// CORS: restrict to dashboard origin in production, allow all in dev/test
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : ['http://localhost:3000', 'http://localhost:3001'];

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? allowedOrigins
    : true, // Allow all in dev for convenience
  credentials: process.env.NODE_ENV === 'production'
    ? !allowedOrigins.includes('*')
    : true,
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

let server: any;
if (process.env.NODE_ENV !== 'test' && (!process.argv[1] || process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'))) {
  server = app.listen(PORT, () => {
    console.log(`Peribolos V2 Backend API listening on http://localhost:${PORT}`);
    if (process.env.NODE_ENV !== 'production' && process.env.PERIBOLOS_SEED_DEMO !== '0') {
      console.log('Demo API key seeded for local development only.');
    }
  });
}

export { app, server };
