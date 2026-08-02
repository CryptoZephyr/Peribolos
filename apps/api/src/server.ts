import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { v1Router } from './routes/v1.js';
import { eventIndexer } from './services/indexer.js';
import { signerService } from './services/signer.js';
import { db } from './db/store.js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

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

// Readiness is intentionally stricter than liveness. Render and operators can
// distinguish an online process from a service that is safe to provision and
// execute payments with.
app.get('/ready', (_req, res) => {
  const production = process.env.NODE_ENV === 'production';
  const signer = signerService.getReadiness();
  const persistence = db.getPersistenceStatus();
  const checks = {
    signer: !production || (signer.provider === 'circle-dcw' && signer.circle.configured && !signer.circle.disabled),
    encryption: !production || Boolean(process.env.SIGNER_ENCRYPTION_KEY?.trim()),
    supabase: !production || Boolean(
      (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim()
      && (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim()
    ),
    persistence: !production || (persistence.provider === 'supabase' && persistence.configured && persistence.healthy),
  };
  const ready = Object.values(checks).every(Boolean);
  return res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    service: 'peribolos-api',
    checks,
    signer: {
      provider: signer.provider,
      circleConfigured: signer.circle.configured,
      localFallbackEnabled: signer.localFallbackEnabled,
    },
    persistence,
  });
});

// API Routes V1
app.use('/v1', v1Router);

function validateProductionConfiguration(): void {
  if (process.env.NODE_ENV !== 'production') return;
  const signer = signerService.getReadiness();
  const missing: string[] = [];
  if (signer.provider !== 'circle-dcw' || signer.circle.disabled) {
    missing.push('CIRCLE_API_KEY, ENTITY_SECRET, CIRCLE_WALLET_SET_ID');
  }
  if (!process.env.SIGNER_ENCRYPTION_KEY?.trim()) missing.push('SIGNER_ENCRYPTION_KEY');
  if (!(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim()
    && (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim()
  )) {
    missing.push('SUPABASE_URL and SUPABASE_ANON_KEY');
  }
  if (!process.env.CORS_ORIGIN?.trim()) missing.push('CORS_ORIGIN');
  if (missing.length > 0) {
    throw new Error(`Production configuration is incomplete: ${missing.join('; ')}`);
  }
  if (db.getPersistenceStatus().provider !== 'supabase' || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.warn('[API] SUPABASE_SERVICE_ROLE_KEY is not set; production readiness will remain unavailable.');
  }
}

validateProductionConfiguration();

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
    console.log(`🚀 Peribolos V2 Backend API listening on http://localhost:${PORT}`);
  });
}

export { app, server };
