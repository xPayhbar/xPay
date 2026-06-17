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
  {
    name:        "check_spend_state",
    description: "Return today's HBAR and USDC spend totals.",
    schema:      z.object({}),
  }
);

const listServicesTool = tool(
  async () => JSON.stringify(KNOWN_SERVICES),
  {
    name:        "list_approved_services",
    description: "List all known service accounts available for payment.",
    schema:      z.object({}),
  }
);

function makeTransferTool(config: PolicyConfig) {
  return tool(
    async ({ toAccountId, amount, currency, memo }) => {
      const serviceName = resolveServiceName(toAccountId);
      const request: TransferRequest = {
        toAccountId,
        amount,
        currency: currency as "HBAR" | "USDC",
        memo,
        serviceName,
        rawIntent: memo ?? `Transfer ${amount} ${currency} to ${toAccountId}`,
      };

      const result = evaluatePolicy(request, config);

      if (result.decision === "blocked") {
        return JSON.stringify({
          status: "BLOCKED",
          reason: result.message,
          violations: result.violations,
          toAccountId,
          serviceName,
          amount,
          currency,
        });
      }

      if (result.decision === "needs_approval") {
        const pendingId = `pending-${Date.now()}-${randomUUID().slice(0, 6)}`;
        pendingApprovals.set(pendingId, request);
        return JSON.stringify({
          status:     "NEEDS_APPROVAL",
          pendingId,
          reason:     result.message,
          violations: result.violations,
          amount,
          currency,
          toAccountId,
          serviceName,
        });
      }

      try {
        const tx = await executeTransfer(request);
        return JSON.stringify({
          status:      "SUCCESS",
          txHash:      tx.txHash,
          amount,
          currency,
          toAccountId,
          serviceName,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return JSON.stringify({ status: "ERROR", reason: msg, toAccountId, serviceName, amount, currency });
      }
    },
    {
      name: "transfer_payment",
      description:
        "Transfer HBAR or USDC to a Hedera account. " +
        "All transfers are checked against spend limits, counterparty allowlist, " +
        "approval threshold, and anomaly detection before execution. " +
        "Approved transfers are submitted as real transactions to Hedera testnet.",
      schema: z.object({
        toAccountId: z.string().describe("Destination Hedera account ID, e.g. '0.0.4567890'"),
        amount:      z.number().positive().describe("Amount to send"),
        currency:    z.enum(["HBAR", "USDC"]).describe("Payment currency"),
        memo:        z.string().optional().describe("Transaction purpose / memo"),
      }),
    }
  );
}

export function createXPayAgent(config: PolicyConfig = DEFAULT_POLICY_CONFIG) {
  const llm = new ChatAnthropic({
    model:           "claude-sonnet-4-20250514",
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    temperature:     0,
  });

  const tools = [checkSpendTool, listServicesTool, makeTransferTool(config)];

  return createReactAgent({
    llm,
    tools,
    checkpointSaver: checkpointer,
    messageModifier: `You are xPay — an AI payment agent on Hedera ${process.env.HEDERA_NETWORK ?? "testnet"}.

Rules:
1. For any pay/send/transfer request, ALWAYS call transfer_payment.
2. Never move funds without using the tool — policies only run through it.
3. If status is BLOCKED, explain which policy fired and why.
4. If status is NEEDS_APPROVAL, tell the user the pendingId and that it awaits human sign-off.
5. If status is SUCCESS, share the transaction hash — this is a real Hedera testnet transaction, verifiable on HashScan.
6. For spending questions, call check_spend_state.
7. For service questions, call list_approved_services.
8. Be concise — 1-2 sentences max.`,
  });
}

export function getPendingApprovals() { return pendingApprovals; }
