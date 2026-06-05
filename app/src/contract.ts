// Typed wrappers around the Mimic Intelligent Contract.
import type { GenLayerClient, GenLayerChain, DecodedDeployData, TransactionHash } from "genlayer-js/types";
import { TransactionStatus } from "./genlayer";

const STORAGE_KEY = "mimic.contractAddress";

export type Address = `0x${string}`;

export interface RoundView {
  active: boolean;
  sentence?: string;
  resolved?: boolean;
  correct?: boolean;
  guess?: string;
  persona?: string;
}

export interface LeaderboardRow {
  player: string;
  address: string;
  wins: number;
  losses: number;
  score: number;
}

export function getSavedAddress(): Address | null {
  const v = localStorage.getItem(STORAGE_KEY);
  return v && v.startsWith("0x") ? (v as Address) : null;
}

export function setSavedAddress(addr: string): void {
  localStorage.setItem(STORAGE_KEY, addr.trim());
}

export function clearSavedAddress(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function shorten(addr: string): string {
  return addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

function toNumber(v: unknown): number {
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v) || 0;
  return 0;
}

function safeParse<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeAndWait(
  client: GenLayerClient<any>,
  address: Address,
  functionName: string,
  args: unknown[],
): Promise<void> {
  await client.connect("studionet");
  const hash = await client.writeContract({
    address,
    functionName,
    args: args as any,
    value: 0n,
  });
  await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
  });
}

/** Deploy the bundled Mimic contract source straight from the app — no Studio UI needed. */
export async function deployContract(
  client: GenLayerClient<any>,
  contractSource: string,
): Promise<Address> {
  await client.connect("studionet");

  // Skip optional consensus init if the SDK build doesn't expose it on Studionet.
  const init = (client as any).initializeConsensusSmartContract;
  if (typeof init === "function") {
    try {
      await init.call(client);
    } catch {
      /* ignore — already initialized on shared Studionet */
    }
  }

  const code = new TextEncoder().encode(contractSource);
  const hash = (await client.deployContract({ code, args: [] })) as TransactionHash;

  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    retries: 200,
  });

  const chainId = (client.chain as GenLayerChain).id;
  // Studionet returns the address in receipt.data.contract_address
  // (testnet bradbury exposes it via txDataDecoded).
  const fromData = (receipt as any).data?.contract_address as string | undefined;
  const fromTx = ((receipt as any).txDataDecoded as DecodedDeployData | undefined)?.contractAddress;
  const deployedAt = (chainId !== 4221 ? fromData : fromTx) ?? fromData ?? fromTx;

  if (!deployedAt) {
    throw new Error("Deployed but couldn't read the contract address from the receipt.");
  }
  return deployedAt as Address;
}

export async function startRound(
  client: GenLayerClient<any>,
  address: Address,
  player: Address,
  seed: string,
) {
  return writeAndWait(client, address, "start_round", [player, seed]);
}

export async function makeGuess(
  client: GenLayerClient<any>,
  address: Address,
  player: Address,
  guess: "human" | "ai",
) {
  return writeAndWait(client, address, "make_guess", [player, guess]);
}

export async function getMyRound(
  client: GenLayerClient<any>,
  address: Address,
  player: Address,
): Promise<RoundView> {
  const raw = await client.readContract({
    address,
    functionName: "get_my_round",
    args: [player],
  });
  return safeParse<RoundView>(raw, { active: false });
}

export async function getScore(
  client: GenLayerClient<any>,
  address: Address,
  player: Address,
): Promise<number> {
  return toNumber(
    await client.readContract({
      address,
      functionName: "get_score",
      args: [player],
    }),
  );
}

async function getStats(
  client: GenLayerClient<any>,
  address: Address,
  player: string,
): Promise<{ wins: number; losses: number }> {
  const raw = (await client.readContract({
    address,
    functionName: "get_stats",
    args: [player],
  })) as unknown;
  const s = typeof raw === "string" ? raw : "0,0";
  const [w, l] = s.split(",");
  return { wins: parseInt(w, 10) || 0, losses: parseInt(l, 10) || 0 };
}

export async function getLeaderboard(
  client: GenLayerClient<any>,
  address: Address,
): Promise<LeaderboardRow[]> {
  const rosterRaw = (await client.readContract({
    address,
    functionName: "get_roster",
    args: [],
  })) as unknown;
  const roster = typeof rosterRaw === "string" ? rosterRaw.trim() : "";
  if (!roster) return [];
  const addresses = roster.split("\n").filter(Boolean);

  const stats = await Promise.all(
    addresses.map((addr) => getStats(client, address, addr)),
  );

  return addresses
    .map<LeaderboardRow>((addr, i) => {
      const s = stats[i];
      return {
        player: shorten(addr),
        address: addr,
        wins: s.wins,
        losses: s.losses,
        score: s.wins * 10 - s.losses * 5,
      };
    })
    .sort((a, b) => b.score - a.score);
}
