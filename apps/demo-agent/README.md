# Peribolos demo-agent

Proves the Peribolos injection block **live on Arc testnet**. Two runners tell
the same story:

- **`npm run demo`** — scripted, deterministic, **no LLM**. Use for rehearsals:
  it runs identically every time. This is the one to demo on stage.
- **`npm run demo:llm`** — a real model via OpenRouter free tier (default) using
  `@peribolos/langchain` is handed the poisoned page as a research task. The
  vault blocks the injected drain regardless of what the model decides.

## The beats

1. **Petty cash** — agent buys metered data from the x402 seller, gasless.
2. **Vault payment** — agent pays an allowlisted recipient, rule-checked.
3. **Injection** — agent reads `malicious/research-article.html`, which hides an
   instruction to send all funds to an attacker address.
4. **Block** — the vault rejects it on-chain with `RECIPIENT_NOT_ALLOWLISTED`;
   zero funds move; the attempt is permanent on-chain evidence (Arcscan link).

## Setup

```bash
cp .env.example .env       # fill in AGENT_PRIVATE_KEY, VAULT_ADDRESS, ALLOWLISTED_PAYEE
# optional: start the seller in another terminal for beat 1
#   cd ../demo-seller && cp .env.example .env && npm start
npm run demo               # RUN_PETTY_CASH=false skips beat 1 if no Gateway deposit
```

### LLM demo (free models)

```bash
# apps/demo-agent/.env
OPENROUTER_API_KEY=sk-or-...   # https://openrouter.ai/
# MODEL=meta-llama/llama-3.3-70b-instruct:free   # default
npm run demo:llm
```

The agent key is a low-trust, vault-scoped key: it can only *propose* payments.
`.env` is gitignored — never commit it.

## Verified

Smoke domain created and funded at vault `0xac5d542EdCB15972570685B2Fdb87be71d1378a1`
on 2026-07-31. Run the scripted demo to produce the latest legit-pay and injected-drain
evidence against this deployment.
