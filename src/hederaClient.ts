import {
  Client,
  PrivateKey,
  AccountId,
  Hbar,
  TransferTransaction,
} from "@hashgraph/sdk";
import type { TransferRequest, ExecutedTransaction } from "./types.js";
import { recordSpend } from "./hooks/spendLimitHook.js";
import { resolveOnChainRecipient } from "./hooks/allowlistHook.js";
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
  const client      = getHederaClient();
  const operatorId  = AccountId.fromString(process.env.HEDERA_ACCOUNT_ID!);

  const realRecipient = resolveOnChainRecipient(request.toAccountId);
  const toId           = AccountId.fromString(realRecipient);
  const tinybars        = Math.round(request.amount * 1e8);

  const tx = await new TransferTransaction()
    .addHbarTransfer(operatorId, Hbar.fromTinybars(-tinybars))
    .addHbarTransfer(toId,       Hbar.fromTinybars(tinybars))
    .setTransactionMemo(
      `xPay: ${request.serviceName ?? request.toAccountId} (display:${request.toAccountId})`
    )
    .execute(client);

  const receipt = await tx.getReceipt(client);

  if (receipt.status.toString() !== "SUCCESS") {
    throw new Error(`Hedera transaction failed with status: ${receipt.status.toString()}`);
  }

  return {
    id:         randomUUID(),
    request,
    decision:   "approved",
    txHash:     tx.transactionId.toString(),
    timestamp:  new Date().toISOString(),
    violations: [],
  };
}

export async function executeUsdcTransfer(
  request: TransferRequest
): Promise<ExecutedTransaction> {
  const tokenId = process.env.HEDERA_USDC_TOKEN_ID;

  if (!tokenId) {
    throw new Error(
      "HEDERA_USDC_TOKEN_ID not configured. Add the Hedera testnet USDC token ID to .env to enable real USDC transfers."
    );
  }

  const { TokenId, TransferTransaction: TT } = await import("@hashgraph/sdk");
  const client       = getHederaClient();
  const operatorId   = AccountId.fromString(process.env.HEDERA_ACCOUNT_ID!);
  const realRecipient = resolveOnChainRecipient(request.toAccountId);
  const toId         = AccountId.fromString(realRecipient);

  const units = Math.round(request.amount * 1e6);

  const tx = await new TT()
    .addTokenTransfer(TokenId.fromString(tokenId), operatorId, -units)
    .addTokenTransfer(TokenId.fromString(tokenId), toId, units)
    .setTransactionMemo(
      `xPay: ${request.serviceName ?? request.toAccountId} (display:${request.toAccountId})`
    )
    .execute(client);

  const receipt = await tx.getReceipt(client);

  if (receipt.status.toString() !== "SUCCESS") {
    throw new Error(`Hedera token transfer failed with status: ${receipt.status.toString()}`);
  }

  return {
    id:         randomUUID(),
    request,
    decision:   "approved",
    txHash:     tx.transactionId.toString(),
    timestamp:  new Date().toISOString(),
    violations: [],
  };
}

export async function executeTransfer(
  request: TransferRequest
): Promise<ExecutedTransaction> {
  recordSpend(request.amount, request.currency);
  return request.currency === "HBAR"
    ? executeHbarTransfer(request)
    : executeUsdcTransfer(request);
}
