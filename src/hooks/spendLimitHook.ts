import type { TransferRequest, PolicyViolation, PolicyConfig } from "../types.js";

export interface SpendState {
  hbar: number;
  usdc: number;
  windowStart: string;
}

let state: SpendState = {
  hbar: 0, usdc: 0,
  windowStart: new Date().toISOString(),
};

function ensureFresh(): void {
  if (Date.now() - new Date(state.windowStart).getTime() >= 86_400_000)
    state = { hbar: 0, usdc: 0, windowStart: new Date().toISOString() };
}

export function getSpendState(): SpendState {
  ensureFresh();
  return { ...state };
}

export function resetSpendState(): void {
  state = { hbar: 0, usdc: 0, windowStart: new Date().toISOString() };
}

export function recordSpend(amount: number, currency: "HBAR" | "USDC"): void {
  ensureFresh();
  if (currency === "HBAR") state.hbar += amount;
  else state.usdc += amount;
}

export function checkSpendLimit(
  req: TransferRequest,
  cfg: PolicyConfig
): PolicyViolation | null {
  if (!cfg.spendLimit.enabled) return null;
  const s     = getSpendState();
  const used  = req.currency === "HBAR" ? s.hbar : s.usdc;
  const limit = req.currency === "HBAR"
    ? cfg.spendLimit.hbar : cfg.spendLimit.usdc;
  return used + req.amount > limit
    ? { policy: "spend_limit",
        reason: `Daily ${req.currency} limit is ${limit} — used ${used.toFixed(2)}, requested ${req.amount}` }
    : null;
}
