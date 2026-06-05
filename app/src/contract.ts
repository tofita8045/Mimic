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
  score: number;
  wins?: number;
  losses?: number;
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

function safeParse<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toNumber(v: unknown): number {
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number") return v;
  return 0;
}

function shorten(addr: string): string {
  return addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
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

/** Build the leaderboard by paging through (player_count) and reading each score. */
export async function getLeaderboard(
  client: GenLayerClient<any>,
  address: Address,
  limit = 50,
): Promise<LeaderboardRow[]> {
  const countRaw = await client.readContract({
    address,
    functionName: "get_player_count",
    args: [],
  });
  const count = Math.min(toNumber(countRaw), limit);
  if (count <= 0) return [];

  const indices = Array.from({ length: count }, (_, i) => i);
  const players = await Promise.all(
    indices.map((i) =>
      client
        .readContract({
          address,
          functionName: "get_player_at",
          args: [i],
        })
        .then((v) => (typeof v === "string" ? v : "")),
    ),
  );

  const triplets = await Promise.all(
    players.map(async (addr) => {
      if (!addr) return null;
      const [score, wins, losses] = await Promise.all([
        client.readContract({ address, functionName: "get_score", args: [addr] }),
        client.readContract({ address, functionName: "get_wins", args: [addr] }),
        client.readContract({ address, functionName: "get_losses", args: [addr] }),
      ]);
      return {
        player: shorten(addr),
        address: addr,
        score: toNumber(score),
        wins: toNumber(wins),
        losses: toNumber(losses),
      } satisfies LeaderboardRow;
    }),
  );

  return (triplets.filter((r) => r !== null) as LeaderboardRow[]).sort(
    (a, b) => b.score - a.score,
  );
}
