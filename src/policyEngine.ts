import type {
  TransferRequest, PolicyResult, PolicyViolation, PolicyConfig,
} from "./types.js";
import { checkSpendLimit }        from "./hooks/spendLimitHook.js";
import { checkAllowlist }         from "./hooks/allowlistHook.js";
import { checkApprovalThreshold } from "./hooks/approvalHook.js";
import { checkAnomaly }           from "./hooks/anomalyHook.js";

export const DEFAULT_POLICY_CONFIG: PolicyConfig = {
  spendLimit: {
    enabled: true,
    hbar: Number(process.env.POLICY_SPEND_LIMIT_HBAR ?? 500),
    usdc: Number(process.env.POLICY_SPEND_LIMIT_USDC ?? 100),
  },
  allowlist: {
    enabled: true,
    accounts: (process.env.POLICY_ALLOWED_ACCOUNTS ?? "")
      .split(",").filter(Boolean),
  },
  approvalThreshold: {
    enabled: true,
    hbar: Number(process.env.POLICY_APPROVAL_THRESHOLD_HBAR ?? 100),
  },
  anomalyDetection: { enabled: true },
};

export function evaluatePolicy(
  request: TransferRequest,
  config: PolicyConfig = DEFAULT_POLICY_CONFIG
): PolicyResult {
  const violations: PolicyViolation[] = [
    checkAllowlist(request, config),
    checkAnomaly(request, config),
    checkApprovalThreshold(request, config),
    checkSpendLimit(request, config),
  ].filter((v): v is PolicyViolation => v !== null);

  if (violations.length === 0)
    return { decision: "approved", violations: [], message: "All policies passed." };

  const hardBlock = violations.some(
    (v) => v.policy === "spend_limit" || v.policy === "allowlist"
  );

  return hardBlock
    ? { decision: "blocked",        violations,
        message: `Blocked: ${violations.map((v) => v.reason).join("; ")}` }
    : { decision: "needs_approval", violations,
        message: `Needs approval: ${violations.map((v) => v.reason).join("; ")}` };
}
