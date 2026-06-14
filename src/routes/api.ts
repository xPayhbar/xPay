import { Router }                                 from "express";
import { createXPayAgent, getPendingApprovals }   from "../agent.js";
import { DEFAULT_POLICY_CONFIG }                  from "../policyEngine.js";
import { getSpendState, resetSpendState }         from "../hooks/spendLimitHook.js";
import { executeTransfer }                        from "../hederaClient.js";
import type { ChatRequest, PolicyConfig }         from "../types.js";

const router = Router();
const agents = new Map<string, ReturnType<typeof createXPayAgent>>();

function getOrCreate(id: string, overrides?: Partial<PolicyConfig>) {
  if (!agents.has(id)) {
    const cfg: PolicyConfig = {
      ...DEFAULT_POLICY_CONFIG, ...overrides,
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
    return res.status(400).json({ error: "message and conversationId required" });
  try {
    const agent  = getOrCreate(conversationId, policyConfig);
    const result = await agent.invoke(
      { messages: [{ role: "user", content: message }] },
      { configurable: { thread_id: conversationId } }
    );
    const last    = result.messages[result.messages.length - 1];
    const content = typeof last.content === "string"
      ? last.content : JSON.stringify(last.content);
    return res.json({ response: content, spendState: getSpendState() });
  } catch (err: unknown) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown error" });
  }
});

router.get("/spend",        (_req, res) => res.json(getSpendState()));
router.post("/spend/reset", (_req, res) => {
  resetSpendState();
  res.json({ ok: true, spendState: getSpendState() });
});
router.get("/pending", (_req, res) =>
  res.json({ pending: Object.fromEntries(getPendingApprovals()) })
);

router.post("/approve/:id", async (req, res) => {
  const pending = getPendingApprovals();
  const request = pending.get(req.params.id);
  if (!request) return res.status(404).json({ error: "Not found" });
  const { walletTxHash } = req.body ?? {};
  if (walletTxHash) {
    pending.delete(req.params.id);
    return res.json({ ok: true, txHash: walletTxHash, spendState: getSpendState() });
  }
  try {
    const tx = await executeTransfer(request);
    pending.delete(req.params.id);
    return res.json({ ok: true, transaction: tx, spendState: getSpendState() });
  } catch (err: unknown) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed" });
  }
});

router.post("/reject/:id", (req, res) => {
  const pending = getPendingApprovals();
  if (!pending.has(req.params.id))
    return res.status(404).json({ error: "Not found" });
  const r = pending.get(req.params.id)!;
  pending.delete(req.params.id);
  return res.json({ ok: true, rejected: r });
});

router.get("/health", (_req, res) =>
  res.json({ status: "ok", agent: "xPay",
    network: process.env.HEDERA_NETWORK ?? "testnet",
    agentKit: "hedera-agent-kit@3.8.2",
    wallet: "hedera-wallet-connect@2.1.3",
    timestamp: new Date().toISOString() })
);

export default router;
