import { useState, useEffect, useCallback } from "react";
import {
  initWalletConnect, connectWallet, disconnectWallet,
  signAndExecuteTransfer, getWalletState, onWalletEvent,
  type WalletState, type TransferParams, type SignResult,
} from "./walletConnect";

export interface UseWalletReturn extends WalletState {
  connecting: boolean; signing: boolean; error: string | null;
  connect: () => Promise<void>; disconnect: () => Promise<void>;
  sign: (params: TransferParams) => Promise<SignResult>;
  clearError: () => void;
}

export function useWallet(network: "testnet" | "mainnet" = "testnet"): UseWalletReturn {
  const [state,      setState]     = useState<WalletState>(getWalletState());
  const [connecting, setConnecting] = useState(false);
  const [signing,    setSigning]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    initWalletConnect(network).catch(e => console.warn("WC init:", e?.message));
    return onWalletEvent(ev => {
      if (ev.type === "connected")
        setState(s => ({ ...s, connected: true, accountId: ev.accountId,
          walletName: ev.walletName, walletIcon: ev.walletIcon, network }));
      else if (ev.type === "disconnected")
        setState({ connected: false, accountId: null, network,
          walletName: null, walletIcon: null, balance: null });
      else if (ev.type === "error") setError(ev.message);
    });
  }, [network]);

  const connect = useCallback(async () => {
    setConnecting(true); setError(null);
    try { await connectWallet(network); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Connection failed"); }
    finally { setConnecting(false); }
  }, [network]);

  const disconnect = useCallback(() => disconnectWallet(), []);

  const sign = useCallback(async (params: TransferParams): Promise<SignResult> => {
    setSigning(true); setError(null);
    try { return await signAndExecuteTransfer(params); }
    catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Signing failed";
      setError(msg); throw new Error(msg);
    } finally { setSigning(false); }
  }, []);

  return { ...state, connecting, signing, error,
    connect, disconnect, sign, clearError: () => setError(null) };
}
EOFcat > frontend/src/wallet/useWallet.ts << 'EOF'
import { useState, useEffect, useCallback } from "react";
import {
  initWalletConnect, connectWallet, disconnectWallet,
  signAndExecuteTransfer, getWalletState, onWalletEvent,
  type WalletState, type TransferParams, type SignResult,
} from "./walletConnect";

export interface UseWalletReturn extends WalletState {
  connecting: boolean; signing: boolean; error: string | null;
  connect: () => Promise<void>; disconnect: () => Promise<void>;
  sign: (params: TransferParams) => Promise<SignResult>;
  clearError: () => void;
}

export function useWallet(network: "testnet" | "mainnet" = "testnet"): UseWalletReturn {
  const [state,      setState]     = useState<WalletState>(getWalletState());
  const [connecting, setConnecting] = useState(false);
  const [signing,    setSigning]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    initWalletConnect(network).catch(e => console.warn("WC init:", e?.message));
    return onWalletEvent(ev => {
      if (ev.type === "connected")
        setState(s => ({ ...s, connected: true, accountId: ev.accountId,
          walletName: ev.walletName, walletIcon: ev.walletIcon, network }));
      else if (ev.type === "disconnected")
        setState({ connected: false, accountId: null, network,
          walletName: null, walletIcon: null, balance: null });
      else if (ev.type === "error") setError(ev.message);
    });
  }, [network]);

  const connect = useCallback(async () => {
    setConnecting(true); setError(null);
    try { await connectWallet(network); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Connection failed"); }
    finally { setConnecting(false); }
  }, [network]);

  const disconnect = useCallback(() => disconnectWallet(), []);

  const sign = useCallback(async (params: TransferParams): Promise<SignResult> => {
    setSigning(true); setError(null);
    try { return await signAndExecuteTransfer(params); }
    catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Signing failed";
      setError(msg); throw new Error(msg);
    } finally { setSigning(false); }
  }, []);

  return { ...state, connecting, signing, error,
    connect, disconnect, sign, clearError: () => setError(null) };
}
