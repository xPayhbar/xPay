// Real WalletConnect 2.0 integration for Hedera wallets
// Based on official docs: github.com/hashgraph/hedera-wallet-connect
// Supports: HashPack, Blade, Kabila, MetaMask (HIP-820)

import {
  DAppConnector,
  HederaJsonRpcMethod,
  HederaSessionEvent,
  HederaChainId,
  SignAndExecuteTransactionParams,
  transactionToBase64String,
} from "@hashgraph/hedera-wallet-connect";

import {
  TransferTransaction,
  AccountId,
  Hbar,
  LedgerId,
  TransactionId,
  Client,
} from "@hashgraph/sdk";

// ── Types ──────────────────────────────────────────────────────────────────
export interface WalletState {
  connected:   boolean;
  accountId:   string | null;
  network:     "testnet" | "mainnet";
  walletName:  string | null;
  walletIcon:  string | null;
  balance:     number | null;
  isExtension: boolean; // HashPack browser extension vs QR
}

export type WalletEvent =
  | { type: "connected";     accountId: string; walletName: string; walletIcon: string | null; isExtension: boolean }
  | { type: "disconnected" }
  | { type: "error";         message: string };

export interface TransferParams {
  toAccountId:  string;
  amount:       number;
  currency:     "HBAR" | "USDC";
  memo?:        string;
  serviceName?: string;
}

export interface SignResult {
  txHash:    string;
  accountId: string;
  amount:    number;
  currency:  string;
}

type WalletListener = (event: WalletEvent) => void;

// ── Supported wallets ──────────────────────────────────────────────────────
export const SUPPORTED_WALLETS = [
  { name: "HashPack", icon: "💜", desc: "Most popular Hedera wallet — browser extension or QR", color: "#8b5cf6" },
  { name: "Blade",    icon: "🔵", desc: "DeFi-focused Hedera wallet",                          color: "#3b82f6" },
  { name: "Kabila",   icon: "🟠", desc: "NFT + token wallet",                                   color: "#f97316" },
  { name: "MetaMask", icon: "🦊", desc: "EVM-compatible via Snaps",                             color: "#f59e0b" },
];

// ── Config ─────────────────────────────────────────────────────────────────
// Get a FREE project ID at: https://cloud.walletconnect.com
const WC_PROJECT_ID =
  (import.meta as any).env?.VITE_WALLETCONNECT_PROJECT_ID ?? "a6f1b5c3d2e4f7a8b9c0d1e2f3a4b5c6";

const APP_META = {
  name:        "xPay",
  description: "AI payment agent with policy enforcement on Hedera",
  url:         typeof window !== "undefined" ? window.location.origin : "https://xpay.app",
  icons:       [`${typeof window !== "undefined" ? window.location.origin : ""}/favicon.ico`],
};

// ── Singleton state ────────────────────────────────────────────────────────
let _connector:  DAppConnector | null = null;
let _state: WalletState = {
  connected: false, accountId: null, network: "testnet",
  walletName: null, walletIcon: null, balance: null, isExtension: false,
};
const _listeners = new Set<WalletListener>();

export const getWalletState = (): WalletState => ({ ..._state });
export const onWalletEvent  = (l: WalletListener): (() => void) => {
  _listeners.add(l);
  return () => _listeners.delete(l);
};
const notify = (e: WalletEvent) => _listeners.forEach(l => l(e));

