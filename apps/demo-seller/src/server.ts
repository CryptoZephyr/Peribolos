/**
 * Peribolos demo-seller — an x402-protected Express API on Arc testnet.
 *
 * This is the payment COUNTERPARTY in the Peribolos demo: a Peribolos-governed
 * agent (the buyer) pays this seller via Circle Gateway Nanopayments (gasless
 * x402) to unlock paid routes. This service has no dependency on the rest of
 * the Peribolos monorepo — it only needs a public seller address, never a key.
 *
 * Env vars:
 *   SELLER_ADDRESS   (required) EVM address that receives payments.
 *   PORT             (optional) default 3402.
 *   GATEWAY_NETWORK  (optional) CAIP-2 network id to accept. Default is Arc
 *                     testnet, "eip155:5042002". NOTE: the Gateway facilitator
 *                     identifies networks by CAIP-2 id (e.g. "eip155:5042002"),
 *                     not the SDK's internal chain-name key ("arcTestnet") —
 *                     see README for details.
 *   GATEWAY_FACILITATOR_URL (optional) default is Circle's TESTNET facilitator,
 *                     "https://gateway-api-testnet.circle.com". The SDK default
 *                     is the MAINNET facilitator, so this must be set explicitly
 *                     for Arc testnet to work.
 */
import express from "express";
import type { NextFunction, Request, Response } from "express";
import { createGatewayMiddleware } from "@circle-fin/x402-batching/server";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SELLER_ADDRESS = process.env.SELLER_ADDRESS;
if (!SELLER_ADDRESS || !/^0x[0-9a-fA-F]{40}$/.test(SELLER_ADDRESS)) {
  throw new Error("SELLER_ADDRESS must be a valid EVM address; refusing to start with a demo default.");
}

const PORT = Number(process.env.PORT ?? 3402);

/** Arc testnet, CAIP-2 form. See sdk/core/src/constants.ts ARC_TESTNET.id (5042002). */
const ARC_TESTNET_CAIP2 = "eip155:5042002";
const GATEWAY_NETWORK = process.env.GATEWAY_NETWORK ?? ARC_TESTNET_CAIP2;

/** Circle Gateway's testnet facilitator. The SDK default is mainnet, so this
 * must be passed explicitly to negotiate/settle payments on Arc testnet. */
const GATEWAY_FACILITATOR_URL =
  process.env.GATEWAY_FACILITATOR_URL ?? "https://gateway-api-testnet.circle.com";

/** Browser origins allowed to call this API. Comma-separated; no wildcard. */
const ALLOWED_ORIGINS = new Set(
  (process.env.CORS_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);
if (ALLOWED_ORIGINS.size === 0) {
  throw new Error("CORS_ORIGINS must list at least one trusted browser origin.");
}

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX ?? 60);
const rateLimit = new Map<string, { count: number; resetAt: number }>();

// ---------------------------------------------------------------------------
// App + Gateway middleware
// ---------------------------------------------------------------------------

const app = express();

// CORS for the explicitly configured dashboard origin only.
app.use((req, res, next) => {
  const origin = req.get("origin");
  if (origin) {
    if (!ALLOWED_ORIGINS.has(origin)) {
      res.status(403).json({ error: "Origin not allowed" });
      return;
    }
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "PAYMENT-SIGNATURE, X-PAYMENT, X-PAYMENT-RESPONSE");
    res.setHeader("Access-Control-Expose-Headers", "PAYMENT-REQUIRED, X-PAYMENT-RESPONSE");
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

app.use((req, res, next) => {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const entry = rateLimit.get(key);
  if (!entry || entry.resetAt <= now) {
    rateLimit.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    next();
    return;
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
    res.status(429).json({ error: "Too many requests" });
    return;
  }
  entry.count += 1;
  next();
});

const gateway = createGatewayMiddleware({
  sellerAddress: SELLER_ADDRESS,
  networks: GATEWAY_NETWORK,
  facilitatorUrl: GATEWAY_FACILITATOR_URL,
  description: "Peribolos demo paid API",
});

/** Small structured logger — timestamps + route so demo output is legible. */
function log(msg: string, extra?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  if (extra) {
    // eslint-disable-next-line no-console
    console.log(`[demo-seller ${ts}] ${msg}`, extra);
  } else {
    // eslint-disable-next-line no-console
    console.log(`[demo-seller ${ts}] ${msg}`);
  }
}

/** Logs every successful paid hit: payer, amount, network, route. */
function logPayment(route: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const payment = (req as unknown as { payment?: { payer: string; amount: string; network: string } }).payment;
    if (payment) {
      log("paid request settled", {
        route,
        payer: payment.payer,
        amount: payment.amount,
        network: payment.network,
      });
    }
    next();
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/** Free liveness route — no payment required. */
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    seller: SELLER_ADDRESS,
    networks: [GATEWAY_NETWORK],
  });
});

/**
 * GET /premium-data — $0.01
 * A "premium fact" payload with a fake market data point. Echoes payer,
 * amount, and network back so the demo can visibly show who paid.
 */
app.get(
  "/premium-data",
  gateway.require("$0.01"),
  logPayment("/premium-data"),
  (req: Request, res: Response) => {
    const payment = (req as unknown as { payment?: { payer: string; amount: string; network: string; transaction?: string } }).payment;

    // Deterministic mock payload — no external network calls.
    const now = new Date();
    res.json({
      fact: "Arc settles USDC transfers with sub-second finality and uses USDC itself as gas.",
      marketData: {
        symbol: "USDC/USD",
        price: 1.0001,
        volume24h: 482_193_004.12,
        asOf: now.toISOString(),
      },
      payment: payment
        ? {
            payer: payment.payer,
            amount: payment.amount,
            network: payment.network,
            transaction: payment.transaction ?? null,
          }
        : null,
    });
  },
);

/** Deterministic mock weather generator, seeded by city name — no real API call. */
function mockWeatherFor(city: string) {
  let hash = 0;
  for (let i = 0; i < city.length; i++) {
    hash = (hash * 31 + city.charCodeAt(i)) >>> 0;
  }
  const conditions = ["clear", "partly cloudy", "overcast", "light rain", "windy"] as const;
  const condition = conditions[hash % conditions.length];
  const tempC = 5 + (hash % 30); // 5..34
  const humidity = 30 + (hash % 60); // 30..89
  const windKph = 3 + (hash % 40); // 3..42

  return {
    city,
    condition,
    temperatureC: tempC,
    temperatureF: Math.round(tempC * 1.8 + 32),
    humidityPct: humidity,
    windKph,
  };
}

/**
 * GET /weather/:city — $0.001
 * The "agent autonomously pays for data" story: cheap, per-call, deterministic
 * mock weather. Not a real weather API — purely a demo payload.
 */
app.get(
  "/weather/:city",
  gateway.require("$0.001"),
  logPayment("/weather/:city"),
  (req: Request, res: Response) => {
    const payment = (req as unknown as { payment?: { payer: string; amount: string; network: string; transaction?: string } }).payment;
    const city = req.params.city;

    res.json({
      weather: mockWeatherFor(city),
      payment: payment
        ? {
            payer: payment.payer,
            amount: payment.amount,
            network: payment.network,
            transaction: payment.transaction ?? null,
          }
        : null,
    });
  },
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  log(`listening on :${PORT}`, {
    seller: SELLER_ADDRESS,
    networks: [GATEWAY_NETWORK],
    facilitatorUrl: GATEWAY_FACILITATOR_URL,
  });
});
