export type Currency = "HBAR" | "USDC";
export type PolicyDecision = "approved" | "blocked" | "needs_approval";

export interface PolicyViolation {
  policy: "spend_limit" | "allowlist" | "approval_threshold" | "anomaly";
  reason: string;
}

export interface TransferRequest {
  toAccountId: string;
  amount: number;
  currency: Currency;
  memo?: string;
  serviceName?: string;
  rawIntent: string;
}

export interface PolicyResult {
  decision: PolicyDecision;
  violations: PolicyViolation[];
  message: string;
}

export interface ExecutedTransaction {
  id: string;
  request: TransferRequest;
  decision: PolicyDecision;
  txHash?: string;
  timestamp: string;
  violations: PolicyViolation[];
}

export interface SpendState {
  hbar: number;
  usdc: number;
  windowStart: string;
}

export interface PolicyConfig {
  spendLimit:        { enabled: boolean; hbar: number; usdc: number };
  allowlist:         { enabled: boolean; accounts: string[] };
  approvalThreshold: { enabled: boolean; hbar: number };
  anomalyDetection:  { enabled: boolean };
}

export interface ChatRequest {
  message: string;
  conversationId: string;
  policyConfig?: Partial<PolicyConfig>;
}
