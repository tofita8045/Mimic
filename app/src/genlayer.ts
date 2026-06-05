// SDK setup for the Human-or-AI game. Uses real genlayer-js APIs straight from the docs.
// Wallet-agnostic: works with any EIP-1193 provider (Rabby, MetaMask, OKX, Coinbase, etc.).
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import type { GenLayerClient } from "genlayer-js/types";

interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider & { providers?: Eip1193Provider[] };
  }
}

/** Info about a detected wallet (EIP-6963 announce). */
export interface DetectedWallet {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

/** Discover injected wallets via EIP-6963. Falls back to a single generic entry
 *  if only the legacy `window.ethereum` is available. */
export function discoverWallets(timeoutMs = 200): Promise<DetectedWallet[]> {
  return new Promise((resolve) => {
    const found = new Map<string, DetectedWallet>();

    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent).detail as
        | { info: DetectedWallet; provider: Eip1193Provider }
        | undefined;
      if (detail?.info) found.set(detail.info.uuid, detail.info);
    };

    window.addEventListener("eip6963:announceProvider", onAnnounce as EventListener);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    window.setTimeout(() => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce as EventListener);
      const list = Array.from(found.values());
      if (list.length === 0 && typeof window.ethereum !== "undefined") {
        list.push({
          uuid: "legacy",
          name: "Browser wallet",
          icon: "",
          rdns: "legacy",
        });
      }
      resolve(list);
    }, timeoutMs);
  });
}

/** Create a genlayer-js client bound to the user's wallet address on Studionet. */
export function makeClient(account: `0x${string}`): GenLayerClient<any> {
  return createClient({ chain: studionet, account }) as GenLayerClient<any>;
}

/** Request accounts from the active injected wallet (whichever one set window.ethereum). */
export async function connectWallet(): Promise<`0x${string}`> {
  if (typeof window.ethereum === "undefined") {
    throw new Error(
      "No wallet detected. Install an EIP-1193 wallet (Rabby, MetaMask, OKX, Coinbase, etc.).",
    );
  }
  const accounts = (await window.ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];
  if (!accounts || accounts.length === 0) {
    throw new Error("No account selected in the wallet.");
  }
  return accounts[0] as `0x${string}`;
}

export { TransactionStatus, studionet };
