import { useState, useEffect, useCallback } from "react";
import {
  initAppKit,
  openConnectModal,
  disconnectAppKit,
  onAccountChange,
  getCurrentAccount,
  signAndExecuteHbar,
  fetchBalance,
} from "./appkit";

export interface UseAppKitReturn {
  connected:  boolean;
  accountId:  string | null;
  balance:    number | null;
  signing:    boolean;
  error:      string | null;
  connect:    () => Promise<void>;
  disconnect: () => Promise<void>;
  sign:       (params: { toAccountId: string; amount: number; memo?: string }) => Promise<{ txHash: string; accountId: string }>;
  clearError: () => void;

  // Compatibility aliases for old WalletSheet UI (Reown AppKit doesn't expose
  // a wallet name/icon directly the way DAppConnector sessions did, so we
  // show generic Reown branding instead — the modal itself displays the
  // actual connected wallet's real name/icon to the user).
  walletName:          string | null;
  walletIcon:          string | null;
  connecting:          boolean;
  availableExtensions: { id: string; name: string; available: boolean }[];
  connectExt:          (name: string) => Promise<void>;
  connectModal:        () => Promise<void>;
}

export function useAppKit(): UseAppKitReturn {
  const [connected, setConnected] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [balance,   setBalance]   = useState<number | null>(null);
  const [signing,   setSigning]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    initAppKit().catch((e) => console.warn("AppKit init:", e?.message));

    const current = getCurrentAccount();
    if (current.address) {
      setConnected(true);
      setAccountId(current.address);
      fetchBalance(current.address).then(setBalance);
    }

    return onAccountChange((info) => {
      if (info.address) {
        setConnected(true);
        setAccountId(info.address);
        fetchBalance(info.address).then(setBalance);
      } else {
        setConnected(false);
        setAccountId(null);
        setBalance(null);
      }
    });
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    try { await openConnectModal(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Connection failed"); }
  }, []);

  const disconnect = useCallback(async () => {
    await disconnectAppKit();
  }, []);

  const sign = useCallback(async (params: { toAccountId: string; amount: number; memo?: string }) => {
    setSigning(true); setError(null);
    try { return await signAndExecuteHbar(params); }
    catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Signing failed";
      setError(msg); throw new Error(msg);
    } finally { setSigning(false); }
  }, []);

  return {
    connected, accountId, balance, signing, error,
    connect, disconnect, sign,
    clearError: () => setError(null),

    // Compatibility layer — Reown's modal shows the real wallet name/icon
    // to the user during connect; once connected we just label it generically.
    walletName:          connected ? "Reown Wallet" : null,
    walletIcon:           connected ? "🔗" : null,
    connecting:           false,
    availableExtensions: [],
    connectExt:          async (_name: string) => { await connect(); },
    connectModal:        connect,
  };
}
