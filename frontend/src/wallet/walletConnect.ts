import {
  DAppConnector, HederaJsonRpcMethod, HederaSessionEvent,
  HederaChainId, SignAndExecuteTransactionParams, transactionToBase64String,
} from "@hashgraph/hedera-wallet-connect";
import {
  TransferTransaction, AccountId, Hbar, LedgerId, TransactionId,
} from "@hashgraph/sdk";

export interface WalletState {
  connected: boolean; accountId: string | null;
  network: "testnet" | "mainnet"; walletName: string | null;
  walletIcon: string | null; balance: number | null;
}
export type WalletEvent =
  | { type: "connected"; accountId: string; walletName: string; walletIcon: string | null }
  | { type: "disconnected" }
  | { type: "error"; message: string };
export interface TransferParams {
  toAccountId: string; amount: number;
  currency: "HBAR" | "USDC"; memo?: string; serviceName?: string;
}
export interface SignResult {
  txHash: string; accountId: string; amount: number; currency: string;
}
export const SUPPORTED_WALLETS = [
  { name: "HashPack", icon: "💜", desc: "Most popular Hedera wallet",  color: "#8b5cf6" },
  { name: "Blade",    icon: "🔵", desc: "DeFi-focused Hedera wallet",  color: "#3b82f6" },
  { name: "Kabila",   icon: "🟠", desc: "NFT and token wallet",        color: "#f97316" },
  { name: "MetaMask", icon: "🦊", desc: "EVM-compatible via Snaps",    color: "#f59e0b" },
];

type WalletListener = (e: WalletEvent) => void;
const WC_PROJECT_ID = (import.meta as any).env?.VITE_WALLETCONNECT_PROJECT_ID ?? "demo-key";
const APP_META = { name: "xPay", description: "AI payment agent on Hedera",
  url: window.location.origin, icons: [`${window.location.origin}/favicon.ico`] };

let _conn: DAppConnector | null = null;
let _state: WalletState = { connected: false, accountId: null, network: "testnet",
  walletName: null, walletIcon: null, balance: null };
const _listeners = new Set<WalletListener>();

const notify = (e: WalletEvent) => _listeners.forEach(l => l(e));
export const getWalletState = (): WalletState => ({ ..._state });
export const onWalletEvent  = (l: WalletListener) => { _listeners.add(l); return () => _listeners.delete(l); };

export async function initWalletConnect(network: "testnet" | "mainnet" = "testnet") {
  if (_conn) return _conn;
  const ledgerId = network === "mainnet" ? LedgerId.MAINNET : LedgerId.TESTNET;
  const chainId  = network === "mainnet" ? HederaChainId.Mainnet : HederaChainId.Testnet;
  _conn = new DAppConnector(APP_META, ledgerId, WC_PROJECT_ID,
    Object.values(HederaJsonRpcMethod),
    [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged], [chainId]);
  await _conn.init({ logger: "error" });
  const sessions = _conn.walletConnectClient?.session.getAll() ?? [];
  if (sessions.length > 0) {
    const s = sessions[sessions.length - 1];
    const id = _extractId(s); const name = s.peer.metadata.name;
    const icon = s.peer.metadata.icons?.[0] ?? null;
    if (id) {
      _state = { connected: true, accountId: id, network, walletName: name, walletIcon: icon, balance: null };
      notify({ type: "connected", accountId: id, walletName: name, walletIcon: icon });
      _fetchBal(id, network).then(b => { _state.balance = b; });
    }
  }
  _conn.walletConnectClient?.on("session_delete", () => _disc());
  _conn.walletConnectClient?.on("session_expire",  () => _disc());
  return _conn;
}

export async function connectWallet(network: "testnet" | "mainnet" = "testnet"): Promise<WalletState> {
  const c = await initWalletConnect(network);
  return new Promise((resolve, reject) => {
    c.openModal().catch(reject);
    c.walletConnectClient?.on("session_update", async (ev: any) => {
      try {
        const s = c.walletConnectClient?.session.get(ev.topic); if (!s) return;
        const id = _extractId(s); const name = s.peer.metadata.name;
        const icon = s.peer.metadata.icons?.[0] ?? null; if (!id) return;
        _state = { connected: true, accountId: id, network, walletName: name, walletIcon: icon, balance: null };
        notify({ type: "connected", accountId: id, walletName: name, walletIcon: icon });
        const bal = await _fetchBal(id, network); _state.balance = bal;
        resolve({ ..._state });
      } catch (err) { reject(err); }
    });
  });
}

export async function disconnectWallet() {
  if (!_conn) return;
  try { await _conn.disconnectAll(); } catch { /* ignore */ }
  _disc();
}

function _disc() {
  _state = { connected: false, accountId: null, network: _state.network,
    walletName: null, walletIcon: null, balance: null };
  notify({ type: "disconnected" });
}

export async function signAndExecuteTransfer(params: TransferParams): Promise<SignResult> {
  if (!_conn || !_state.connected || !_state.accountId)
    throw new Error("No wallet connected. Click Connect Wallet first.");
  const fromId = AccountId.fromString(_state.accountId);
  const toId   = AccountId.fromString(params.toAccountId);
  const signer = _conn.getSigner(fromId);
  const tx = await new TransferTransaction()
    .addHbarTransfer(fromId, Hbar.fromTinybars(-Math.round(params.amount * 1e8)))
    .addHbarTransfer(toId,   Hbar.fromTinybars( Math.round(params.amount * 1e8)))
    .setTransactionMemo(params.memo ?? `xPay: ${params.serviceName ?? params.toAccountId}`)
    .setTransactionId(TransactionId.generate(fromId))
    .freezeWithSigner(signer);
  const result = await _conn.signAndExecuteTransaction({
    signerAccountId: `hedera:${_state.network}:${_state.accountId}`,
    transactionList: transactionToBase64String(tx),
  } as SignAndExecuteTransactionParams);
  const txHash = (result as any)?.transactionId ?? `${_state.accountId}@${Math.floor(Date.now()/1000)}`;
  _fetchBal(_state.accountId, _state.network).then(b => { _state.balance = b; });
  return { txHash, accountId: _state.accountId, amount: params.amount, currency: params.currency };
}

function _extractId(session: any): string | null {
  try {
    const accounts: string[] = Object.values(session.namespaces).flatMap((ns: any) => ns.accounts ?? []);
    const h = accounts.find(a => a.startsWith("hedera:"));
    return h ? h.split(":")[2] : accounts[0]?.split(":")?.[2] ?? null;
  } catch { return null; }
}

async function _fetchBal(accountId: string, network: string): Promise<number | null> {
  try {
    const base = network === "mainnet"
      ? "https://mainnet-public.mirrornode.hedera.com"
      : "https://testnet.mirrornode.hedera.com";
    const res  = await fetch(`${base}/api/v1/accounts/${accountId}`);
    const data = await res.json();
    return (data?.balance?.balance ?? 0) / 1e8;
  } catch { return null; }
}
