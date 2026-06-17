import { Router }                                from "express";
import { createXPayAgent, getPendingApprovals }  from "../agent.js";
import { DEFAULT_POLICY_CONFIG }                 from "../policyEngine.js";
import { getSpendState, resetSpendState }        from "../hooks/spendLimitHook.js";
import { executeTransfer }                       from "../hederaClient.js";
import { resolveServiceName }                    from "../hooks/allowlistHook.js";
import type { ChatRequest, PolicyConfig }        from "../types.js";

const router = Router();

const agents = new Map<string, ReturnType<typeof createXPayAgent>>();

function getOrCreateAgent(id: string, overrides?: Partial<PolicyConfig>) {
  if (!agents.has(id)) {
    const cfg: PolicyConfig = {
      ...DEFAULT_POLICY_CONFIG,
      ...overrides,
      spendLimit:        { ...DEFAULT_POLICY_CONFIG.spendLimit,        ...(overrides?.spendLimit        ?? {}) },
      allowlist:         { ...DEFAULT_POLICY_CONFIG.allowlist,         ...(overrides?.allowlist         ?? {}) },
      approvalThreshold: { ...DEFAULT_POLICY_CONFIG.approvalThreshold, ...(overrides?.approvalThreshold ?? {}) },
      anomalyDetection:  { ...DEFAULT_POLICY_CONFIG.anomalyDetection,  ...(overrides?.anomalyDetection  ?? {}) },
    };
    agents.set(id, createXPayAgent(cfg));
  }
  return agents.get(id)!;
}

router.post("/chat", async (req, res) => {
  const { message, conversationId, policyConfig }: ChatRequest = req.body;
  if (!message || !conversationId)
    return res.status(400).json({ error: "message and conversationId are required" });

  try {
    const agent  = getOrCreateAgent(conversationId, policyConfig);
    const result = await agent.invoke(
      { messages: [{ role: "user", content: message }] },
      { configurable: { thread_id: conversationId } }
    );

    const last    = result.messages[result.messages.length - 1];
    const content = typeof last.content === "string"
      ? last.content
      : JSON.stringify(last.content);

    let decision      = "info";
    let policy        = null as string | null;
    let detail        = null as string | null;
    let toAccountId   = null as string | null;
    let serviceName   = null as string | null;
    let amount        = 0;
    let currency      = "HBAR";
    let txHash         = null as string | null;
    let pendingId      = null as string | null;

    for (const msg of result.messages) {
      if (msg._getType?.() === "tool") {
        try {
          const parsed = JSON.parse(
            typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)
          );
          if (parsed.status === "SUCCESS") {
            decision    = "approved";
            txHash       = parsed.txHash ?? null;
            toAccountId = parsed.toAccountId ?? null;
            serviceName = parsed.serviceName ?? null;
            amount      = parsed.amount ?? 0;
            currency    = parsed.currency ?? "HBAR";
          } else if (parsed.status === "BLOCKED") {
            decision    = "blocked";
            policy      = parsed.violations?.[0]?.policy ?? null;
            detail      = parsed.violations?.[0]?.reason ?? parsed.reason ?? null;
            toAccountId = parsed.toAccountId ?? null;
            serviceName = parsed.serviceName ?? null;
            amount      = parsed.amount ?? 0;
            currency    = parsed.currency ?? "HBAR";
          } else if (parsed.status === "NEEDS_APPROVAL") {
            decision    = "needs_approval";
            policy      = parsed.violations?.[0]?.policy ?? "approval_threshold";
            detail      = parsed.violations?.[0]?.reason ?? parsed.reason ?? null;
            toAccountId = parsed.toAccountId ?? null;
            serviceName = parsed.serviceName ?? null;
            amount      = parsed.amount ?? 0;
            currency    = parsed.currency ?? "HBAR";
            pendingId   = parsed.pendingId ?? null;
          } else if (parsed.status === "ERROR") {
            decision = "error";
            detail   = parsed.reason ?? "Transfer failed";
          }
        } catch { /* non-JSON tool output, skip */ }
      }
    }

    return res.json({
      decision,
      policy,
      detail,
      to: toAccountId,
      service: serviceName,
      amount,
      currency,
      hash: txHash,
      pendingId,
      msg: content,
      spendState: getSpendState(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

router.get("/spend", (_req, res) => res.json(getSpendState()));

router.post("/spend/reset", (_req, res) => {
  resetSpendState();
  res.json({ ok: true, spendState: getSpendState() });
});

router.get("/pending", (_req, res) => {
  const pending = Object.fromEntries(getPendingApprovals());
  res.json({ pending });
});

router.post("/approve/:pendingId", async (req, res) => {
  const pending = getPendingApprovals();
  const request = pending.get(req.params.pendingId);
  if (!request) return res.status(404).json({ error: "Pending transaction not found" });

  try {
    const tx = await executeTransfer(request);
    pending.delete(req.params.pendingId);
    return res.json({
      ok: true,
      hash: tx.txHash,
      amount: request.amount,
      currency: request.currency,
      service: request.serviceName ?? resolveServiceName(request.toAccountId),
      spendState: getSpendState(),
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Transfer failed" });
  }
});

router.post("/reject/:pendingId", (req, res) => {
  const pending = getPendingApprovals();
  if (!pending.has(req.params.pendingId))
    return res.status(404).json({ error: "Pending transaction not found" });
  const request = pending.get(req.params.pendingId)!;
  pending.delete(req.params.pendingId);
  return res.json({ ok: true, rejected: request });
});

router.get("/policy", (_req, res) => res.json(DEFAULT_POLICY_CONFIG));

router.get("/health", (_req, res) =>
  res.json({
    status:    "ok",
    network:   process.env.HEDERA_NETWORK ?? "testnet",
    account:   process.env.HEDERA_ACCOUNT_ID ?? "not configured",
    walletConnect: true,
    agentKitVersion: "3.8.2",
    timestamp: new Date().toISOString(),
  })
);

export default router;
