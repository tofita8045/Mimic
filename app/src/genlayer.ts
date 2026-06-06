// SDK setup for Mimic.
//
// Players don't need MetaMask, a snap, or any wallet extension. The app creates a
// local "burner" account (a fresh private key stored in localStorage) and signs
// every transaction directly with genlayer-js. This keeps onboarding to zero clicks
// and works in every browser regardless of installed wallets.
import { createClient, createAccount, generatePrivateKey } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import type { GenLayerClient } from "genlayer-js/types";

const PK_KEY = "mimic.burnerPrivateKey";

export type Hex = `0x${string}`;

/** Get (or lazily create) the player's local burner private key. */
export function getOrCreatePrivateKey(): Hex {
  let pk = localStorage.getItem(PK_KEY);
  if (!pk || !pk.startsWith("0x")) {
    pk = generatePrivateKey() as string;
    localStorage.setItem(PK_KEY, pk);
  }
  return pk as Hex;
}

/** Build a genlayer-js client bound to the local burner account on Studionet. */
export function makeClient(): { client: GenLayerClient<any>; address: Hex } {
  const pk = getOrCreatePrivateKey();
  const account = createAccount(pk);
  const client = createClient({ chain: studionet, account }) as GenLayerClient<any>;
  return { client, address: account.address as Hex };
}

/** Reset the local identity (new burner account). */
export function resetIdentity(): void {
  localStorage.removeItem(PK_KEY);
}

export { TransactionStatus, studionet };
