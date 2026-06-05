// Typed wrappers around the Mimic Intelligent Contract.
import type { GenLayerClient, TransactionHash, DecodedDeployData, GenLayerChain } from "genlayer-js/types";
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

function toBool(v: unknown): boolean {
  return v === true || v === 1 || v === "true";
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

  const init = (client as any).initializeConsensusSmartContract;
  if (typeof init === "function") {
    try {
      await init.call(client);
    } catch {
      /* already initialized on shared Studionet */
    }
  }

  const code = new TextEncoder().encode(contractSource);
  const hash = (await client.deployContract({ code, args: [] })) as TransactionHash;

  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    retries: 200,
  });

  const fromData = (receipt as any).data?.contract_address as string | undefined;
  const fromTx = ((receipt as any).txDataDecoded as DecodedDeployData | undefined)?.contractAddress;
  const deployedAt = fromData ?? fromTx;

  if (!deployedAt) {
    throw new Error("Deployed but couldn't read the contract address from the receipt.");
  }
  return deployedAt as Address;
}

export async function startRound(
  client: GenLayerClient<any>,
  address: Address,
  seed: string,
) {
  return writeAndWait(client, address, "start_round", [seed]);
}

export async function makeGuess(
  client: GenLayerClient<any>,
  address: Address,
  guess: "human" | "ai",
) {
  return writeAndWait(client, address, "make_guess", [guess]);
}

async function readView(
  client: GenLayerClient<any>,
  address: Address,
  functionName: string,
  args: unknown[] = [],
): Promise<unknown> {
  return client.readContract({ address, functionName, args: args as any });
}

export async function getMyRound(
  client: GenLayerClient<any>,
  address: Address,
  player: Address,
): Promise<RoundView> {
  const [active, resolved, sentence, persona, guess, correct] = await Promise.all([
    readView(client, address, "get_active", [player]),
    readView(client, address, "get_resolved", [player]),
    readView(client, address, "get_sentence", [player]),
    readView(client, address, "get_persona_revealed", [player]),
    readView(client, address, "get_guess", [player]),
    readView(client, address, "get_correct", [player]),
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
  address: Address,
  player: Address,
): Promise<number> {
  return toNumber(await readView(client, address, "get_score", [player]));
}

export async function getLeaderboard(
  client: GenLayerClient<any>,
  address: Address,
): Promise<LeaderboardRow[]> {
  const raw = (await readView(client, address, "get_leaderboard", [])) as unknown;
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
