// Typed wrappers around the HumanOrAI Intelligent Contract.
import type { GenLayerClient } from "genlayer-js/types";
import { TransactionStatus } from "./genlayer";

const STORAGE_KEY = "mimic.contractAddress";

export type Address = `0x${string}`;

export interface SessionView {
  active: boolean;
  transcript?: string;
  turns?: number;
  max_turns?: number;
  resolved?: boolean;
  correct?: boolean;
  guess?: string;
  persona?: string;
}

export interface LeaderboardRow {
  player: string;
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

export async function startGame(client: GenLayerClient<any>, address: Address) {
  return writeAndWait(client, address, "start_game", []);
}

export async function sendMessage(
  client: GenLayerClient<any>,
  address: Address,
  text: string,
) {
  return writeAndWait(client, address, "send_message", [text]);
}

export async function makeGuess(
  client: GenLayerClient<any>,
  address: Address,
  guess: "human" | "ai",
) {
  return writeAndWait(client, address, "make_guess", [guess]);
}

export async function getMySession(
  client: GenLayerClient<any>,
  address: Address,
  player: Address,
): Promise<SessionView> {
  const result = (await client.readContract({
    address,
    functionName: "get_my_session",
    args: [player],
  })) as unknown;
  return result as SessionView;
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
