import type { TransferRequest, PolicyViolation, PolicyConfig } from "../types.js";

export const KNOWN_SERVICES: Record<string, { name: string; category: string }> = {
  "0.0.4567890": { name: "OpenAI GPT-4",     category: "ai" },
  "0.0.4567891": { name: "Anthropic Claude",  category: "ai" },
  "0.0.4567892": { name: "Stability AI",      category: "ai" },
  "0.0.4567893": { name: "Groq Inference",    category: "ai" },
  "0.0.8901234": { name: "Pinecone DB",       category: "infra" },
  "0.0.8901235": { name: "Alchemy RPC",       category: "infra" },
  "0.0.8901236": { name: "QuickNode",         category: "infra" },
  "0.0.8901237": { name: "IPFS / Pinata",     category: "infra" },
  "0.0.2345678": { name: "Moralis Analytics", category: "data" },
  "0.0.2345679": { name: "TheGraph API",      category: "data" },
  "0.0.2345680": { name: "Chainlink Oracle",  category: "data" },
  "0.0.2345681": { name: "Nansen Intel",      category: "data" },
  "0.0.3456789": { name: "CertiK Shield",     category: "security" },
  "0.0.3456790": { name: "Forta Monitor",     category: "security" },
  "0.0.3456791": { name: "Tenderly Simulate", category: "security" },
  "0.0.3456792": { name: "Hexagate Risk",     category: "security" },
};

export function resolveServiceName(id: string): string | undefined {
  return KNOWN_SERVICES[id.trim()]?.name;
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
