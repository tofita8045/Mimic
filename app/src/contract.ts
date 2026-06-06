// Typed wrappers around the Mimic Intelligent Contract.
// Signing is done by the local burner account (see genlayer.ts) — no client.connect().
import type { GenLayerClient } from "genlayer-js/types";
import { TransactionStatus } from "./genlayer";

// The deployed Mimic contract on GenLayer Studionet.
export const CONTRACT_ADDRESS = "0x56E39F008e29ecd45D2b76F330AEb3AE992B66Ad" as const;

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

function shorten(addr: string): string {
  return addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

function toNumber(v: unknown): number {
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v) || 0;
  return 0;
}

function toBool(v: unknown): boolean {
  return v === true || v === 1 || v === "true";
}

const ADDR = CONTRACT_ADDRESS as Address;

async function writeAndWait(
  client: GenLayerClient<any>,
  functionName: string,
  args: unknown[],
): Promise<void> {
  const hash = await client.writeContract({
    address: ADDR,
    functionName,
    args: args as any,
    value: 0n,
  });
  // LLM consensus can take a while — wait generously.
  await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    retries: 300,
    interval: 5000,
  });
}

export async function startRound(client: GenLayerClient<any>, seed: string) {
  return writeAndWait(client, "start_round", [seed]);
}

export async function makeGuess(client: GenLayerClient<any>, guess: "human" | "ai") {
  return writeAndWait(client, "make_guess", [guess]);
}

async function readView(
  client: GenLayerClient<any>,
  functionName: string,
  args: unknown[] = [],
): Promise<unknown> {
  return client.readContract({ address: ADDR, functionName, args: args as any });
}

export async function getMyRound(
  client: GenLayerClient<any>,
  player: Address,
): Promise<RoundView> {
  const [active, resolved, sentence, persona, guess, correct] = await Promise.all([
    readView(client, "get_active", [player]),
    readView(client, "get_resolved", [player]),
    readView(client, "get_sentence", [player]),
    readView(client, "get_persona_revealed", [player]),
    readView(client, "get_guess", [player]),
    readView(client, "get_correct", [player]),
  ]);
  return {
    active: toBool(active),
    resolved: toBool(resolved),
    sentence: typeof sentence === "string" ? sentence : "",
    persona: typeof persona === "string" ? persona : "",
    guess: typeof guess === "string" ? guess : "",
    correct: toBool(correct),
  };
}

export async function getScore(
  client: GenLayerClient<any>,
  player: Address,
): Promise<number> {
  return toNumber(await readView(client, "get_score", [player]));
}

export async function getLeaderboard(
  client: GenLayerClient<any>,
): Promise<LeaderboardRow[]> {
  const raw = (await readView(client, "get_leaderboard", [])) as unknown;
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[])
    .map((entry): LeaderboardRow | null => {
      if (!Array.isArray(entry) || entry.length < 4) return null;
      const [addr, wins, losses, score] = entry as [unknown, unknown, unknown, unknown];
      if (typeof addr !== "string") return null;
      return {
        player: shorten(addr),
        address: addr,
        wins: toNumber(wins),
        losses: toNumber(losses),
        score: toNumber(score),
      };
    })
    .filter((r): r is LeaderboardRow => r !== null)
    .sort((a, b) => b.score - a.score);
}
