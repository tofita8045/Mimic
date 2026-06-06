// Typed wrappers around the Mimic chat Intelligent Contract.
import type { GenLayerClient } from "genlayer-js/types";
import { TransactionStatus } from "./genlayer";

// The deployed Mimic (chat) contract on GenLayer Studionet.
export const CONTRACT_ADDRESS = "0xEBDCa401A7ABc0161BBda43311d65c14a92b0590" as const;

// Entry fee per round: 0.0001 GEN, in wei (must match ENTRY_FEE_WEI in mimic.py).
export const ENTRY_FEE_WEI = 100000000000000n;

export type Address = `0x${string}`;

export interface ChatMessage {
  role: "you" | "them";
  text: string;
}

export interface RoundView {
  active: boolean;
  resolved: boolean;
  messages: ChatMessage[];
  msgCount: number;
  maxMessages: number;
  guess: string;
  persona: string; // "" until resolved
  correct: boolean;
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

export async function ensureNetwork(client: GenLayerClient<any>): Promise<void> {
  await client.connect("studionet");
}

async function writeAndWait(
  client: GenLayerClient<any>,
  functionName: string,
  args: unknown[],
  value: bigint,
): Promise<void> {
  console.log(`[mimic] writeContract ${functionName}`, args, "value", value.toString());
  const hash = await client.writeContract({
    address: ADDR,
    functionName,
    args: args as any,
    value,
  });
  console.log(`[mimic] ${functionName} tx hash:`, hash);
  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    retries: 400,
    interval: 5000,
  });
  console.log(`[mimic] ${functionName} receipt status:`, (receipt as any)?.statusName ?? (receipt as any)?.status);
}

export async function startRound(client: GenLayerClient<any>, seed: string) {
  return writeAndWait(client, "start_round", [seed], ENTRY_FEE_WEI);
}

export async function sendMessage(client: GenLayerClient<any>, text: string) {
  return writeAndWait(client, "send_message", [text], 0n);
}

export async function makeGuess(client: GenLayerClient<any>, guess: "human" | "ai") {
  return writeAndWait(client, "make_guess", [guess], 0n);
}

async function readView(
  client: GenLayerClient<any>,
  functionName: string,
  args: unknown[] = [],
): Promise<unknown> {
  return client.readContract({ address: ADDR, functionName, args: args as any });
}

function parseTranscript(raw: unknown): ChatMessage[] {
  if (typeof raw !== "string") return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((m) => m && (m.role === "you" || m.role === "them") && typeof m.text === "string")
      .map((m) => ({ role: m.role, text: m.text }));
  } catch {
    return [];
  }
}

export async function getMyRound(
  client: GenLayerClient<any>,
  player: Address,
): Promise<RoundView> {
  const [active, resolved, transcript, msgCount, maxMessages, persona, guess, correct] =
    await Promise.all([
      readView(client, "get_active", [player]),
      readView(client, "get_resolved", [player]),
      readView(client, "get_transcript", [player]),
      readView(client, "get_msg_count", [player]),
      readView(client, "get_max_messages", []),
      readView(client, "get_persona_revealed", [player]),
      readView(client, "get_guess", [player]),
      readView(client, "get_correct", [player]),
    ]);
  return {
    active: toBool(active),
    resolved: toBool(resolved),
    messages: parseTranscript(transcript),
    msgCount: toNumber(msgCount),
    maxMessages: toNumber(maxMessages) || 6,
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
