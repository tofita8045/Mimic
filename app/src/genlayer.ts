// SDK + wallet setup for Mimic.
//
// Real wallet connection: works with MetaMask, OKX, Rabby, Coinbase, or any
// EIP-1193 / EIP-6963 injected provider. The user connects their wallet, the app
// builds a genlayer-js client bound to that provider + address, and every write is
// signed by the wallet.
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import type { GenLayerClient } from "genlayer-js/types";

export type Hex = `0x${string}`;

interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, handler: (...args: any[]) => void) => void;
  removeListener?: (event: string, handler: (...args: any[]) => void) => void;
}

interface Eip6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

export interface DetectedWallet {
  info: Eip6963ProviderInfo;
  provider: Eip1193Provider;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider & { providers?: Eip1193Provider[] };
  }
}

/** Discover injected wallets via EIP-6963, falling back to window.ethereum. */
export function discoverWallets(timeoutMs = 250): Promise<DetectedWallet[]> {
  return new Promise((resolve) => {
    const found = new Map<string, DetectedWallet>();

    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent).detail as DetectedWallet | undefined;
      if (detail?.info?.uuid) found.set(detail.info.uuid, detail);
    };

    window.addEventListener("eip6963:announceProvider", onAnnounce as EventListener);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    window.setTimeout(() => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce as EventListener);
      const list = Array.from(found.values());
      if (list.length === 0 && window.ethereum) {
        list.push({
          info: { uuid: "injected", name: "Browser Wallet", icon: "", rdns: "injected" },
          provider: window.ethereum,
        });
      }
      resolve(list);
    }, timeoutMs);
  });
}

/** Request accounts from a chosen provider and return the active address. */
export async function requestAccounts(provider: Eip1193Provider): Promise<Hex> {
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts || accounts.length === 0) throw new Error("No account selected in the wallet.");
  return accounts[0] as Hex;
}

/** Build a genlayer-js client bound to a real wallet provider + address. */
export function makeClient(provider: Eip1193Provider, address: Hex): GenLayerClient<any> {
  return createClient({
    chain: studionet,
    account: address,
    provider: provider as any,
  }) as GenLayerClient<any>;
}

/** Read-only client (no wallet) for public views like the leaderboard. */
export function makeReadClient(): GenLayerClient<any> {
  return createClient({ chain: studionet }) as GenLayerClient<any>;
}

export { TransactionStatus, studionet };
