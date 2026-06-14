import type { TransferRequest, PolicyViolation, PolicyConfig } from "../types.js";
import { KNOWN_SERVICES } from "./allowlistHook.js";

export function checkAnomaly(
  req: TransferRequest,
  cfg: PolicyConfig
): PolicyViolation | null {
  if (!cfg.anomalyDetection.enabled) return null;
  if (!KNOWN_SERVICES[req.toAccountId.trim()])
    return { policy: "anomaly",
             reason: `Unknown recipient ${req.toAccountId} — not in known services registry` };
  const max = req.currency === "HBAR" ? 10_000 : 5_000;
  if (req.amount > max)
    return { policy: "anomaly",
             reason: `Amount ${req.amount} ${req.currency} exceeds plausible maximum (${max})` };
  if (req.amount >= 1000 && req.amount % 1000 === 0)
    return { policy: "anomaly",
             reason: `Suspicious round amount: ${req.amount} ${req.currency}` };
  return null;
}
