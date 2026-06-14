import {
  Client,
  PrivateKey,
  AccountId,
  Hbar,
  TransferTransaction,
} from "@hashgraph/sdk";
import { HederaLangchainToolkit, AgentMode } from "hedera-agent-kit";
import type { TransferRequest, ExecutedTransaction } from "./types.js";
import { randomUUID } from "crypto";

let _client: Client | null = null;

export function getHederaClient(): Client {
  if (_client) return _client;
  const accountId  = process.env.HEDERA_ACCOUNT_ID;
  const privateKey = process.env.HEDERA_PRIVATE_KEY;
  const network    = process.env.HEDERA_NETWORK ?? "testnet";
  if (!accountId || !privateKey)
    throw new Error("Missing HEDERA_ACCOUNT_ID or HEDERA_PRIVATE_KEY");
  _client = network === "mainnet" ? Client.forMainnet() : Client.forTestnet();
  _client.setOperator(
    AccountId.fromString(accountId),
    PrivateKey.fromStringECDSA(privateKey)
  );
  return _client;
}

export async function executeHbarTransfer(
  request: TransferRequest
): Promise<ExecutedTransaction> {
  const client     = getHederaClient();
  const operatorId = AccountId.fromString(process.env.HEDERA_ACCOUNT_ID!);
  const toId       = AccountId.fromString(request.toAccountId);
  const tinybars   = Math.round(request.amount * 1e8);
  const tx = await new TransferTransaction()
    .addHbarTransfer(operatorId, Hbar.fromTinybars(-tinybars))
    .addHbarTransfer(toId,       Hbar.fromTinybars(tinybars))
    .setTransactionMemo(request.memo ?? `xPay: ${request.serviceName ?? "payment"}`)
    .execute(client);
  await tx.getReceipt(client);
  return {
    id: randomUUID(), request, decision: "approved",
    txHash: tx.transactionId.toString(),
    timestamp: new Date().toISOString(), violations: [],
  };
}

export async function executeUsdcTransfer(
  request: TransferRequest
): Promise<ExecutedTransaction> {
  await new Promise((r) => setTimeout(r, 600));
  return {
    id: randomUUID(), request, decision: "approved",
    txHash: `0.0.${Date.now()}-usdc-sim`,
    timestamp: new Date().toISOString(), violations: [],
  };
}

export async function executeTransfer(
  request: TransferRequest
): Promise<ExecutedTransaction> {
  return request.currency === "HBAR"
    ? executeHbarTransfer(request)
    : executeUsdcTransfer(request);
}
