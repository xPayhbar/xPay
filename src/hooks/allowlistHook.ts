import type { TransferRequest, PolicyViolation, PolicyConfig } from "../types.js";

const SERVICE_RECEIVING_ACCOUNT = "0.0.9268478";

export const KNOWN_SERVICES: Record<string, { name: string; category: string; receivingAccount: string }> = {
  "0.0.4567890": { name: "OpenAI GPT-4",      category: "ai",       receivingAccount: SERVICE_RECEIVING_ACCOUNT },
  "0.0.4567891": { name: "Anthropic Claude",  category: "ai",       receivingAccount: SERVICE_RECEIVING_ACCOUNT },
  "0.0.4567892": { name: "Stability AI",      category: "ai",       receivingAccount: SERVICE_RECEIVING_ACCOUNT },
  "0.0.4567893": { name: "Groq Inference",    category: "ai",       receivingAccount: SERVICE_RECEIVING_ACCOUNT },
  "0.0.8901234": { name: "Pinecone DB",       category: "infra",    receivingAccount: SERVICE_RECEIVING_ACCOUNT },
  "0.0.8901235": { name: "Alchemy RPC",       category: "infra",    receivingAccount: SERVICE_RECEIVING_ACCOUNT },
  "0.0.8901236": { name: "QuickNode",         category: "infra",    receivingAccount: SERVICE_RECEIVING_ACCOUNT },
  "0.0.8901237": { name: "IPFS / Pinata",     category: "infra",    receivingAccount: SERVICE_RECEIVING_ACCOUNT },
  "0.0.2345678": { name: "Moralis Analytics", category: "data",     receivingAccount: SERVICE_RECEIVING_ACCOUNT },
  "0.0.2345679": { name: "TheGraph API",      category: "data",     receivingAccount: SERVICE_RECEIVING_ACCOUNT },
  "0.0.2345680": { name: "Chainlink Oracle",  category: "data",     receivingAccount: SERVICE_RECEIVING_ACCOUNT },
  "0.0.2345681": { name: "Nansen Intel",      category: "data",     receivingAccount: SERVICE_RECEIVING_ACCOUNT },
  "0.0.3456789": { name: "CertiK Shield",     category: "security", receivingAccount: SERVICE_RECEIVING_ACCOUNT },
  "0.0.3456790": { name: "Forta Monitor",     category: "security", receivingAccount: SERVICE_RECEIVING_ACCOUNT },
  "0.0.3456791": { name: "Tenderly Simulate", category: "security", receivingAccount: SERVICE_RECEIVING_ACCOUNT },
  "0.0.3456792": { name: "Hexagate Risk",     category: "security", receivingAccount: SERVICE_RECEIVING_ACCOUNT },
};

export function resolveServiceName(id: string): string | undefined {
  return KNOWN_SERVICES[id.trim()]?.name;
}

export function resolveOnChainRecipient(id: string): string {
  return KNOWN_SERVICES[id.trim()]?.receivingAccount ?? id.trim();
}

export function checkAllowlist(
  req: TransferRequest,
  cfg: PolicyConfig
): PolicyViolation | null {
  if (!cfg.allowlist.enabled) return null;
  if (cfg.allowlist.accounts.length === 0) return null;
  const ok = cfg.allowlist.accounts.some(
    (a) => a.trim().toLowerCase() === req.toAccountId.trim().toLowerCase()
  );
  return ok ? null : {
    policy: "allowlist",
    reason: `${req.toAccountId} is not on the approved counterparty list`,
  };
}
