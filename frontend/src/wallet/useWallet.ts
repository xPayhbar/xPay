import { useState, useEffect, useCallback } from "react";
import {
  initWalletConnect,
  connectExtension,
  connectQR,
  disconnectWallet,
  signAndExecuteTransfer,
  getAvailableExtensions,
  getWalletState,
  onWalletEvent,
  type WalletState,
  type TransferParams,
  type SignResult,
} from "./walletConnect";

export interface AvailableExtension {
  id: string;
  name: string;
  icon?: string;
  available: boolean;
}

export interface UseWalletReturn extends WalletState {
  connecting:          boolean;
  signing:             boolean;
  error:               string | null;
  availableExtensions: AvailableExtension[];
  connectExt:          (name: string) => Promise<void>;
  connectModal:        () => Promise<void>;
  disconnect:          () => Promise<void>;
  sign:                (params: TransferParams) => Promise<SignResult>;
  clearError:          () => void;
}

export function useWallet(
  network: "testnet" | "mainnet" = "testnet"
): UseWalletReturn {
  const [state,      setState]      = useState<WalletState>(getWalletState());
  const [connecting, setConnecting] = useState(false);
  const [signing,    setSigning]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [extensions, setExtensions] = useState<AvailableExtension[]>([]);

  // Init on mount, discover extensions, subscribe to events
  useEffect(() => {
    initWalletConnect(network)
      .then(() => getAvailableExtensions(network))
      .then(exts => setExtensions(exts))
      .catch(e => console.warn("WalletConnect init:", e?.message));

    return onWalletEvent(ev => {
      if (ev.type === "connected") {
        setState(s => ({
          ...s, connected: true, accountId: ev.accountId,
          walletName: ev.walletName, walletIcon: ev.walletIcon,
          isExtension: ev.isExtension, network,
        }));
        setError(null);
      } else if (ev.type === "disconnected") {
        setState({ connected: false, accountId: null, network,
          walletName: null, walletIcon: null, balance: null, isExtension: false });
      } else if (ev.type === "error") {
        setError(ev.message);
      }
    });
  }, [network]);

  // Connect via browser extension (HashPack/Blade/Kabila installed)
  const connectExt = useCallback(async (name: string) => {
    setConnecting(true); setError(null);
    try { await connectExtension(name, network); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Extension connection failed"); }
    finally { setConnecting(false); }
  }, [network]);

  // Connect via QR code (mobile or no extension)
  const connectModal = useCallback(async () => {
    setConnecting(true); setError(null);
    try { await connectQR(network); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "QR connection failed"); }
    finally { setConnecting(false); }
  }, [network]);

  const disconnect = useCallback(() => disconnectWallet(), []);

  // Sign a real Hedera transaction from the user's wallet
  const sign = useCallback(async (params: TransferParams): Promise<SignResult> => {
    setSigning(true); setError(null);
    try { return await signAndExecuteTransfer(params); }
    catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Signing failed";
      setError(msg); throw new Error(msg);
    } finally { setSigning(false); }
  }, []);

  return {
    ...state,
    connecting, signing, error,
    availableExtensions: extensions,
    connectExt, connectModal, disconnect, sign,
    clearError: () => setError(null),
  };
}
