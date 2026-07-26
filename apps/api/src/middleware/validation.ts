import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

const ethereumAddressRegex = /^0x[0-9a-fA-F]{40}$/;
const txHashRegex = /^0x[0-9a-fA-F]{64}$/;

export const paymentSchema = z.object({
  payeeAddress: z.string().regex(ethereumAddressRegex, {
    message: 'payeeAddress must be a 20-byte 0x-prefixed hex address.'
  }),
  amountUsdc: z.number().positive({
    message: 'amountUsdc must be a positive number.'
  }),
  actionType: z.number().int().min(0).max(255).optional().default(1),
  idempotencyKey: z.string().min(1).optional(),
  metadataHash: z.string().regex(txHashRegex, {
    message: 'metadataHash must be a 32-byte 0x-prefixed hex string.'
  }).optional()
});

export const createAgentSchema = z.object({
  name: z.string().min(1, 'Agent name is required'),
  description: z.string().optional().default('AI agent managed by Peribolos'),
  framework: z.enum(['langchain', 'openai-agents-sdk', 'crewai', 'custom']).optional().default('langchain'),
  workspaceId: z.string().optional().default('ws_default'),
  vaultAddress: z.string().regex(ethereumAddressRegex).optional(),
  ownerAddress: z.string().regex(ethereumAddressRegex).optional()
});

export const createPayeeSchema = z.object({
  name: z.string().min(1, 'Payee name is required'),
  address: z.string().regex(ethereumAddressRegex, {
    message: 'address must be a valid 0x-prefixed hex address'
  }),
  category: z.enum(['api', 'data', 'compute', 'service', 'other']).optional().default('api'),
  description: z.string().optional().default(''),
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
  amountUsdc: z.number().positive({ message: 'positive amountUsdc required' }),
  txHash: z.string().regex(txHashRegex, {
    message: 'txHash must be a real 32-byte transaction hash'
  }),
  fromAddress: z.string().regex(ethereumAddressRegex).optional()
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
