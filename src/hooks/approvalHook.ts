import type { TransferRequest, PolicyViolation, PolicyConfig } from "../types.js";

export function checkApprovalThreshold(
  req: TransferRequest,
  cfg: PolicyConfig
): PolicyViolation | null {
  if (!cfg.approvalThreshold.enabled) return null;
  if (req.currency !== "HBAR") return null;
  return req.amount >= cfg.approvalThreshold.hbar
    ? { policy: "approval_threshold",
        reason: `${req.amount} HBAR meets approval threshold (${cfg.approvalThreshold.hbar} HBAR)` }
    : null;
}
