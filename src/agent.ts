import { ChatAnthropic }    from "@langchain/anthropic";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver }      from "@langchain/langgraph";
import { tool }             from "@langchain/core/tools";
import { z }                from "zod";
import { randomUUID }       from "crypto";
import { evaluatePolicy, DEFAULT_POLICY_CONFIG } from "./policyEngine.js";
import { executeTransfer }                        from "./hederaClient.js";
import { getSpendState, recordSpend }             from "./hooks/spendLimitHook.js";
import { KNOWN_SERVICES, resolveServiceName }     from "./hooks/allowlistHook.js";
import type { PolicyConfig, TransferRequest }     from "./types.js";

export const pendingApprovals = new Map<string, TransferRequest>();
const checkpointer = new MemorySaver();

const checkSpendTool = tool(
  async () => JSON.stringify(getSpendState()),
  { name: "check_spend_state",
    description: "Return today's HBAR and USDC spend totals.",
    schema: z.object({}) }
);

const listServicesTool = tool(
  async () => JSON.stringify(KNOWN_SERVICES),
  { name: "list_approved_services",
    description: "List all known service accounts available for payment.",
    schema: z.object({}) }
);

function makeTransferTool(config: PolicyConfig) {
  return tool(
    async ({ toAccountId, amount, currency, memo }) => {
      const request: TransferRequest = {
        toAccountId, amount,
        currency: currency as "HBAR" | "USDC",
        memo, serviceName: resolveServiceName(toAccountId),
        rawIntent: memo ?? `Transfer ${amount} ${currency} to ${toAccountId}`,
      };
      const result = evaluatePolicy(request, config);
      if (result.decision === "blocked")
        return JSON.stringify({ status: "BLOCKED", reason: result.message,
          violations: result.violations });
      if (result.decision === "needs_approval") {
        const pendingId = `pending-${Date.now()}-${randomUUID().slice(0, 6)}`;
        pendingApprovals.set(pendingId, request);
        return JSON.stringify({ status: "NEEDS_APPROVAL", pendingId,
          reason: result.message, amount, currency, toAccountId,
          serviceName: request.serviceName });
      }
      try {
        const tx = await executeTransfer(request);
        recordSpend(amount, currency as "HBAR" | "USDC");
        return JSON.stringify({ status: "SUCCESS", txHash: tx.txHash,
          amount, currency, toAccountId, serviceName: request.serviceName });
      } catch (err: unknown) {
        return JSON.stringify({ status: "ERROR",
          reason: err instanceof Error ? err.message : String(err) });
      }
    },
    { name: "transfer_payment",
      description: "Transfer HBAR or USDC to a Hedera account. All transfers pass through spend limit, allowlist, approval threshold, and anomaly detection before execution.",
      schema: z.object({
        toAccountId: z.string().describe("Destination Hedera account ID"),
        amount:      z.number().positive().describe("Amount to send"),
        currency:    z.enum(["HBAR", "USDC"]).describe("Payment currency"),
        memo:        z.string().optional().describe("Transaction memo"),
      }) }
  );
}

export function createXPayAgent(config: PolicyConfig = DEFAULT_POLICY_CONFIG) {
  const llm   = new ChatAnthropic({
    model: "claude-sonnet-4-20250514",
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    temperature: 0,
  });
  const tools = [checkSpendTool, listServicesTool, makeTransferTool(config)];
  return createReactAgent({
    llm, tools, checkpointSaver: checkpointer,
    messageModifier: `You are xPay — an AI payment agent on Hedera ${process.env.HEDERA_NETWORK ?? "testnet"}.
Rules:
1. For any pay or send or transfer request always call transfer_payment.
2. Never move funds without going through the tool.
3. If status is BLOCKED explain which policy fired and why.
4. If status is NEEDS_APPROVAL tell the user it is waiting for human sign-off.
5. If status is SUCCESS share the transaction hash.
6. For spending questions call check_spend_state.
7. For service questions call list_approved_services.
8. Be concise. One or two sentences only.`,
  });
}

export function getPendingApprovals() { return pendingApprovals; }
