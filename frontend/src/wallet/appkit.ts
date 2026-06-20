// Reown AppKit + Hedera native adapter
// Official recommended pattern (DAppConnector is now legacy)
// https://github.com/hashgraph/hedera-wallet-connect

import {
  HederaProvider,
  HederaAdapter,
  HederaChainDefinition,
  hederaNamespace,
  transactionToBase64String,
} from "@hashgraph/hedera-wallet-connect";
import { createAppKit } from "@reown/appkit";
import { TransferTransaction, Hbar, AccountId } from "@hiero-ledger/sdk";

const PROJECT_ID =
  (import.meta as any).env?.VITE_WALLETCONNECT_PROJECT_ID ?? "demo-key";

const METADATA = {
  name: "xPay",
  description: "AI payment agent with policy enforcement on Hedera",
  url: typeof window !== "undefined" ? window.location.origin : "https://xpay.app",
  icons: [`${typeof window !== "undefined" ? window.location.origin : ""}/favicon.ico`],
};

let _universalProvider: any = null;
let _appKit: any = null;

export interface AccountInfo {
  address: string | null;
  type: string | null;
}

type AccountListener = (info: AccountInfo) => void;
const _accountListeners = new Set<AccountListener>();

export async function initAppKit() {
  if (_appKit) return _appKit;

  const hederaAdapter = new HederaAdapter({
    projectId: PROJECT_ID,
    networks: [HederaChainDefinition.Native.Mainnet, HederaChainDefinition.Native.Testnet],
    namespace: hederaNamespace,
  });

  _universalProvider = (await HederaProvider.init({
    projectId: PROJECT_ID,
    metadata: METADATA,
  })) as any;

  _appKit = createAppKit({
    adapters: [hederaAdapter],
    // @ts-expect-error type mismatch is expected per official docs
    universalProvider: _universalProvider,
    projectId: PROJECT_ID,
    metadata: METADATA,
    networks: [HederaChainDefinition.Native.Mainnet, HederaChainDefinition.Native.Testnet],
    defaultNetwork: HederaChainDefinition.Native.Testnet,
  });

  _appKit.subscribeAccount((account: any) => {
    const info: AccountInfo = {
      address: account?.address ?? null,
      type: account?.type ?? null,
    };
    _accountListeners.forEach((l) => l(info));
  });

  return _appKit;
}

export function onAccountChange(listener: AccountListener): () => void {
  _accountListeners.add(listener);
  return () => _accountListeners.delete(listener);
}

// Opens the Reown connect modal — shows 500+ wallets, QR, email/social login
export async function openConnectModal() {
  const appKit = await initAppKit();
  appKit.open();
}

export async function disconnectAppKit() {
  if (!_appKit) return;
  await _appKit.disconnect();
}

export function getCurrentAccount(): AccountInfo {
  if (!_appKit) return { address: null, type: null };
  const account = _appKit.getAccount?.();
  return { address: account?.address ?? null, type: account?.type ?? null };
}

// Sign + execute a real HBAR transfer via the connected wallet
export async function signAndExecuteHbar(params: {
  toAccountId: string;
  amount: number;
  memo?: string;
}): Promise<{ txHash: string; accountId: string }> {
  if (!_universalProvider) throw new Error("AppKit not initialized.");
  const account = getCurrentAccount();
  if (!account.address) throw new Error("No wallet connected.");

  const network = "testnet"; // change to "mainnet" for production
  const fromId = AccountId.fromString(account.address);
  const toId   = AccountId.fromString(params.toAccountId);

  const transaction = new TransferTransaction()
    .addHbarTransfer(fromId, new Hbar(-params.amount))
    .addHbarTransfer(toId,   new Hbar(params.amount))
    .setTransactionMemo(params.memo ?? "xPay payment");

  // hedera_signAndExecuteTransaction: wallet signs AND submits to Hedera directly
  const result = await _universalProvider.hedera_signAndExecuteTransaction({
    signerAccountId: `hedera:${network}:${account.address}`,
    transactionList: transactionToBase64String(transaction),
  });

  return {
    txHash: result.transactionId,
    accountId: account.address,
  };
}

export async function fetchBalance(accountId: string, network: "testnet" | "mainnet" = "testnet") {
  try {
    const base = network === "mainnet"
      ? "https://mainnet-public.mirrornode.hedera.com"
      : "https://testnet.mirrornode.hedera.com";
    const res  = await fetch(`${base}/api/v1/accounts/${accountId}`);
    const data = await res.json();
    return (data?.balance?.balance ?? 0) / 1e8;
  } catch { return null; }
}
