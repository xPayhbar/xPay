export interface WalletState {
  connected: boolean;
  accountId: string | null;
  network: "testnet" | "mainnet";
  walletName: string | null;
  walletIcon: string | null;
  balance: number | null;
}

export type WalletEvent =
  | { type: "connected"; accountId: string; walletName: string; walletIcon: string | null }
  | { type: "disconnected" }
  | { type: "error"; message: string };

export interface TransferParams {
  toAccountId: string;
  amount: number;
  currency: "HBAR" | "USDC";
  memo?: string;
  serviceName?: string;
}

export interface SignResult {
  txHash: string;
  accountId: string;
  amount: number;
  currency: string;
}

export const SUPPORTED_WALLETS = [
  { name: "HashPack", icon: "💜", desc: "Most popular Hedera wallet",  color: "#8b5cf6" },
  { name: "Blade",    icon: "🔵", desc: "DeFi-focused Hedera wallet",  color: "#3b82f6" },
  { name: "Kabila",   icon: "🟠", desc: "NFT and token wallet",        color: "#f97316" },
  { name: "MetaMask", icon: "🦊", desc: "EVM-compatible via Snaps",    color: "#f59e0b" },
];

type WalletListener = (e: WalletEvent) => void;

let _state: WalletState = {
  connected: false, accountId: null, network: "testnet",
  walletName: null, walletIcon: null, balance: null,
};
const _listeners = new Set<WalletListener>();

const notify = (e: WalletEvent) => _listeners.forEach(l => l(e));
export const getWalletState = (): WalletState => ({ ..._state });
export const onWalletEvent = (l: WalletListener) => {
  _listeners.add(l);
  return () => _listeners.delete(l);
};

export async function connectWallet(
  walletName: string,
  walletIcon: string,
  network: "testnet" | "mainnet" = "testnet"
): Promise<WalletState> {
  const accountId = `0.0.${Math.floor(1000000 + Math.random() * 9000000)}`;
  const balance   = (150 + Math.random() * 500).toFixed(2);

  _state = {
    connected: true,
    accountId,
    network,
    walletName,
    walletIcon,
    balance: parseFloat(balance),
  };

  notify({ type: "connected", accountId, walletName, walletIcon });

  // Fetch real balance from mirror node
  try {
    const base = network === "mainnet"
      ? "https://mainnet-public.mirrornode.hedera.com"
      : "https://testnet.mirrornode.hedera.com";
    const res  = await fetch(`${base}/api/v1/accounts/${accountId}`);
    const data = await res.json();
    _state.balance = (data?.balance?.balance ?? 0) / 1e8;
  } catch { /* use simulated balance */ }

  return { ..._state };
}

export async function disconnectWallet(): Promise<void> {
  _state = { connected: false, accountId: null, network: _state.network,
             walletName: null, walletIcon: null, balance: null };
  notify({ type: "disconnected" });
}

export async function signAndExecuteTransfer(
  params: TransferParams
): Promise<SignResult> {
  if (!_state.connected || !_state.accountId)
    throw new Error("No wallet connected. Click Connect Wallet first.");

  // Simulate wallet signing delay (real flow uses DAppConnector.signAndExecuteTransaction)
  await new Promise(r => setTimeout(r, 1500));

  const txHash = `0.0.${_state.accountId}@${Math.floor(Date.now() / 1000)}`;

  return {
    txHash,
    accountId: _state.accountId,
    amount: params.amount,
    currency: params.currency,
  };
}
