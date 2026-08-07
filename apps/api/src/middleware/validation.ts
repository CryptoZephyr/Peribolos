import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

const ethereumAddressRegex = /^0x[0-9a-fA-F]{40}$/;
const txHashRegex = /^0x[0-9a-fA-F]{64}$/;

/** USDC amounts are represented in whole 6-decimal ERC-20 units on Arc. */
function hasUsdcPrecision(value: number): boolean {
  const scaled = value * 1_000_000;
  const rounded = Math.round(scaled);
  return Number.isSafeInteger(rounded) && Math.abs(scaled - rounded) < 1e-7;
}

export function usdcAmountToUnits(value: number): bigint {
  if (!Number.isFinite(value) || value <= 0 || !hasUsdcPrecision(value)) {
    throw new Error('USDC amount must be positive and use no more than 6 decimal places.');
  }
  return BigInt(Math.round(value * 1_000_000));
}

export const paymentSchema = z.object({
  payeeAddress: z.string().regex(ethereumAddressRegex, {
    message: 'payeeAddress must be a 20-byte 0x-prefixed hex address.'
  }),
  amountUsdc: z.number().positive({
    message: 'amountUsdc must be a positive number.'
  }).refine(hasUsdcPrecision, {
    message: 'amountUsdc must use no more than 6 decimal places (USDC precision).'
  }),
  actionType: z.number().int().min(0).max(255).optional().default(1),
  idempotencyKey: z.string().min(1).max(200).optional(),
  metadataHash: z.string().regex(txHashRegex, {
    message: 'metadataHash must be a 32-byte 0x-prefixed hex string.'
  }).optional()
});

export const createAgentSchema = z.object({
  name: z.string().min(1, 'Agent name is required').max(120, 'Agent name is too long'),
  description: z.string().max(500, 'Agent description is too long').optional().default('AI agent managed by Peribolos'),
  framework: z.enum(['langchain', 'openai-agents-sdk', 'crewai', 'custom']).optional().default('langchain'),
  workspaceId: z.string().max(120).optional().default('ws_default'),
  vaultAddress: z.string().regex(ethereumAddressRegex).optional(),
  ownerAddress: z.string().regex(ethereumAddressRegex).optional()
});

export const createPayeeSchema = z.object({
  name: z.string().min(1, 'Payee name is required').max(120, 'Payee name is too long'),
  address: z.string().regex(ethereumAddressRegex, {
    message: 'address must be a valid 0x-prefixed hex address'
  }),
  category: z.enum(['api', 'data', 'compute', 'service', 'other']).optional().default('api'),
  description: z.string().max(500, 'Payee description is too long').optional().default(''),
  allowedActionType: z.number().int().min(0).max(255).optional().default(1),
  defaultLimitUsdc: z.number().positive().optional().default(10.0),
  workspaceId: z.string().optional().default('ws_default')
});

export const updateVaultSchema = z.object({
  dailyCapUsdc: z.number().positive().optional(),
  perTxCapUsdc: z.number().positive().optional(),
  allowedActionsBitmap: z.number().int().min(0).optional(),
  agentKeyExpiresAt: z.number().int().positive().optional(),
  paused: z.boolean().optional(),
  mode: z.enum(['offline', 'live']).optional(),
  address: z.string().regex(ethereumAddressRegex).optional(),
  ownerAddress: z.string().regex(ethereumAddressRegex).optional()
});

export const fundVaultSchema = z.object({
  amountUsdc: z.number().positive({ message: 'positive amountUsdc required' }).refine(hasUsdcPrecision, {
    message: 'amountUsdc must use no more than 6 decimal places (USDC precision).'
  }),
  txHash: z.string().regex(txHashRegex, {
    message: 'txHash must be a real 32-byte transaction hash'
  }),
  fromAddress: z.string().regex(ethereumAddressRegex).optional()
});

export const createApiKeySchema = z.object({
  agentId: z.string().min(1).max(120).optional(),
  name: z.string().trim().min(1).max(120).optional().default('Agent API Key'),
  role: z.enum(['operator', 'agent']).optional().default('agent')
});

export const signerTargetSchema = z.object({
  vaultId: z.string().min(1).max(120),
  agentId: z.string().min(1).max(120)
});

export const signerConfirmSchema = signerTargetSchema.extend({
  newSignerAddress: z.string().regex(ethereumAddressRegex),
  txHash: z.string().regex(txHashRegex)
});

export const signerPauseSchema = z.object({
  vaultId: z.string().min(1).max(120),
  paused: z.boolean()
});

export const signerRevokeSchema = z.object({
  agentId: z.string().min(1).max(120),
  vaultId: z.string().min(1).max(120)
});

export const promptInjectionSchema = z.object({
  scenarioId: z.string().min(1).max(120).optional(),
  vaultId: z.string().min(1).max(120).optional()
});

export function validateBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const firstIssue = err.issues[0];
        return res.status(400).json({
          error: 'INVALID_PAYLOAD',
          message: firstIssue ? `${firstIssue.path.join('.')}: ${firstIssue.message}` : 'Validation error',
          details: err.issues
        });
      }
      return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'Invalid request payload' });
    }
  };
}