// ── Init DAppConnector ─────────────────────────────────────────────────────
export async function initWalletConnect(
  network: "testnet" | "mainnet" = "testnet"
): Promise<DAppConnector> {
  if (_conn) return _conn;

  const ledgerId = network === "mainnet" ? LedgerId.MAINNET : LedgerId.TESTNET;
  const chainId  = network === "mainnet" ? HederaChainId.Mainnet : HederaChainId.Testnet;

  _conn = new DAppConnector(
    APP_META,
    ledgerId,
    WC_PROJECT_ID,
    Object.values(HederaJsonRpcMethod),
    [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
    [chainId]
  );

  // Init — this also discovers browser extensions (HashPack, Blade, Kabila)
  await _conn.init({ logger: "error" });

  // Restore existing session on page reload
  const sessions = _conn.walletConnectClient?.session.getAll() ?? [];
  if (sessions.length > 0) {
    const s    = sessions[sessions.length - 1];
    const id   = _extractAccountId(s);
    const name = s.peer.metadata.name;
    const icon = s.peer.metadata.icons?.[0] ?? null;
    if (id) {
      _state = { connected: true, accountId: id, network, walletName: name,
                 walletIcon: icon, balance: null, isExtension: false };
      notify({ type: "connected", accountId: id, walletName: name, walletIcon: icon, isExtension: false });
      _fetchBalance(id, network).then(b => { _state.balance = b; });
    }
  }

  // Handle session events
  _conn.walletConnectClient?.on("session_delete", () => _handleDisconnect());
  _conn.walletConnectClient?.on("session_expire",  () => _handleDisconnect());
  _conn.walletConnectClient?.on("session_update", (ev: any) => {
    try {
      const s  = _conn!.walletConnectClient?.session.get(ev.topic);
      if (!s) return;
      const id = _extractAccountId(s);
      if (id && id !== _state.accountId) {
        _state.accountId = id;
        notify({ type: "connected", accountId: id,
          walletName: _state.walletName ?? s.peer.metadata.name,
          walletIcon: _state.walletIcon, isExtension: _state.isExtension });
      }
    } catch { /* ignore */ }
  });

  return _conn;
}

let _conn: DAppConnector | null = null;

// ── Connect via browser EXTENSION (HashPack, Blade, Kabila) ───────────────
// This is the preferred flow on desktop — no QR code needed.
// The extension pops up automatically.
export async function connectExtension(
  extensionName: string,
  network: "testnet" | "mainnet" = "testnet"
): Promise<WalletState> {
  const connector = await initWalletConnect(network);

  // Find the extension
  const extensions = connector.extensions ?? [];
  const ext = extensions.find(e =>
    e.name.toLowerCase().includes(extensionName.toLowerCase()) && e.available
  );

  if (!ext) {
    throw new Error(
      `${extensionName} extension not found or not installed. ` +
      `Try the QR code option or install ${extensionName} from your browser's extension store.`
    );
  }

  // Connect to the extension — this opens the HashPack/Blade/Kabila popup
  await connector.connectExtension(ext.id);

  // Get the session that was just created
  const sessions = connector.walletConnectClient?.session.getAll() ?? [];
  if (sessions.length === 0) throw new Error("Connection was rejected or timed out.");

  const s    = sessions[sessions.length - 1];
  const id   = _extractAccountId(s);
  const name = s.peer.metadata.name;
  const icon = s.peer.metadata.icons?.[0] ?? null;

  if (!id) throw new Error("Could not extract account ID from session.");

  _state = { connected: true, accountId: id, network, walletName: name,
             walletIcon: icon, balance: null, isExtension: true };
  notify({ type: "connected", accountId: id, walletName: name, walletIcon: icon, isExtension: true });
  _fetchBalance(id, network).then(b => { _state.balance = b; });

  return { ..._state };
}

// ── Connect via QR code modal (mobile wallets, no extension) ──────────────
export async function connectQR(
  network: "testnet" | "mainnet" = "testnet"
): Promise<WalletState> {
  const connector = await initWalletConnect(network);

  return new Promise((resolve, reject) => {
    // Opens the WalletConnect QR modal
    connector.openModal().catch(reject);

    // Listen for the session to be approved by the wallet
    const unsub = connector.walletConnectClient?.on("session_update", async (ev: any) => {
      try {
        const s    = connector.walletConnectClient?.session.get(ev.topic);
        if (!s) return;
        const id   = _extractAccountId(s);
        const name = s.peer.metadata.name;
        const icon = s.peer.metadata.icons?.[0] ?? null;
        if (!id) return;

        _state = { connected: true, accountId: id, network, walletName: name,
                   walletIcon: icon, balance: null, isExtension: false };
        notify({ type: "connected", accountId: id, walletName: name, walletIcon: icon, isExtension: false });
        const bal = await _fetchBalance(id, network);
        _state.balance = bal;
        resolve({ ..._state });
      } catch (err) { reject(err); }
    });

    // Timeout after 5 min
    setTimeout(() => {
      reject(new Error("Connection timed out. Please try again."));
    }, 300_000);
  });
}

// ── Detect installed extensions ────────────────────────────────────────────
export async function getAvailableExtensions(
  network: "testnet" | "mainnet" = "testnet"
): Promise<Array<{ id: string; name: string; icon?: string; available: boolean }>> {
  const connector = await initWalletConnect(network);
  return (connector.extensions ?? []).map(e => ({
    id:        e.id,
    name:      e.name,
    icon:      (e as any).icon,
    available: e.available,
  }));
}

// ── Disconnect ─────────────────────────────────────────────────────────────
export async function disconnectWallet(): Promise<void> {
  if (!_conn) return;
  try { await _conn.disconnectAll(); } catch { /* ignore */ }
  _handleDisconnect();
}

function _handleDisconnect() {
  _state = { connected: false, accountId: null, network: _state.network,
             walletName: null, walletIcon: null, balance: null, isExtension: false };
  notify({ type: "disconnected" });
}

// ── Sign + Execute HBAR transfer from the user's wallet ───────────────────
// This is the KEY function:
// 1. Build the TransferTransaction locally
// 2. Freeze it (required before sending to wallet)
// 3. Send to wallet via DAppConnector.signAndExecuteTransaction
// 4. Wallet shows a signing prompt to the user
// 5. On approval, transaction is submitted to Hedera — no server key involved
export async function signAndExecuteHbar(params: TransferParams): Promise<SignResult> {
  if (!_conn || !_state.connected || !_state.accountId)
    throw new Error("No wallet connected. Please connect a wallet first.");

  const network    = _state.network;
  const accountId  = _state.accountId;
  const fromId     = AccountId.fromString(accountId);
  const toId       = AccountId.fromString(params.toAccountId);
  const tinybars   = Math.round(params.amount * 1e8);

  // Build a client just for freezing (no operator key needed)
  const client = network === "mainnet" ? Client.forMainnet() : Client.forTestnet();

  // Generate a fresh transaction ID from the signer's account
  const txId = TransactionId.generate(fromId);

  // Build and freeze the transaction
  const tx = new TransferTransaction()
    .addHbarTransfer(fromId, Hbar.fromTinybars(-tinybars))
    .addHbarTransfer(toId,   Hbar.fromTinybars(tinybars))
    .setTransactionMemo(params.memo ?? `xPay: ${params.serviceName ?? params.toAccountId}`)
    .setTransactionId(txId)
    .setNodeAccountIds([AccountId.fromString("0.0.3")]) // testnet node
    .freeze();

  // Send to wallet for signing and execution
  // The wallet (HashPack etc.) shows a confirmation dialog to the user
  const result = await _conn.signAndExecuteTransaction({
    signerAccountId: `hedera:${network}:${accountId}`,
    transactionList: transactionToBase64String(tx),
  } as SignAndExecuteTransactionParams);

  const txHash =
    (result as any)?.transactionId ??
    (result as any)?.result?.transactionId ??
    txId.toString();

  // Refresh balance after transfer
  _fetchBalance(accountId, network).then(b => { _state.balance = b; });

  client.close();
  return { txHash, accountId, amount: params.amount, currency: params.currency };
}

// ── Route to correct executor ──────────────────────────────────────────────
export async function signAndExecuteTransfer(params: TransferParams): Promise<SignResult> {
  return signAndExecuteHbar(params);
}

// ── Helpers ────────────────────────────────────────────────────────────────
function _extractAccountId(session: any): string | null {
  try {
    const accounts: string[] = Object.values(session.namespaces)
      .flatMap((ns: any) => ns.accounts ?? []);
    // Format: "hedera:testnet:0.0.12345"
    const hederaAcc = accounts.find(a => a.startsWith("hedera:"));
    return hederaAcc
      ? hederaAcc.split(":")[2]
      : accounts[0]?.split(":")?.[2] ?? null;
  } catch { return null; }
}

async function _fetchBalance(accountId: string, network: string): Promise<number | null> {
  try {
    const base = network === "mainnet"
      ? "https://mainnet-public.mirrornode.hedera.com"
      : "https://testnet.mirrornode.hedera.com";
    const res  = await fetch(`${base}/api/v1/accounts/${accountId}`);
    const data = await res.json();
    return (data?.balance?.balance ?? 0) / 1e8;
  } catch { return null; }
}
