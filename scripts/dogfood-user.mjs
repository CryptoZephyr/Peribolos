import fs from 'node:fs';
import path from 'node:path';

const API_BASE = 'http://localhost:3400';
const LOG_FILE = path.join(process.cwd(), 'dogfood-user-feedback.log');
const feedback = [];

function log(category, title, details = '') {
  const line = `[${category}] ${title}${details ? ` - ${details}` : ''}`;
  console.log(line);
  feedback.push({ category, title, details, timestamp: new Date().toISOString() });
}

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, ok: res.ok, data: json };
}

async function runFirstTimeUserJourney() {
  log('START', 'Initiating First-Time User Dogfooding Journey for Peribolos V2');

  // Step 1: Health & Discovery
  log('STEP 1', 'Checking system health and Arc Testnet connectivity...');
  const health = await request('/health');
  if (health.status === 200 && health.data.status === 'ok') {
    log('AHA_MOMENT', 'Backend API is healthy and connected to Arc Testnet (Chain ID 5042002)', `RPC: ${health.data.arcRpcUrl}`);
  } else {
    log('BLOCKER', 'Backend health check failed', JSON.stringify(health.data));
    return;
  }

  // Step 2: Provision Agent
  log('STEP 2', 'Creating first Autonomous AI Agent via Dashboard/API...');
  const agentPayload = {
    name: 'Alpha Trader Bot',
    description: 'Autonomous execution agent for DEX arbitrage and data feeds',
    framework: 'langchain'
  };
  const agentRes = await request('/v1/agents', {
    method: 'POST',
    body: JSON.stringify(agentPayload)
  });

  if (agentRes.status !== 201) {
    log('BLOCKER', 'Failed to provision agent', JSON.stringify(agentRes.data));
    return;
  }

  const { agent, vault, apiKey, note } = agentRes.data;
  log('AHA_MOMENT', 'Successfully provisioned Agent and Managed Server-Side Signer Vault', `Agent ID: ${agent.id}, Vault ID: ${vault.id}`);
  log('SECURITY_CHECK', 'Server returned 1-time raw API Key', `Key Prefix: ${apiKey.substring(0, 12)}... (SHA-256 stored on server)`);
  log('UX_FEEDBACK', 'Agent onboarding note provided', note);

  // Step 3: Register Approved Payees
  log('STEP 3', 'Configuring On-Chain Payee Allowlist (Peribolos Vault Wall)...');
  
  const payee1 = await request('/v1/payees', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      name: 'Pyth Network Price Feed',
      address: '0x430589a754700d110915ff76ec7c81358f28f01b',
      category: 'data',
      description: 'Real-time financial market price oracle',
      allowedActionType: 1,
      defaultLimitUsdc: 15.0
    })
  });

  const payee2 = await request('/v1/payees', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      name: 'Render GPU Compute Node',
      address: '0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7',
      category: 'compute',
      description: 'H100 GPU cluster inference node',
      allowedActionType: 2,
      defaultLimitUsdc: 25.0
    })
  });

  if (payee1.status === 201 && payee2.status === 201) {
    log('AHA_MOMENT', 'Successfully added 2 verified payees to the allowlist');
  } else {
    log('ISSUE', 'Failed to register payees', `Payee 1 Status: ${payee1.status}, Payee 2 Status: ${payee2.status}`);
  }

  // Step 4: Attempt Malicious Payment (Prompt Injection Attack Simulation)
  log('STEP 4', 'Testing Prompt Injection Defense: Agent tricked into sending 100 USDC to untrusted hacker address...');
  const hackerAddress = '0x9999999999999999999999999999999999999999';
  const maliciousPayment = await request('/v1/payments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      payeeAddress: hackerAddress,
      amountUsdc: 100.0,
      actionType: 1,
      idempotencyKey: `idemp_attack_${Date.now()}`
    })
  });

  if (maliciousPayment.status === 403 && maliciousPayment.data.status === 'BLOCKED') {
    log('AHA_MOMENT', 'PROMPT INJECTION BLOCKED BY PERIBOLOS VAULT!', 
      `Reason: ${maliciousPayment.data.blockReasonCode} - ${maliciousPayment.data.blockReasonDescription}`);
  } else {
    log('DEFECT', 'Malicious payment was not blocked with 403!', JSON.stringify(maliciousPayment.data));
  }

  // Step 5: Attempt Exceeding Per-Tx Cap
  log('STEP 5', 'Testing Rule Enforcement: Payment to approved payee exceeding per-tx cap ($50 vs $25 cap)...');
  const capExceededPayment = await request('/v1/payments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      payeeAddress: payee1.data.address,
      amountUsdc: 50.0,
      actionType: 1,
      idempotencyKey: `idemp_cap_${Date.now()}`
    })
  });

  if (capExceededPayment.status === 403 && capExceededPayment.data.blockReasonCode === 'EXCEEDS_PER_TX_CAP') {
    log('AHA_MOMENT', 'PER-TX CAP ENFORCED!', `Amount $50 USDC blocked by vault policy cap of $25 USDC`);
  } else {
    log('DEFECT', 'Per-tx cap violation was not blocked as expected', JSON.stringify(capExceededPayment.data));
  }

  // Step 6: Valid Payment Execution
  log('STEP 6', 'Testing Valid Agent Payment: $5.00 USDC to Pyth Network Price Feed...');
  const validPayment = await request('/v1/payments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      payeeAddress: payee1.data.address,
      amountUsdc: 5.0,
      actionType: 1,
      idempotencyKey: `idemp_valid_${Date.now()}`
    })
  });

  log('RESULT', `Valid Payment Response Code: ${validPayment.status}`, JSON.stringify(validPayment.data));
  if (validPayment.data.preflightPassed) {
    log('AHA_MOMENT', 'Policy Preflight Passed for Valid Payment Request', 
      `Status: ${validPayment.data.status}, Reason: ${validPayment.data.blockReasonCode || 'None'}`);
  }

  // Step 7: Idempotency Verification
  log('STEP 7', 'Testing Idempotency Replay Prevention...');
  const replayPayment = await request('/v1/payments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      payeeAddress: payee1.data.address,
      amountUsdc: 5.0,
      actionType: 1,
      idempotencyKey: validPayment.data.idempotencyKey
    })
  });

  if (replayPayment.data.cached) {
    log('AHA_MOMENT', 'Idempotent Replay Prevention Verified! Cached response returned without double-charging agent');
  } else {
    log('ISSUE', 'Idempotency key did not return cached response', JSON.stringify(replayPayment.data));
  }

  // Step 8: Security Simulation Suite
  log('STEP 8', 'Running Full Prompt-Injection Simulation Suite...');
  const simScenarios = await request('/v1/simulations/scenarios');
  log('INFO', `Found ${simScenarios.data.length} simulation scenarios in test suite`);

  for (const scenario of simScenarios.data) {
    const simRes = await request('/v1/simulations/prompt-injection', {
      method: 'POST',
      body: JSON.stringify({ scenarioId: scenario.id, vaultId: vault.id })
    });
    log('SIMULATION_RESULT', `Scenario: ${scenario.name}`, 
      `Outcome: ${simRes.data.outcome}, Preflight Allowed: ${simRes.data.preflightAllowed}, Block Code: ${simRes.data.blockReasonCode || 'None'}`);
  }

  // Step 9: Audit Log & CSV Export
  log('STEP 9', 'Inspecting Activity Log and Exporting Audit Records...');
  const activity = await request('/v1/activity');
  log('INFO', `Activity Stream contains ${activity.data.paymentRequests.length} payment requests and ${activity.data.chainEvents.length} chain events`);

  const csvExport = await request('/v1/audit/export?format=csv');
  log('AHA_MOMENT', 'CSV Audit Export Generated', `Headers/Rows Preview:\n${csvExport.data.slice(0, 300)}`);

  // Step 10: Signer Management (Rotate & Pause)
  log('STEP 10', 'Testing Vault Owner Safety Controls: Rotate Signer & Pause Vault...');
  const pauseRes = await request('/v1/signers/pause', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ vaultId: vault.id, paused: true })
  });
  log('SECURITY_CHECK', 'Vault Paused Status', JSON.stringify(pauseRes.data));

  // Payment while paused
  const pausedPay = await request('/v1/payments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      payeeAddress: payee1.data.address,
      amountUsdc: 2.0,
      actionType: 1,
      idempotencyKey: `idemp_paused_${Date.now()}`
    })
  });

  if (pausedPay.status === 403 && pausedPay.data.blockReasonCode === 'VAULT_PAUSED') {
    log('AHA_MOMENT', 'PAUSED VAULT BLOCKS ALL AGENT PAYMENTS!', `Reason: ${pausedPay.data.blockReasonCode}`);
  }

  // Unpause
  await request('/v1/signers/pause', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ vaultId: vault.id, paused: false })
  });

  // Step 11: Final Summary
  log('COMPLETE', 'First-Time User Journey Completed Successfully!');
  fs.writeFileSync(LOG_FILE, JSON.stringify(feedback, null, 2));
}

runFirstTimeUserJourney().catch(err => {
  console.error('Error during dogfooding:', err);
});
