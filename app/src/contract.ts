// Typed wrappers around the Mimic Intelligent Contract.
import type { GenLayerClient } from "genlayer-js/types";
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
  player: string;       // shortened display label
  address: string;      // full wallet address
  wins?: number;
  losses?: number;
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

/** Switch wallet to Studionet, then send a write call and wait until accepted. */
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
  const v = (await client.readContract({
    address,
    functionName: "get_my_round",
    args: [player],
  })) as unknown;
  return (v as RoundView) ?? { active: false };
}

export async function getScore(
  client: GenLayerClient<any>,
  address: Address,
  player: Address,
): Promise<number> {
  const v = (await client.readContract({
    address,
    functionName: "get_score",
    args: [player],
  })) as number | bigint;
  return typeof v === "bigint" ? Number(v) : v;
}

export async function getLeaderboard(
  client: GenLayerClient<any>,
  address: Address,
): Promise<LeaderboardRow[]> {
  const rows = (await client.readContract({
    address,
    functionName: "get_leaderboard",
    args: [],
  })) as unknown;
  return (rows as LeaderboardRow[] | null) ?? [];
}
